import pytest
from rest_framework.test import APIClient

from apps.books.tests.factories import BookCopyFactory, BookFactory
from apps.loans.models import FineStatus
from apps.loans.tests.factories import FineFactory, LoanFactory
from apps.users.tests.factories import MemberFactory

pytestmark = pytest.mark.django_db


def as_user(user=None):
    client = APIClient()
    if user:
        client.force_authenticate(user)
    return client


def results(response):
    return response.json()["results"]


class TestLoanList:
    def test_anonymous_is_rejected(self):
        assert as_user().get("/api/v1/loans/").status_code == 401

    def test_member_sees_only_own_loans(self, member):
        mine = LoanFactory(member=member)
        LoanFactory()
        r = as_user(member).get("/api/v1/loans/")
        assert [x["id"] for x in results(r)] == [mine.id]

    def test_member_filter_is_ignored_for_members(self, member):
        mine = LoanFactory(member=member)
        other = LoanFactory()
        r = as_user(member).get("/api/v1/loans/", {"member": other.member_id})
        assert [x["id"] for x in results(r)] == [mine.id]

    def test_staff_sees_all_and_filters_by_status(self, librarian):
        LoanFactory()
        late = LoanFactory(overdue=True)
        LoanFactory(returned=True)
        client = as_user(librarian)
        assert len(results(client.get("/api/v1/loans/"))) == 3
        r = client.get("/api/v1/loans/", {"status": "overdue"})
        assert [x["id"] for x in results(r)] == [late.id]
        assert results(r)[0]["status"] == "overdue"
        assert len(results(client.get("/api/v1/loans/", {"status": "returned"}))) == 1

    def test_staff_search_by_title(self, librarian):
        loan = LoanFactory(copy__book__title="Zebra Handbook")
        LoanFactory()
        r = as_user(librarian).get("/api/v1/loans/", {"search": "zebra"})
        assert [x["id"] for x in results(r)] == [loan.id]


class TestLoanCreate:
    def test_member_cannot_create(self, member):
        book = BookFactory(copies=1)
        r = as_user(member).post("/api/v1/loans/", {"member_id": member.id, "book_id": book.id}, format="json")
        assert r.status_code == 403

    def test_librarian_lends_by_book(self, librarian, member):
        book = BookFactory(copies=2)
        r = as_user(librarian).post("/api/v1/loans/", {"member_id": member.id, "book_id": book.id}, format="json")
        assert r.status_code == 201
        assert r.json()["status"] == "active"
        book.refresh_from_db()
        assert book.available_copies == 1

    def test_needs_exactly_one_of_copy_or_book(self, librarian, member):
        r = as_user(librarian).post("/api/v1/loans/", {"member_id": member.id}, format="json")
        assert r.status_code == 400

    def test_no_copy_available_is_409(self, librarian, member):
        book = BookFactory()
        r = as_user(librarian).post("/api/v1/loans/", {"member_id": member.id, "book_id": book.id}, format="json")
        assert r.status_code == 409
        assert r.json()["code"] == "no_copy_available"

    def test_blocked_member_is_409(self, librarian):
        blocked = MemberFactory(is_blocked=True)
        book = BookFactory(copies=1)
        r = as_user(librarian).post("/api/v1/loans/", {"member_id": blocked.id, "book_id": book.id}, format="json")
        assert r.status_code == 409
        assert r.json()["code"] == "member_blocked"


class TestRenewAndReturn:
    def test_member_renews_own_loan(self, member):
        loan = LoanFactory(member=member)
        r = as_user(member).post(f"/api/v1/loans/{loan.id}/renew/")
        assert r.status_code == 200
        assert r.json()["renewal_count"] == 1

    def test_member_cannot_see_or_renew_others(self, member):
        loan = LoanFactory()
        assert as_user(member).post(f"/api/v1/loans/{loan.id}/renew/").status_code == 404

    def test_overdue_cannot_be_renewed(self, member):
        loan = LoanFactory(member=member, overdue=True)
        r = as_user(member).post(f"/api/v1/loans/{loan.id}/renew/")
        assert r.status_code == 409

    def test_member_cannot_return(self, member):
        loan = LoanFactory(member=member)
        assert as_user(member).post(f"/api/v1/loans/{loan.id}/return/").status_code == 403

    def test_on_time_return_has_no_fine(self, librarian):
        loan = LoanFactory()
        r = as_user(librarian).post(f"/api/v1/loans/{loan.id}/return/", {}, format="json")
        assert r.status_code == 200
        assert r.json()["fine"] is None
        assert r.json()["loan"]["status"] == "returned"

    def test_late_return_issues_a_fine(self, librarian):
        loan = LoanFactory(overdue=True)
        r = as_user(librarian).post(f"/api/v1/loans/{loan.id}/return/", {}, format="json")
        assert r.status_code == 200
        assert r.json()["fine"]["reason"] == "OVERDUE"
        assert r.json()["fine"]["status"] == "UNPAID"

    def test_returning_twice_is_409(self, librarian):
        loan = LoanFactory(returned=True)
        r = as_user(librarian).post(f"/api/v1/loans/{loan.id}/return/", {}, format="json")
        assert r.status_code == 409
        assert r.json()["code"] == "loan_already_returned"


class TestFines:
    def test_member_sees_only_own_fines(self, member):
        mine = FineFactory(loan__member=member)
        FineFactory()
        r = as_user(member).get("/api/v1/fines/")
        assert [x["id"] for x in results(r)] == [mine.id]

    def test_librarian_pays(self, librarian):
        fine = FineFactory()
        r = as_user(librarian).post(f"/api/v1/fines/{fine.id}/pay/", {"note": "cash"}, format="json")
        assert r.status_code == 200
        assert r.json()["status"] == "PAID"
        assert r.json()["paid_at"] is not None

    def test_paying_twice_is_409(self, librarian):
        fine = FineFactory(status=FineStatus.PAID, paid_at="2026-01-01T00:00:00Z")
        r = as_user(librarian).post(f"/api/v1/fines/{fine.id}/pay/")
        assert r.status_code == 409
        assert r.json()["code"] == "fine_already_settled"

    def test_only_admin_waives(self, librarian, admin):
        fine = FineFactory()
        assert as_user(librarian).post(f"/api/v1/fines/{fine.id}/waive/").status_code == 403
        r = as_user(admin).post(f"/api/v1/fines/{fine.id}/waive/")
        assert r.status_code == 200
        assert r.json()["status"] == "WAIVED"

    def test_manual_fine_and_duplicate(self, librarian):
        loan = LoanFactory(returned=True)
        payload = {"loan_id": loan.id, "reason": "DAMAGED", "amount": "12.00", "note": "Water"}
        client = as_user(librarian)
        assert client.post("/api/v1/fines/", payload, format="json").status_code == 201
        assert client.post("/api/v1/fines/", payload, format="json").status_code == 400
