"""
loan_service.create_loan: the rules, one behaviour per test.

Reading guide
    TestLendingACopy          the happy paths and what a loan changes (copy status, counters, log)
    TestNothingToLend         no copy / wrong copy -> BookUnavailableError, CopyNotAvailableError, ...
    TestWhoMayBorrow          fines, overdue loans, manual block, deactivation, loan limit
    TestReservations          a READY reservation gets its held copy; nobody else may take it
    TestInvalidCalls          programmer errors
    TestAtomicity             a failure half-way leaves no trace
    test_...racing...         two desks lend the last copy at the same moment (real transactions)
"""

import threading
from datetime import timedelta

import pytest
from django.db import connection
from django.utils import timezone

from apps.books.exceptions import (
    BookUnavailableError,
    CopyHeldForOtherMemberError,
    CopyNotAvailableError,
)
from apps.books.models import BookCopy, CopyStatus
from apps.books.services.inventory_service import sync_book_counts
from apps.books.tests.factories import BookCopyFactory, BookFactory
from apps.core.models import ActivityAction, ActivityLog
from apps.loans.models import Fine, FineStatus, Loan
from apps.loans.services import loan_service
from apps.loans.services.loan_service import create_loan
from apps.loans.tests.factories import FineFactory, LoanFactory
from apps.reservations.models import ReservationStatus
from apps.reservations.tests.factories import ReadyReservationFactory
from apps.users.exceptions import LoanLimitReachedError, MemberBlockedError
from apps.users.tests.factories import LibrarianFactory, MemberFactory

pytestmark = pytest.mark.django_db


def counters(book):
    """(total_copies, available_copies) as stored in the database right now."""
    book.refresh_from_db()
    return book.total_copies, book.available_copies


class TestLendingACopy:
    def test_lends_a_copy_picked_by_title(self):
        book, member, librarian = BookFactory(copies=3), MemberFactory(), LibrarianFactory()

        loan = create_loan(member=member, book=book, issued_by=librarian)

        assert loan.pk is not None
        assert loan.member == member
        assert loan.issued_by == librarian
        assert loan.copy.book == book
        assert loan.returned_at is None
        assert loan.renewal_count == 0
        loan.copy.refresh_from_db()
        assert loan.copy.status == CopyStatus.ON_LOAN
        assert counters(book) == (3, 2)  # still 3 in circulation, one fewer on the shelf

    def test_due_date_defaults_to_the_configured_loan_period(self, library_settings):
        library_settings.loan_period_days = 21
        library_settings.save()

        loan = create_loan(member=MemberFactory(), book=BookFactory(copies=1))

        assert loan.due_date == timezone.localdate() + timedelta(days=21)

    def test_an_explicit_due_date_wins(self):
        due = timezone.localdate() + timedelta(days=3)

        loan = create_loan(member=MemberFactory(), book=BookFactory(copies=1), due_date=due)

        assert loan.due_date == due

    def test_lends_the_specific_copy_scanned_at_the_desk(self):
        book = BookFactory(copies=3)
        scanned = book.copies.order_by("id").last()

        loan = create_loan(member=MemberFactory(), copy=scanned)

        assert loan.copy == scanned

    def test_by_title_it_skips_copies_that_are_out_and_takes_the_lowest_id(self):
        book = BookFactory(copies=3)
        first, second, _third = book.copies.order_by("id")
        BookCopy.objects.filter(pk=first.pk).update(status=CopyStatus.ON_LOAN)
        sync_book_counts(book.pk)

        loan = create_loan(member=MemberFactory(), book=book)

        assert loan.copy == second

    def test_records_the_loan_in_the_activity_feed(self):
        book, member, librarian = BookFactory(copies=1), MemberFactory(), LibrarianFactory()

        loan = create_loan(member=member, book=book, issued_by=librarian)

        entry = ActivityLog.objects.get(action=ActivityAction.LOAN_CREATED)
        assert (entry.actor, entry.member, entry.book) == (librarian, member, book)
        assert entry.metadata["loan_id"] == loan.pk
        assert entry.metadata["due_date"] == loan.due_date.isoformat()


class TestNothingToLend:
    def test_every_copy_is_out(self):
        book = BookFactory(copies=2, copies__status=CopyStatus.ON_LOAN)

        with pytest.raises(BookUnavailableError) as error:
            create_loan(member=MemberFactory(), book=book)

        assert error.value.status_code == 409
        assert error.value.get_codes() == "no_copy_available"
        # Nothing half-done is left behind.
        assert Loan.objects.count() == 0
        assert ActivityLog.objects.count() == 0
        assert counters(book) == (2, 0)

    def test_a_title_with_no_copies_at_all(self):
        with pytest.raises(BookUnavailableError):
            create_loan(member=MemberFactory(), book=BookFactory())

    def test_a_withdrawn_title_cannot_be_lent_even_if_copies_remain(self):
        book = BookFactory(copies=2, is_active=False)

        with pytest.raises(BookUnavailableError, match="no longer in the catalogue"):
            create_loan(member=MemberFactory(), book=book)

    @pytest.mark.parametrize("status", [CopyStatus.ON_LOAN, CopyStatus.LOST, CopyStatus.DAMAGED])
    def test_a_specific_copy_that_cannot_be_lent(self, status):
        book = BookFactory(copies=1, copies__status=status)

        with pytest.raises(CopyNotAvailableError) as error:
            create_loan(member=MemberFactory(), copy=book.copies.get())

        assert error.value.get_codes() == "copy_not_available"

    def test_a_copy_held_for_someone_elses_reservation(self):
        reservation = ReadyReservationFactory()

        with pytest.raises(CopyHeldForOtherMemberError) as error:
            create_loan(member=MemberFactory(), copy=reservation.held_copy)

        assert error.value.get_codes() == "copy_held_for_other_member"
        reservation.refresh_from_db()
        assert reservation.status == ReservationStatus.READY  # the hold is untouched
        assert reservation.held_copy.status == CopyStatus.ON_HOLD


