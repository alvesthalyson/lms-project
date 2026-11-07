"""
Reservation queue logic.

Lifecycle
    PENDING   waiting in the FIFO queue (ordered by created_at, id)
    READY     a copy is on hold for the member until expires_at
    FULFILLED the member borrowed it (loan_service.create_loan calls fulfill)
    CANCELLED the member or staff cancelled it
    EXPIRED   the pick-up window ran out (expire_stale_holds, run on a schedule)

Locking: every public function takes the Book row lock first (inventory_service.lock_book)
and only then locks reservation or copy rows, so concurrent returns, loans and
cancellations on one title are serialised and can never double-assign a copy.
The functions that need a lock held by the caller say so in their docstrings.
"""

from datetime import datetime, timedelta

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from apps.books.exceptions import BookUnavailableError
from apps.books.models import Book, BookCopy, CopyStatus
from apps.books.services import inventory_service
from apps.core.activity import log_activity
from apps.core.models import ActivityAction, LibrarySettings
from apps.core.notifications import notify_reservation_ready
from apps.loans.models import Loan
from apps.users.models import User
from apps.users.services.borrowing_service import assert_can_borrow, get_borrowing_status

from ..exceptions import (
    AlreadyBorrowedError,
    AlreadyReservedError,
    BookAvailableError,
    ReservationNotActiveError,
)
from ..models import ACTIVE_RESERVATION_STATUSES, Reservation, ReservationStatus

# --------------------------------------------------------------------------
# Queries
# --------------------------------------------------------------------------


def queue_position(reservation: Reservation) -> int | None:
    """1-based place among PENDING reservations for the book; None for any other status."""
    if reservation.status != ReservationStatus.PENDING:
        return None
    ahead = Reservation.objects.filter(
        book_id=reservation.book_id, status=ReservationStatus.PENDING
    ).filter(
        Q(created_at__lt=reservation.created_at)
        | Q(created_at=reservation.created_at, id__lt=reservation.id)
    )
    return ahead.count() + 1


def has_waiting_reservations(book_id: int, *, excluding_member: User | None = None) -> bool:
    """True if someone is queued (PENDING) for the book, optionally ignoring one member."""
    waiting = Reservation.objects.filter(book_id=book_id, status=ReservationStatus.PENDING)
    if excluding_member is not None:
        waiting = waiting.exclude(member=excluding_member)
    return waiting.exists()


# --------------------------------------------------------------------------
# reserve
# --------------------------------------------------------------------------


@transaction.atomic
def reserve(*, member: User, book: Book, requested_by: User | None = None) -> Reservation:
    """
    Put `member` at the back of the queue for `book`.

    Raises
        BookUnavailableError   the title is withdrawn or has no copies in circulation
        MemberBlockedError     manual block, unpaid fines, overdue loans, deactivated account
        AlreadyBorrowedError   the member has a copy of this title on loan right now
        AlreadyReservedError   the member already has a PENDING or READY reservation
        BookAvailableError     a copy is on the shelf; borrow it instead
    """
    book = inventory_service.lock_book(book.pk)

    if not book.is_active:
        raise BookUnavailableError("This book is no longer in the catalogue.")
    if book.total_copies == 0:
        raise BookUnavailableError("This book has no copies in circulation.")

    # The loan limit does not matter for joining a queue; it is re-checked at pick-up.
    assert_can_borrow(member, check_loan_limit=False)

    if Loan.objects.active().filter(member=member, copy__book=book).exists():
        raise AlreadyBorrowedError()
    if Reservation.objects.filter(
        member=member, book=book, status__in=ACTIVE_RESERVATION_STATUSES
    ).exists():
        raise AlreadyReservedError()
    if book.available_copies > 0:
        raise BookAvailableError()

    try:
        with transaction.atomic():  # savepoint, so an IntegrityError does not poison the outer transaction
            reservation = Reservation.objects.create(member=member, book=book)
    except IntegrityError:  # the unique constraint caught a race the checks above missed
        raise AlreadyReservedError() from None

    reservation.queue_position = queue_position(reservation)
    log_activity(
        ActivityAction.RESERVATION_CREATED,
        actor=requested_by or member,
        member=member,
        book=book,
        reservation_id=reservation.pk,
        queue_position=reservation.queue_position,
    )
    return reservation


# --------------------------------------------------------------------------
# Handing copies to the queue
# --------------------------------------------------------------------------


def allocate_available_copies(
    book_id: int, *, settings: LibrarySettings | None = None, now: datetime | None = None
) -> list[Reservation]:
    """
    Give every AVAILABLE copy of the book to the next eligible PENDING reservation.

    The copy goes ON_HOLD, the reservation READY with a pick-up deadline, and the
    "ready" email is queued. Members who cannot borrow right now (blocked, overdue,
    at the loan limit) are skipped but keep their place in the queue.

    CALLER MUST HOLD the Book row lock inside transaction.atomic. Call this
    whenever a copy becomes AVAILABLE: after a return, a cancellation, an expiry,
    a new copy being added, or a LOST copy being found.
    """
    copies = list(
        BookCopy.objects.filter(book_id=book_id, status=CopyStatus.AVAILABLE).order_by("id")
    )
    if not copies:
        return []

    settings = settings or LibrarySettings.load()
    now = now or timezone.now()
    hold = timedelta(hours=settings.reservation_hold_hours)

    waiting = (
        Reservation.objects.select_for_update(of=("self",))
        .select_related("member", "book")
        .filter(book_id=book_id, status=ReservationStatus.PENDING)
        .order_by("created_at", "id")
    )

    promoted = []
    for reservation in waiting:
        if not copies:
            break
        if not get_borrowing_status(reservation.member, settings=settings).can_borrow:
            continue

        copy = copies.pop(0)
        reservation.status = ReservationStatus.READY
        reservation.held_copy = copy
        reservation.notified_at = now
        reservation.expires_at = now + hold
        reservation.save(
            update_fields=["status", "held_copy", "notified_at", "expires_at", "updated_at"]
        )
        inventory_service.set_copy_status(copy, CopyStatus.ON_HOLD)

        log_activity(
            ActivityAction.RESERVATION_READY,
            member=reservation.member,
            book=reservation.book,
            reservation_id=reservation.pk,
            copy_id=copy.pk,
            expires_at=reservation.expires_at,
        )
        notify_reservation_ready(reservation)
        promoted.append(reservation)
    return promoted


