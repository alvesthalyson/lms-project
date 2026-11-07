"""
Fine arithmetic. No database needed: a Loan can be built in memory, and the settings
are passed in, so these run in milliseconds.
"""

from datetime import date, datetime, timezone as dt_timezone
from decimal import Decimal
from types import SimpleNamespace

import pytest

from apps.loans.models import Loan
from apps.loans.services.loan_service import calculate_fine, fine_amount

RATE = SimpleNamespace(fine_per_day=Decimal("0.50"))
DUE = date(2026, 11, 18)


@pytest.mark.parametrize(
    "returned_on, expected",
    [
        (date(2026, 11, 10), "0.00"),  # early
        (DUE, "0.00"),  # on the due date itself: free
        (date(2026, 11, 19), "0.50"),  # one day late
        (date(2026, 11, 21), "1.50"),
        (date(2027, 1, 17), "30.00"),  # 60 days
    ],
)
def test_fine_counts_whole_days_after_the_due_date(returned_on, expected):
    loan = Loan(due_date=DUE)

    assert calculate_fine(loan, returned_on=returned_on, settings=RATE) == Decimal(expected)


def test_a_returned_loan_is_measured_to_the_day_it_came_back_not_to_today():
    returned = Loan(due_date=DUE, returned_at=datetime(2026, 11, 21, 12, 0, tzinfo=dt_timezone.utc))

    assert calculate_fine(returned, settings=RATE) == Decimal("1.50")


def test_the_day_boundary_is_the_library_time_zone_not_utc(settings):
    # 23:30 UTC on the due date is already the next morning in Tokyo.
    returned = Loan(due_date=DUE, returned_at=datetime(2026, 11, 18, 23, 30, tzinfo=dt_timezone.utc))

    settings.TIME_ZONE = "UTC"
    assert calculate_fine(returned, settings=RATE) == Decimal("0.00")

    settings.TIME_ZONE = "Asia/Tokyo"
    assert calculate_fine(returned, settings=RATE) == Decimal("0.50")


@pytest.mark.parametrize("days", [0, -1, -30])
def test_no_fine_for_zero_or_negative_days(days):
    assert fine_amount(days, Decimal("0.50")) == Decimal("0.00")


def test_amounts_are_rounded_half_up_to_cents():
    assert fine_amount(3, Decimal("0.335")) == Decimal("1.01")  # 1.005 -> 1.01, not banker's 1.00
    assert fine_amount(2, Decimal("0.333")) == Decimal("0.67")  # 0.666 -> 0.67


def test_a_zero_rate_means_no_fines():
    assert fine_amount(30, Decimal("0")) == Decimal("0.00")
