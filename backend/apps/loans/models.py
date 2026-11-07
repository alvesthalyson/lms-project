from django.conf import settings
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

from apps.core.models import TimeStampedModel


class FineStatus(models.TextChoices):
    UNPAID = "UNPAID", "Unpaid"
    PAID = "PAID", "Paid"
    WAIVED = "WAIVED", "Waived"


class FineReason(models.TextChoices):
    OVERDUE = "OVERDUE", "Overdue return"
    LOST = "LOST", "Lost book"
    DAMAGED = "DAMAGED", "Damaged book"


class LoanQuerySet(models.QuerySet):
    def active(self):
        return self.filter(returned_at__isnull=True)

    def returned(self):
        return self.filter(returned_at__isnull=False)

    def overdue(self, today=None):
        today = today or timezone.localdate()
        return self.active().filter(due_date__lt=today)


class Loan(TimeStampedModel):
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="loans"
    )
    copy = models.ForeignKey(
        "books.BookCopy", on_delete=models.PROTECT, related_name="loans"
    )
    loaned_at = models.DateTimeField(default=timezone.now)
    due_date = models.DateField()
    returned_at = models.DateTimeField(null=True, blank=True)
    renewal_count = models.PositiveSmallIntegerField(default=0)

    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
    )
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
    )

    objects = LoanQuerySet.as_manager()

    class Meta:
        ordering = ["-loaned_at", "-id"]
        constraints = [
            # A physical copy can have at most one open loan.
            models.UniqueConstraint(
                fields=["copy"],
                condition=Q(returned_at__isnull=True),
                name="uniq_active_loan_per_copy",
            ),
            models.CheckConstraint(
                condition=Q(returned_at__isnull=True) | Q(returned_at__gte=F("loaned_at")),
                name="loan_returned_after_loaned",
            ),
        ]
        indexes = [
            models.Index(fields=["member", "returned_at"], name="loan_member_returned_idx"),
            models.Index(fields=["copy", "-loaned_at"], name="loan_copy_loaned_idx"),
            # Powers the overdue query and the dashboard counters.
            models.Index(
                fields=["due_date"],
                condition=Q(returned_at__isnull=True),
                name="loan_open_due_idx",
            ),
        ]

    @property
    def is_active(self) -> bool:
        return self.returned_at is None

    def days_overdue(self, on=None) -> int:
        """Whole days past due; measured to the return date if already returned."""
        if on is None:
            on = timezone.localdate(self.returned_at) if self.returned_at else timezone.localdate()
        return max((on - self.due_date).days, 0)

    def __str__(self):
        return f"Loan #{self.pk} copy={self.copy_id} member={self.member_id}"


class FineQuerySet(models.QuerySet):
    def unpaid(self):
        return self.filter(status=FineStatus.UNPAID)


class Fine(TimeStampedModel):
    loan = models.ForeignKey(Loan, on_delete=models.PROTECT, related_name="fines")
    reason = models.CharField(
        max_length=10, choices=FineReason.choices, default=FineReason.OVERDUE
    )
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    status = models.CharField(
        max_length=10, choices=FineStatus.choices, default=FineStatus.UNPAID
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
    )
    note = models.CharField(max_length=255, blank=True)

    objects = FineQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="fine_amount_positive"),
            models.UniqueConstraint(
                fields=["loan", "reason"], name="uniq_fine_per_loan_reason"
            ),
            models.CheckConstraint(
                condition=~Q(status=FineStatus.PAID) | Q(paid_at__isnull=False),
                name="fine_paid_has_paid_at",
            ),
        ]
        indexes = [
            models.Index(fields=["status", "loan"], name="fine_status_loan_idx"),
        ]

    def __str__(self):
        return f"Fine #{self.pk} {self.amount} ({self.status})"
