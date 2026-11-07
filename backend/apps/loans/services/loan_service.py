"""
Loan lifecycle: create_loan, renew_loan, return_loan, calculate_fine.

Views call these with already-validated data and map the domain exceptions
to HTTP 409 (they all derive from BusinessRuleError). Nothing here knows
about requests, serializers or permissions.

Lock order, always: member (create_loan only) -> Book -> loan / copy rows.
Taking the Book lock before any other row of that title is what keeps
concurrent loans, returns, renewals and reservation promotions from
double-assigning a copy or deadlocking.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.books.exceptions import (
    BookUnavailableError,
    CopyHeldForOtherMemberError,
    CopyNotAvailableError,
)
from apps.books.models import Book, BookCopy, CopyStatus
from apps.books.services import inventory_service
from apps.core.activity import log_activity
from apps.core.models import ActivityAction, LibrarySettings
from apps.reservations.models import Reservation, ReservationStatus
from apps.reservations.services import reservation_service
from apps.users.models import User
from apps.users.services.borrowing_service import assert_can_borrow

from ..exceptions import (
    LoanAlreadyReturnedError,
    LoanOverdueError,
    RenewalBlockedByReservationError,
    RenewalLimitReachedError,
)
from ..models import Fine, FineReason, Loan

CENT = Decimal("0.01")


@dataclass(frozen=True)
class ReturnResult:
    loan: Loan
    fine: Fine | None


# --------------------------------------------------------------------------
# calculate_fine
# --------------------------------------------------------------------------


def fine_amount(days_overdue: int, fine_per_day: Decimal) -> Decimal:
    """Pure arithmetic: whole days late times the daily rate, rounded to cents. Never negative."""
    if days_overdue <= 0:
        return Decimal("0.00")
    return (Decimal(days_overdue) * fine_per_day).quantize(CENT, rounding=ROUND_HALF_UP)


def calculate_fine(
    loan: Loan, *, returned_on: date | None = None, settings: LibrarySettings | None = None
) -> Decimal:
    """
    Fine owed for `loan`: days overdue x fine_per_day, or 0.00 if it is not late.

    Days are whole calendar days in the server's time zone, counted from due_date
    to `returned_on`. By default that is the date the loan was returned, or today
    if it is still open, so the same function previews the fine of an open loan.
    The due date itself is free: returning on the due date costs nothing.
    """
    settings = settings or LibrarySettings.load()
    return fine_amount(loan.days_overdue(on=returned_on), settings.fine_per_day)


# --------------------------------------------------------------------------
# create_loan
# --------------------------------------------------------------------------


@transaction.atomic
def create_loan(
    *,
    member: User,
    issued_by: User | None = None,
    copy: BookCopy | None = None,
    book: Book | None = None,
    due_date: date | None = None,
) -> Loan:
    """
    Lend a copy to `member`. Pass exactly one of:
        copy  a specific BookCopy (barcode scan at the desk)
        book  a title; the service picks the copy

    A member with a READY reservation for the title gets the copy that was held
    for them first, and the reservation is closed as FULFILLED.

    Raises
        MemberBlockedError            manual block, unpaid fines, overdue loans, deactivated
        LoanLimitReachedError         already at max_active_loans
        BookUnavailableError          title withdrawn, or no copy on the shelf (book path)
        CopyNotAvailableError         copy is on loan, lost or damaged (copy path)
        CopyHeldForOtherMemberError   copy is held for someone else's reservation (copy path)
    """
    if (copy is None) == (book is None):
        raise ValueError("Provide exactly one of copy or book.")

    settings = LibrarySettings.load()

    # Lock the member so two simultaneous desk requests cannot both squeeze under the limit.
    member = User.objects.select_for_update().get(pk=member.pk)
    assert_can_borrow(member, settings=settings)

    book = inventory_service.lock_book(copy.book_id if copy is not None else book.pk)
    if not book.is_active:
        raise BookUnavailableError("This book is no longer in the catalogue.")

    reservation = (
        Reservation.objects.select_for_update(of=("self",))
        .filter(member=member, book=book, status=ReservationStatus.READY)
        .first()
    )

    if copy is not None:
        copy = _check_requested_copy(inventory_service.lock_copy(copy.pk), reservation)
    else:
        copy = _pick_copy(book, reservation)

    loan_date = timezone.localdate()
    try:
        with transaction.atomic():  # savepoint: the unique constraint is the last line of defence
            loan = Loan.objects.create(
                member=member,
                copy=copy,
                due_date=due_date or loan_date + timedelta(days=settings.loan_period_days),
                issued_by=issued_by,
            )
    except IntegrityError:
        raise CopyNotAvailableError("This copy already has an open loan.") from None

    inventory_service.set_copy_status(copy, CopyStatus.ON_LOAN)
    if reservation is not None:
        reservation_service.fulfill(reservation=reservation, loan=loan)

    log_activity(
        ActivityAction.LOAN_CREATED,
        actor=issued_by,
        member=member,
        book=book,
        loan_id=loan.pk,
        copy_id=copy.pk,
        due_date=loan.due_date,
    )
    return loan


def _check_requested_copy(copy: BookCopy, reservation: Reservation | None) -> BookCopy:
    """Validate a copy chosen at the desk. `copy` is already locked."""
    if copy.status == CopyStatus.AVAILABLE:
        return copy

    if copy.status == CopyStatus.ON_HOLD:
        if reservation is not None and reservation.held_copy_id == copy.pk:
            return copy
        raise CopyHeldForOtherMemberError()

    raise CopyNotAvailableError(f"This copy cannot be lent (status: {copy.get_status_display()}).")


def _pick_copy(book: Book, reservation: Reservation | None) -> BookCopy:
    """Choose a copy for a title: the member's held copy first, otherwise the lowest-id shelf copy."""
    if reservation is not None and reservation.held_copy_id:
        return inventory_service.lock_copy(reservation.held_copy_id)

    copy = (
        BookCopy.objects.select_for_update()
        .filter(book=book, status=CopyStatus.AVAILABLE)
        .order_by("id")
        .first()
    )
    if copy is None:
        raise BookUnavailableError(
            "No copy of this book is available right now. You can reserve it instead."
        )
    return copy


