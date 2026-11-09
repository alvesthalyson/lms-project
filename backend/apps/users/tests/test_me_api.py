import pytest
from rest_framework.test import APIClient

from apps.users.tests.factories import MemberFactory

pytestmark = pytest.mark.django_db


def as_user(user=None):
    client = APIClient()
    if user:
        client.force_authenticate(user)
    return client


def test_me_needs_a_session():
    assert as_user().get("/api/v1/users/me/").status_code == 401


def test_a_member_reads_their_own_profile():
    member = MemberFactory(first_name="Ana")
    r = as_user(member).get("/api/v1/users/me/")
    assert r.status_code == 200
    assert r.json()["id"] == member.id
    assert r.json()["first_name"] == "Ana"


def test_patch_changes_contact_data_only():
    member = MemberFactory()
    r = as_user(member).patch(
        "/api/v1/users/me/", {"phone": "090-0000-0000", "role": "ADMIN", "is_blocked": True}, format="json"
    )
    assert r.status_code == 200
    member.refresh_from_db()
    assert member.phone == "090-0000-0000"
    assert member.role == "MEMBER" and member.is_blocked is False


def test_change_password():
    member = MemberFactory()
    member.set_password("Old-passphrase-1")
    member.save()
    client = as_user(member)

    wrong = client.post("/api/v1/users/me/password/", {"old_password": "nope", "new_password": "New-passphrase-9"}, format="json")
    assert wrong.status_code == 400

    ok = client.post(
        "/api/v1/users/me/password/", {"old_password": "Old-passphrase-1", "new_password": "New-passphrase-9"}, format="json"
    )
    assert ok.status_code == 204
    member.refresh_from_db()
    assert member.check_password("New-passphrase-9")


def test_members_still_cannot_list_other_users():
    assert as_user(MemberFactory()).get("/api/v1/users/").status_code == 403
