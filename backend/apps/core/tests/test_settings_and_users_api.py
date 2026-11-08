import pytest
from rest_framework.test import APIClient

from apps.users.tests.factories import MemberFactory

pytestmark = pytest.mark.django_db


def as_user(user=None):
    client = APIClient()
    if user:
        client.force_authenticate(user)
    return client


def test_settings_need_a_session():
    assert as_user().get("/api/v1/settings/").status_code == 401


def test_member_reads_settings(member):
    r = as_user(member).get("/api/v1/settings/")
    assert r.status_code == 200
    assert r.json()["loan_period_days"] == 14


def test_only_admin_patches_settings(librarian, admin):
    assert as_user(librarian).patch("/api/v1/settings/", {"max_renewals": 3}, format="json").status_code == 403
    r = as_user(admin).patch("/api/v1/settings/", {"max_renewals": 3}, format="json")
    assert r.status_code == 200
    assert r.json()["max_renewals"] == 3


def test_settings_reject_silly_values(admin):
    r = as_user(admin).patch("/api/v1/settings/", {"loan_period_days": 0}, format="json")
    assert r.status_code == 400


def test_user_lookup_is_staff_only(member, librarian):
    assert as_user(member).get("/api/v1/users/").status_code == 403
    assert as_user(librarian).get("/api/v1/users/").status_code == 200


def test_user_search_by_name_and_number(librarian):
    ana = MemberFactory(first_name="Ana", last_name="Silva")
    MemberFactory(first_name="Bruno")
    client = as_user(librarian)
    by_name = client.get("/api/v1/users/", {"search": "silva", "role": "MEMBER"}).json()["results"]
    assert [u["id"] for u in by_name] == [ana.id]
    by_number = client.get("/api/v1/users/", {"search": ana.member_number}).json()["results"]
    assert [u["id"] for u in by_number] == [ana.id]
