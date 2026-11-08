import pytest
from rest_framework.test import APIClient

from apps.books.tests.factories import BookFactory
from apps.reservations.tests.factories import ReadyReservationFactory, ReservationFactory
from apps.users.tests.factories import MemberFactory

pytestmark = pytest.mark.django_db


def as_user(user=None):
    client = APIClient()
    if user:
        client.force_authenticate(user)
    return client


def results(response):
    return response.json()["results"]


class TestReserve:
    def test_anonymous_is_rejected(self):
        assert as_user().post("/api/v1/reservations/", {"book_id": 1}, format="json").status_code == 401

    def test_member_reserves_a_book_with_no_free_copy(self, member):
        book = BookFactory(copies=1, copies__status="ON_LOAN")
        r = as_user(member).post("/api/v1/reservations/", {"book_id": book.id}, format="json")
        assert r.status_code == 201
        assert r.json()["status"] == "PENDING"
        assert r.json()["queue_position"] == 1

    def test_available_book_cannot_be_reserved(self, member):
        book = BookFactory(copies=1)
        r = as_user(member).post("/api/v1/reservations/", {"book_id": book.id}, format="json")
        assert r.status_code == 409
        assert r.json()["code"] == "book_available"

    def test_duplicate_is_409(self, member):
        book = BookFactory(copies=1, copies__status="ON_LOAN")
        client = as_user(member)
        client.post("/api/v1/reservations/", {"book_id": book.id}, format="json")
        r = client.post("/api/v1/reservations/", {"book_id": book.id}, format="json")
        assert r.status_code == 409
        assert r.json()["code"] == "already_reserved"

    def test_member_cannot_reserve_for_someone_else(self, member):
        book = BookFactory(copies=1, copies__status="ON_LOAN")
        other = MemberFactory()
        r = as_user(member).post(
            "/api/v1/reservations/", {"book_id": book.id, "member_id": other.id}, format="json"
        )
        assert r.status_code == 403

    def test_staff_reserves_for_a_member(self, librarian, member):
        book = BookFactory(copies=1, copies__status="ON_LOAN")
        r = as_user(librarian).post(
            "/api/v1/reservations/", {"book_id": book.id, "member_id": member.id}, format="json"
        )
        assert r.status_code == 201
        assert r.json()["member"]["id"] == member.id

    def test_staff_must_name_the_member(self, librarian):
        book = BookFactory(copies=1, copies__status="ON_LOAN")
        r = as_user(librarian).post("/api/v1/reservations/", {"book_id": book.id}, format="json")
        assert r.status_code == 400


class TestListAndCancel:
    def test_queue_positions_follow_fifo(self, member):
        book = BookFactory()
        first = ReservationFactory(book=book)
        mine = ReservationFactory(book=book, member=member)
        r = as_user(member).get("/api/v1/reservations/")
        assert [x["id"] for x in results(r)] == [mine.id]
        assert results(r)[0]["queue_position"] == 2
        assert first.id != mine.id

    def test_member_sees_only_own(self, member):
        mine = ReservationFactory(member=member)
        ReservationFactory()
        r = as_user(member).get("/api/v1/reservations/")
        assert [x["id"] for x in results(r)] == [mine.id]

    def test_active_filter(self, member):
        ReservationFactory(member=member)
        ReservationFactory(member=member, status="CANCELLED")
        r = as_user(member).get("/api/v1/reservations/", {"active": "true"})
        assert len(results(r)) == 1

    def test_member_cancels_own(self, member):
        reservation = ReservationFactory(member=member)
        r = as_user(member).post(f"/api/v1/reservations/{reservation.id}/cancel/")
        assert r.status_code == 200
        assert r.json()["status"] == "CANCELLED"
        assert r.json()["queue_position"] is None

    def test_cancelling_a_ready_hold_frees_the_copy(self, member):
        reservation = ReadyReservationFactory(member=member)
        r = as_user(member).post(f"/api/v1/reservations/{reservation.id}/cancel/")
        assert r.status_code == 200
        reservation.book.refresh_from_db()
        assert reservation.book.available_copies == 1

    def test_cannot_cancel_someone_elses(self, member):
        other = ReservationFactory()
        assert as_user(member).post(f"/api/v1/reservations/{other.id}/cancel/").status_code == 404

    def test_cancelling_twice_is_409(self, member):
        reservation = ReservationFactory(member=member, status="CANCELLED")
        r = as_user(member).post(f"/api/v1/reservations/{reservation.id}/cancel/")
        assert r.status_code == 409
        assert r.json()["code"] == "reservation_not_active"
