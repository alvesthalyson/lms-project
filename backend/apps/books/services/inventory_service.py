"""
Low-level helpers for copies and the Book counters.

Counter semantics
    Book.total_copies      copies still in circulation (AVAILABLE, ON_LOAN, ON_HOLD).
                           LOST and DAMAGED copies are withdrawn and not counted.
    Book.available_copies  copies with status AVAILABLE (on the shelf, not held).

The counters are recomputed from the copy rows rather than incremented, so
they heal themselves if they ever drift. Recomputing is only safe when the
caller holds the Book row lock (lock_book), which every service does: that
lock serialises all work on one title.

Everything here must run inside transaction.atomic.
"""

from django.db.models import Count, Q
from django.utils import timezone

from apps.books.models import Book, BookCopy, CopyStatus

CIRCULATING_STATUSES = (CopyStatus.AVAILABLE, CopyStatus.ON_LOAN, CopyStatus.ON_HOLD)


def lock_book(book_id: int) -> Book:
    """SELECT ... FOR UPDATE on the book row; returns the fresh row."""
    return Book.objects.select_for_update().get(pk=book_id)


def lock_copy(copy_id: int) -> BookCopy:
    """SELECT ... FOR UPDATE on one copy row; returns the fresh row."""
    return BookCopy.objects.select_for_update().get(pk=copy_id)


def sync_book_counts(book_id: int) -> None:
    """Recompute total_copies and available_copies from the copy rows."""
    counts = BookCopy.objects.filter(book_id=book_id).aggregate(
        total=Count("id", filter=Q(status__in=CIRCULATING_STATUSES)),
        available=Count("id", filter=Q(status=CopyStatus.AVAILABLE)),
    )
    Book.objects.filter(pk=book_id).update(
        total_copies=counts["total"],
        available_copies=counts["available"],
        updated_at=timezone.now(),
    )


def set_copy_status(copy: BookCopy, status: str, *, condition_notes: str | None = None) -> None:
    """Change a copy's status and refresh the book's counters. Caller holds the book lock."""
    copy.status = status
    fields = ["status", "updated_at"]
    if condition_notes:
        copy.condition_notes = condition_notes
        fields.append("condition_notes")
    copy.save(update_fields=fields)
    sync_book_counts(copy.book_id)