# --------------------------------------------------------------------------
# renew_loan
# --------------------------------------------------------------------------


@transaction.atomic
def renew_loan(*, loan: Loan, renewed_by: User | None = None) -> Loan:
    """
    Extend the due date by renewal_period_days, counted from the current due date
    (renewing early does not forfeit the days you still had).

    Raises
        LoanAlreadyReturnedError           the loan is closed
        LoanOverdueError                   overdue loans must be returned, not renewed
        MemberBlockedError                 unpaid fines, another overdue loan, manual block
        RenewalLimitReachedError           already renewed max_renewals times
        RenewalBlockedByReservationError   another member is waiting for this title
    """
    settings = LibrarySettings.load()

    inventory_service.lock_book(loan.copy.book_id)
    loan = (
        Loan.objects.select_for_update(of=("self",))
        .select_related("member", "copy")
        .get(pk=loan.pk)
    )

    if loan.returned_at is not None:
        raise LoanAlreadyReturnedError()
    if loan.due_date < timezone.localdate():
        raise LoanOverdueError()

    assert_can_borrow(loan.member, check_loan_limit=False, settings=settings)

    if loan.renewal_count >= settings.max_renewals:
        raise RenewalLimitReachedError(
            f"This loan has already been renewed {loan.renewal_count} "
            f"time{'s' if loan.renewal_count != 1 else ''} (the limit is {settings.max_renewals})."
        )
    if reservation_service.has_waiting_reservations(
        loan.copy.book_id, excluding_member=loan.member
    ):
        raise RenewalBlockedByReservationError()

    loan.due_date += timedelta(days=settings.renewal_period_days)
    loan.renewal_count += 1
    loan.save(update_fields=["due_date", "renewal_count", "updated_at"])

    log_activity(
        ActivityAction.LOAN_RENEWED,
        actor=renewed_by,
        member=loan.member,
        book_id=loan.copy.book_id,
        loan_id=loan.pk,
        due_date=loan.due_date,
        renewal_count=loan.renewal_count,
    )
    return loan


# --------------------------------------------------------------------------
# return_loan
# --------------------------------------------------------------------------


@transaction.atomic
def return_loan(
    *,
    loan: Loan,
    received_by: User | None = None,
    copy_status: str = CopyStatus.AVAILABLE,
    condition_notes: str = "",
) -> ReturnResult:
    """
    Close a loan. A late return creates an OVERDUE fine. The copy goes back on
    the shelf and is offered to the reservation queue (the first eligible member
    gets it on hold and an email), or is withdrawn as DAMAGED if staff say so.

    Raises LoanAlreadyReturnedError if the loan is already closed.
    """
    if copy_status not in (CopyStatus.AVAILABLE, CopyStatus.DAMAGED):
        raise ValueError("copy_status must be AVAILABLE or DAMAGED.")

    settings = LibrarySettings.load()

    inventory_service.lock_book(loan.copy.book_id)
    loan = (
        Loan.objects.select_for_update(of=("self",))
        .select_related("member", "copy")
        .get(pk=loan.pk)
    )
    if loan.returned_at is not None:
        raise LoanAlreadyReturnedError()

    loan.returned_at = timezone.now()
    loan.received_by = received_by
    loan.save(update_fields=["returned_at", "received_by", "updated_at"])

    fine = _fine_for_late_return(loan, settings)

    copy = inventory_service.lock_copy(loan.copy_id)
    if copy_status == CopyStatus.DAMAGED:
        inventory_service.set_copy_status(copy, CopyStatus.DAMAGED, condition_notes=condition_notes)
    else:
        reservation_service.release_copy(copy, condition_notes=condition_notes or None)

    log_activity(
        ActivityAction.LOAN_RETURNED,
        actor=received_by,
        member=loan.member,
        book_id=loan.copy.book_id,
        loan_id=loan.pk,
        days_overdue=loan.days_overdue(),
        fine_amount=fine.amount if fine else None,
        copy_status=copy_status,
    )
    return ReturnResult(loan=loan, fine=fine)


def _fine_for_late_return(loan: Loan, settings: LibrarySettings) -> Fine | None:
    """Create the OVERDUE fine for a loan that has just been closed, if it was late."""
    days = loan.days_overdue()
    amount = fine_amount(days, settings.fine_per_day)
    if amount <= 0:
        return None

    fine = Fine.objects.create(
        loan=loan,
        reason=FineReason.OVERDUE,
        amount=amount,
        note=f"{days} day{'s' if days != 1 else ''} overdue at {settings.fine_per_day}/day",
    )
    log_activity(
        ActivityAction.FINE_ISSUED,
        member=loan.member,
        book_id=loan.copy.book_id,
        loan_id=loan.pk,
        fine_id=fine.pk,
        amount=amount,
    )
    return fine
