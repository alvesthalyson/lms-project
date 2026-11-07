"""
Who may borrow? One place answers it for create_loan, renew_loan and reserve,
and for GET /users/{id}/borrowing-status/.

The status is computed on every call from the loans and fines tables instead
of being stored, so it can never go stale: paying a fine or returning a late
book unblocks the member immediately.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.core.models import LibrarySettings
from apps.loans.models import Fine, Loan
from apps.users.exceptions import LoanLimitReachedError, MemberBlockedError
from apps.users.models import User

# Values match BorrowingStatusSerializer.reasons
MANUALLY_BLOCKED = "manually_blocked"
UNPAID_FINES = "unpaid_fines"
OVERDUE_LOANS = "overdue_loans"
LOAN_LIMIT_REACHED = "loan_limit_reached"

ZERO = Decimal("0.00")


@dataclass(frozen=True)
class BorrowingStatus:
    can_borrow: bool
    reasons: list[str]
    active_loans: int
    overdue_loans: int
    unpaid_fines_total: Decimal
    max_active_loans: int


def get_borrowing_status(
    member: User, *, settings: LibrarySettings | None = None, today: date | None = None
) -> BorrowingStatus:
    """
    Work out whether `member` may borrow right now, and why not if they may not.

    Computed from the loans and fines tables on every call (never stored), so paying a
    fine or returning a late book changes the answer immediately. `settings` and `today`
    can be passed in to avoid extra queries or to test a specific day.
    """
    settings = settings or LibrarySettings.load()
    today = today or timezone.localdate()

    loan_counts = Loan.objects.active().filter(member=member).aggregate(
        active=Count("id"),
        overdue=Count("id", filter=Q(due_date__lt=today)),
    )
    unpaid_total = (
        Fine.objects.unpaid()
        .filter(loan__member=member)
        .aggregate(total=Sum("amount"))["total"]
        or ZERO
    )

    reasons = []
    if member.is_blocked:
        reasons.append(MANUALLY_BLOCKED)
    if unpaid_total > 0:
        reasons.append(UNPAID_FINES)
    if loan_counts["overdue"]:
        reasons.append(OVERDUE_LOANS)
    if loan_counts["active"] >= settings.max_active_loans:
        reasons.append(LOAN_LIMIT_REACHED)

    return BorrowingStatus(
        can_borrow=not reasons,
        reasons=reasons,
        active_loans=loan_counts["active"],
        overdue_loans=loan_counts["overdue"],
        unpaid_fines_total=unpaid_total,
        max_active_loans=settings.max_active_loans,
    )


def assert_can_borrow(
    member: User, *, check_loan_limit: bool = True, settings: LibrarySettings | None = None
) -> BorrowingStatus:
    """
    Raise MemberBlockedError or LoanLimitReachedError, otherwise return the status.

    Blocking conditions win over the loan limit, because paying a fine or
    returning a book fixes them, whereas the limit is just a count.
    Pass check_loan_limit=False for renewals and reservations, where the
    number of open loans is irrelevant.
    """
    if not member.is_active:
        raise MemberBlockedError("Member cannot borrow: the account is deactivated.")

    status = get_borrowing_status(member, settings=settings)

    blocking =[r for r in status.reasons if r != LOAN_LIMIT_REACHED]
    if blocking:
        raise MemberBlockedError(_describe_block(member, blocking, status))
    if check_loan_limit and LOAN_LIMIT_REACHED in status.reasons:
        raise LoanLimitReachedError(
            f"Member already has {status.active_loans} active loans "
            f"(the limit is {status.max_active_loans})."
        )
    return status


def _describe_block(member: User, reasons: list[str], status: BorrowingStatus) -> str:
    parts = []
    if MANUALLY_BLOCKED in reasons:
        parts.append(
            f"blocked by staff ({member.blocked_reason})"
            if member.blocked_reason
            else "blocked by staff"
        )
    if UNPAID_FINES in reasons:
        parts.append(f"unpaid fines of {status.unpaid_fines_total}")
    if OVERDUE_LOANS in reasons:
        count = status.overdue_loans
        parts.append(f"{count} overdue loan{'s' if count != 1 else ''}")
    return "Member cannot borrow: " + "; ".join(parts) + "."
