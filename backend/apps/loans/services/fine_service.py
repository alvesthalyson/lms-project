"""Manual fines and settling fines (pay / waive). Overdue fines are made by loan_service."""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.core.activity import log_activity
from apps.core.exceptions import BusinessRuleError, ErrorCode
from apps.core.models import ActivityAction
from apps.users.models import User

from ..models import Fine, FineStatus, Loan


@transaction.atomic
def create_manual_fine(
    *, loan: Loan, reason: str, amount: Decimal, note: str = "", created_by: User | None = None
) -> Fine:
    """A LOST or DAMAGED fine set by staff. The serializer already rejects duplicates."""
    fine = Fine.objects.create(
        loan=loan, reason=reason, amount=amount, note=note, processed_by=created_by
    )
    log_activity(
        ActivityAction.FINE_ISSUED,
        actor=created_by,
        member=loan.member,
        book=loan.copy.book,
        fine_id=fine.pk,
        amount=fine.amount,
        reason=reason,
    )
    return fine


def _lock_unpaid(fine: Fine) -> Fine:
    locked = Fine.objects.select_for_update().select_related("loan__member", "loan__copy__book").get(
        pk=fine.pk
    )
    if locked.status != FineStatus.UNPAID:
        raise BusinessRuleError("This fine is already settled.", code=ErrorCode.FINE_ALREADY_SETTLED)
    return locked


@transaction.atomic
def pay_fine(*, fine: Fine, paid_by: User | None = None, note: str = "") -> Fine:
    fine = _lock_unpaid(fine)
    fine.status = FineStatus.PAID
    fine.paid_at = timezone.now()
    fine.processed_by = paid_by
    if note:
        fine.note = note
    fine.save()
    log_activity(
        ActivityAction.FINE_PAID,
        actor=paid_by,
        member=fine.loan.member,
        book=fine.loan.copy.book,
        fine_id=fine.pk,
        amount=fine.amount,
    )
    return fine


@transaction.atomic
def waive_fine(*, fine: Fine, waived_by: User | None = None, note: str = "") -> Fine:
    fine = _lock_unpaid(fine)
    fine.status = FineStatus.WAIVED
    fine.processed_by = waived_by
    if note:
        fine.note = note
    fine.save()
    return fine