class TestWhoMayBorrow:
    def test_unpaid_fines_block_borrowing_until_they_are_paid(self):
        member, book = MemberFactory(), BookFactory(copies=1)
        fine = FineFactory(loan__member=member)  # UNPAID, on a closed loan

        with pytest.raises(MemberBlockedError) as error:
            create_loan(member=member, book=book)
        assert error.value.get_codes() == "member_blocked"
        assert "unpaid fines" in str(error.value.detail)

        Fine.objects.filter(pk=fine.pk).update(status=FineStatus.PAID, paid_at=timezone.now())
        assert create_loan(member=member, book=book).pk is not None  # blocking is computed live

    def test_an_overdue_loan_blocks_borrowing(self):
        member = MemberFactory()
        LoanFactory(member=member, overdue=True)

        with pytest.raises(MemberBlockedError, match="overdue"):
            create_loan(member=member, book=BookFactory(copies=1))

    def test_a_manual_block_blocks_borrowing_and_says_why(self):
        member = MemberFactory(is_blocked=True, blocked_reason="Lost library card")

        with pytest.raises(MemberBlockedError, match="Lost library card"):
            create_loan(member=member, book=BookFactory(copies=1))

    def test_a_deactivated_account_cannot_borrow(self):
        member = MemberFactory(is_active=False)

        with pytest.raises(MemberBlockedError, match="deactivated"):
            create_loan(member=member, book=BookFactory(copies=1))

    def test_the_active_loan_limit(self, library_settings):
        library_settings.max_active_loans = 2
        library_settings.save()
        member, book = MemberFactory(), BookFactory(copies=1)

        LoanFactory(member=member)
        assert create_loan(member=member, book=book).pk is not None  # the 2nd loan fits

        with pytest.raises(LoanLimitReachedError) as error:  # the 3rd does not
            create_loan(member=member, book=BookFactory(copies=1))
        assert error.value.get_codes() == "loan_limit_reached"

    def test_returned_loans_do_not_count_towards_the_limit(self, library_settings):
        library_settings.max_active_loans = 1
        library_settings.save()
        member = MemberFactory()
        LoanFactory(member=member, returned=True)

        assert create_loan(member=member, book=BookFactory(copies=1)).pk is not None


class TestReservations:
    def test_the_member_with_a_ready_reservation_gets_the_held_copy(self):
        reservation = ReadyReservationFactory()

        loan = create_loan(member=reservation.member, book=reservation.book)

        assert loan.copy_id == reservation.held_copy_id
        reservation.refresh_from_db()
        assert reservation.status == ReservationStatus.FULFILLED
        assert reservation.loan_id == loan.pk
        assert reservation.held_copy is None
        assert counters(reservation.book) == (1, 0)

    def test_nobody_else_can_take_a_held_copy_by_title(self):
        reservation = ReadyReservationFactory()  # the book's only copy is on hold

        with pytest.raises(BookUnavailableError):
            create_loan(member=MemberFactory(), book=reservation.book)

    def test_taking_a_different_copy_releases_the_held_one(self):
        reservation = ReadyReservationFactory()
        held = reservation.held_copy
        other = BookCopyFactory(book=reservation.book)  # AVAILABLE
        sync_book_counts(reservation.book_id)

        loan = create_loan(member=reservation.member, copy=other)

        assert loan.copy == other
        reservation.refresh_from_db()
        assert reservation.status == ReservationStatus.FULFILLED
        held.refresh_from_db()
        assert held.status == CopyStatus.AVAILABLE  # nobody is waiting, so it goes back on the shelf
        assert counters(reservation.book) == (2, 1)


class TestInvalidCalls:
    def test_needs_a_copy_or_a_book(self):
        with pytest.raises(ValueError):
            create_loan(member=MemberFactory())

    def test_not_both_a_copy_and_a_book(self):
        book = BookFactory(copies=1)

        with pytest.raises(ValueError):
            create_loan(member=MemberFactory(), book=book, copy=book.copies.get())


class TestAtomicity:
    def test_a_failure_after_the_loan_is_created_rolls_everything_back(self, monkeypatch):
        book = BookFactory(copies=1)

        def boom(*args, **kwargs):
            raise RuntimeError("activity log is down")

        monkeypatch.setattr(loan_service, "log_activity", boom)

        with pytest.raises(RuntimeError):
            create_loan(member=MemberFactory(), book=book)

        assert Loan.objects.count() == 0
        assert book.copies.get().status == CopyStatus.AVAILABLE
        assert counters(book) == (1, 1)


@pytest.mark.concurrency
@pytest.mark.django_db(transaction=True)
def test_two_desks_racing_for_the_last_copy_lend_it_exactly_once():
    book = BookFactory(copies=1)
    members = MemberFactory.create_batch(2)
    barrier = threading.Barrier(2)
    outcomes = []

    def desk(member):
        try:
            barrier.wait(timeout=10)  # release both threads at the same instant
            create_loan(member=member, book=book)
            outcomes.append("lent")
        except BookUnavailableError:
            outcomes.append("unavailable")
        except Exception as exc:  # anything else is a bug the assertion below will show
            outcomes.append(repr(exc))
        finally:
            connection.close()  # each thread opened its own database connection

    threads = [threading.Thread(target=desk, args=(member,)) for member in members]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)

    assert sorted(outcomes) == ["lent", "unavailable"]
    assert Loan.objects.count() == 1
    assert counters(book) == (1, 0)