def release_copy(copy: BookCopy, *, condition_notes: str | None = None) -> Reservation | None:
    """
    Put a copy back on the shelf and offer it to the queue.

    Returns the reservation that now holds it, or None if it stayed AVAILABLE.
    CALLER MUST HOLD the Book row lock inside transaction.atomic.
    """
    inventory_service.set_copy_status(
        copy, CopyStatus.AVAILABLE, condition_notes=condition_notes
    )
    promoted = allocate_available_copies(copy.book_id)
    return promoted[0] if promoted else None


# --------------------------------------------------------------------------
# fulfill
# --------------------------------------------------------------------------


def fulfill(*, reservation: Reservation, loan: Loan) -> Reservation:
    """
    Close a READY reservation because the member has borrowed the book.

    Called by loan_service.create_loan after the loan exists, never directly
    by a view. If the member took a different copy than the one on hold, the
    held copy is released to the next person in the queue.
    CALLER MUST HOLD the Book row lock inside transaction.atomic.
    """
    if reservation.status != ReservationStatus.READY:
        raise ReservationNotActiveError("Only a reservation that is ready for pick-up can be fulfilled.")

    held_copy_id = reservation.held_copy_id
    reservation.status = ReservationStatus.FULFILLED
    reservation.loan = loan
    reservation.held_copy = None
    reservation.save(update_fields=["status", "loan", "held_copy", "updated_at"])

    if held_copy_id and held_copy_id != loan.copy_id:
        release_copy(inventory_service.lock_copy(held_copy_id))
    return reservation


# --------------------------------------------------------------------------
# cancel
# --------------------------------------------------------------------------


@transaction.atomic
def cancel(*, reservation: Reservation, cancelled_by: User | None = None) -> Reservation:
    """
    Cancel a PENDING or READY reservation. A held copy goes to the next person
    in the queue, or back on the shelf.

    Raises ReservationNotActiveError if it is already FULFILLED, CANCELLED or EXPIRED.
    """
    inventory_service.lock_book(reservation.book_id)
    reservation = (
        Reservation.objects.select_for_update(of=("self",))
        .select_related("member", "book")
        .get(pk=reservation.pk)
    )
    if reservation.status not in ACTIVE_RESERVATION_STATUSES:
        raise ReservationNotActiveError()

    held_copy_id = reservation.held_copy_id
    reservation.status = ReservationStatus.CANCELLED
    reservation.held_copy = None
    reservation.expires_at = None
    reservation.save(update_fields=["status", "held_copy", "expires_at", "updated_at"])

    if held_copy_id:
        release_copy(inventory_service.lock_copy(held_copy_id))

    log_activity(
        ActivityAction.RESERVATION_CANCELLED,
        actor=cancelled_by or reservation.member,
        member=reservation.member,
        book=reservation.book,
        reservation_id=reservation.pk,
    )
    reservation.queue_position = None
    return reservation


# --------------------------------------------------------------------------
# expiry (scheduled)
# --------------------------------------------------------------------------


def expire_stale_holds(*, now: datetime | None = None) -> int:
    """
    Expire every READY reservation whose pick-up window has passed and offer
    its copy to the next person. Each reservation is handled in its own
    transaction, so one failure cannot block the rest.
    Returns the number expired. Run by `manage.py expire_reservations`.
    """
    now = now or timezone.now()
    due = list(
        Reservation.objects.filter(status=ReservationStatus.READY, expires_at__lt=now)
        .order_by("expires_at", "id")
        .values_list("id", "book_id")
    )
    return sum(_expire_one(reservation_id, book_id, now) for reservation_id, book_id in due)


@transaction.atomic
def _expire_one(reservation_id: int, book_id: int, now: datetime) -> int:
    inventory_service.lock_book(book_id)
    reservation = (
        Reservation.objects.select_for_update(of=("self",))
        .select_related("member", "book")
        .get(pk=reservation_id)
    )
    # Re-check under the lock: the member may have picked it up, or staff cancelled it.
    if reservation.status != ReservationStatus.READY or reservation.expires_at >= now:
        return 0

    held_copy_id = reservation.held_copy_id
    reservation.status = ReservationStatus.EXPIRED
    reservation.held_copy = None
    reservation.save(update_fields=["status", "held_copy", "updated_at"])
    if held_copy_id:
        release_copy(inventory_service.lock_copy(held_copy_id))

    log_activity(
        ActivityAction.RESERVATION_EXPIRED,
        member=reservation.member,
        book=reservation.book,
        reservation_id=reservation.pk,
    )
    return 1
