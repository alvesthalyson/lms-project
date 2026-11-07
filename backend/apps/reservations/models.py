from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.core.models import TimeStampedModel


class ReservationStatus(models.TextChoices):
    PENDING = "PENDING", "Waiting in queue"
    READY = "READY", "Ready for pick-up"
    FULFILLED = "FULFILLED", "Fulfilled (loan created)"
    CANCELLED = "CANCELLED", "Cancelled"
    EXPIRED = "EXPIRED", "Expired"


ACTIVE_RESERVATION_STATUSES = (ReservationStatus.PENDING, ReservationStatus.READY)


class Reservation(TimeStampedModel):
    """
    FIFO queue per book: order by (created_at, id). There is no position
    column; the position is computed, so cancellations never need re-numbering.
    """

    member = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="reservations"
    )
    book = models.ForeignKey(
        "books.Book", on_delete=models.PROTECT, related_name="reservations"
    )
    status = models.CharField(
        max_length=10,
        choices=ReservationStatus.choices,
        default=ReservationStatus.PENDING,
    )

    # Set when the reservation reaches the front of the queue and a copy frees up.
    held_copy = models.ForeignKey(
        "books.BookCopy",
        null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
    )
    notified_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    # Set when the member picks the book up.
    loan = models.OneToOneField(
        "loans.Loan",
        null=True, blank=True, on_delete=models.SET_NULL, related_name="reservation",
    )

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [
            # One open reservation per member per book.
            models.UniqueConstraint(
                fields=["member", "book"],
                condition=Q(status__in=ACTIVE_RESERVATION_STATUSES),
                name="uniq_active_reservation_per_member_book",
            ),
            # A READY reservation must say which copy is held and until when.
            models.CheckConstraint(
                condition=~Q(status=ReservationStatus.READY)
                | (Q(held_copy__isnull=False) & Q(expires_at__isnull=False)),
                name="reservation_ready_has_copy_and_expiry",
            ),
        ]
        indexes = [
            # "Who is next for this book?"
            models.Index(
                fields=["book", "status", "created_at"], name="reservation_queue_idx"
            ),
            models.Index(fields=["member", "status"], name="reservation_member_idx"),
        ]

    def __str__(self):
        return f"Reservation #{self.pk} book={self.book_id} ({self.status})"
