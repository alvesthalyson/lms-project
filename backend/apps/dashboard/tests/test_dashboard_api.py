import pytest
from rest_framework.test import APIClient

from apps.core.models import ActivityAction, ActivityLog
from apps.loans.tests.factories import FineFactory, LoanFactory
from apps.books.tests.factories import BookFactory
from apps.reservations.tests.factories import ReservationFactory

pytestmark = pytest.mark.django_db


def as_user(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.mark.parametrize("path", ["summary", "most-borrowed", "activity"])
def test_members_are_forbidden(member, path):
    assert as_user(member).get(f"/api/v1/dashboard/{path}/").status_code == 403


def test_anonymous_is_rejected():
    assert APIClient().get("/api/v1/dashboard/summary/").status_code == 401


def test_summary_counts(librarian):
    BookFactory(copies=3)
    LoanFactory()
    LoanFactory(overdue=True)
    ReservationFactory()
    FineFactory(amount="1.50")
    FineFactory(amount="2.00")
    body = as_user(librarian).get("/api/v1/dashboard/summary/").json()
    assert body["loans"] == {"active": 2, "overdue": 1}
    assert body["reservations"] == {"pending": 1, "ready": 0}
    assert body["fines"]["unpaid_count"] == 2
    assert body["fines"]["unpaid_total"] == "3.50"
    assert body["books"]["copies_total"] >= 3
    assert body["members"]["total"] >= 1


def test_summary_on_an_empty_library(librarian):
    body = as_user(librarian).get("/api/v1/dashboard/summary/").json()
    assert body["books"] == {"titles": 0, "copies_total": 0, "copies_available": 0}
    assert body["fines"]["unpaid_total"] == "0.00"


def test_most_borrowed_orders_and_limits(librarian):
    popular = BookFactory(copies=3)
    quiet = BookFactory(copies=1)
    for copy in popular.copies.all()[:2]:
        LoanFactory(copy=copy)
    LoanFactory(copy=quiet.copies.first())
    r = as_user(librarian).get("/api/v1/dashboard/most-borrowed/", {"limit": 1})
    assert r.status_code == 200
    assert [row["book"]["id"] for row in r.json()] == [popular.id]
    assert r.json()[0]["loan_count"] == 2


def test_most_borrowed_validates_params(librarian):
    assert as_user(librarian).get("/api/v1/dashboard/most-borrowed/", {"days": "0"}).status_code == 400
    assert as_user(librarian).get("/api/v1/dashboard/most-borrowed/", {"limit": "x"}).status_code == 400


def test_activity_feed_is_paginated_and_filterable(librarian):
    ActivityLog.objects.create(action=ActivityAction.LOAN_CREATED)
    ActivityLog.objects.create(action=ActivityAction.FINE_PAID)
    client = as_user(librarian)
    body = client.get("/api/v1/dashboard/activity/").json()
    assert body["count"] == 2
    only = client.get("/api/v1/dashboard/activity/", {"action": "FINE_PAID"}).json()
    assert [row["action"] for row in only["results"]] == ["FINE_PAID"]
