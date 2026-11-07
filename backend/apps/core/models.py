from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q


class TimeStampedModel(models.Model):
    """Abstract base: every table gets created_at / updated_at."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class LibrarySettings(TimeStampedModel):
    """
    Singleton row (id=1) with the rules admins can change at runtime.
    Services read these values instead of hard-coding 14 days / 2 renewals.
    """

    loan_period_days = models.PositiveSmallIntegerField(default=14)
    renewal_period_days = models.PositiveSmallIntegerField(default=14)
    max_renewals = models.PositiveSmallIntegerField(default=2)
    max_active_loans = models.PositiveSmallIntegerField(default=5)
    fine_per_day = models.DecimalField(
        max_digits=6, decimal_places=2, default=Decimal("0.50")
    )
    reservation_hold_hours = models.PositiveSmallIntegerField(default=48)

    class Meta:
        verbose_name_plural = "library settings"
        constraints = [
            models.CheckConstraint(
                condition=Q(id=1), name="library_settings_singleton"
            ),
        ]

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "LibrarySettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Library settings"


class ActivityAction(models.TextChoices):
    BOOK_CREATED = "BOOK_CREATED", "Book created"
    LOAN_CREATED = "LOAN_CREATED", "Loan created"
    LOAN_RENEWED = "LOAN_RENEWED", "Loan renewed"
    LOAN_RETURNED = "LOAN_RETURNED", "Loan returned"
    RESERVATION_CREATED = "RESERVATION_CREATED", "Reservation created"
    RESERVATION_READY = "RESERVATION_READY", "Reservation ready"
    RESERVATION_CANCELLED = "RESERVATION_CANCELLED", "Reservation cancelled"
    RESERVATION_EXPIRED = "RESERVATION_EXPIRED", "Reservation expired"
    FINE_ISSUED = "FINE_ISSUED", "Fine issued"
    FINE_PAID = "FINE_PAID", "Fine paid"


class ActivityLog(models.Model):
    """
    Append-only feed for the dashboard's "Recent activity".
    Written explicitly by services (no signals).
    """

    action = models.CharField(max_length=32, choices=ActivityAction.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    book = models.ForeignKey(
        "books.Book",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["-created_at"], name="activity_created_idx"),
        ]

    def __str__(self):
        return f"{self.action} @ {self.created_at:%Y-%m-%d %H:%M}"
