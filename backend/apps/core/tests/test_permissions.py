"""
Permission logic, tested without a database: the classes only read
request.method, request.user.is_authenticated, .role and .pk.
"""

from types import SimpleNamespace

import pytest

from apps.core.permissions import (
    IsAdmin,
    IsLibrarian,
    IsLibrarianOrReadOnly,
    IsOwnerOrStaff,
)
from apps.users.models import Role


def user(role, pk=1):
    return SimpleNamespace(is_authenticated=True, role=role, pk=pk)


ANON = SimpleNamespace(is_authenticated=False)
ADMIN, LIBRARIAN, MEMBER = user(Role.ADMIN, 1), user(Role.LIBRARIAN, 2), user(Role.MEMBER, 3)


def req(u, method="GET"):
    return SimpleNamespace(user=u, method=method)


@pytest.mark.parametrize(
    "perm, who, allowed",
    [
        (IsAdmin, ADMIN, True),
        (IsAdmin, LIBRARIAN, False),
        (IsAdmin, MEMBER, False),
        (IsAdmin, ANON, False),
        (IsLibrarian, ADMIN, True),  # admin is a superset of librarian
        (IsLibrarian, LIBRARIAN, True),
        (IsLibrarian, MEMBER, False),
        (IsLibrarian, ANON, False),
    ],
)
def test_role_gates(perm, who, allowed):
    assert perm().has_permission(req(who), view=None) is allowed


@pytest.mark.parametrize("method", ["GET", "HEAD", "OPTIONS"])
def test_read_only_is_public(method):
    for who in (ANON, MEMBER, LIBRARIAN, ADMIN):
        assert IsLibrarianOrReadOnly().has_permission(req(who, method), None)


@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
def test_writes_need_staff(method):
    perm = IsLibrarianOrReadOnly()
    assert not perm.has_permission(req(ANON, method), None)
    assert not perm.has_permission(req(MEMBER, method), None)
    assert perm.has_permission(req(LIBRARIAN, method), None)
    assert perm.has_permission(req(ADMIN, method), None)


def test_unauthenticated_user_without_role_attribute_is_rejected():
    request = SimpleNamespace(user=SimpleNamespace(is_authenticated=False), method="GET")
    assert not IsLibrarian().has_permission(request, None)
    assert not IsOwnerOrStaff().has_permission(request, None)


class TestIsOwnerOrStaff:
    perm = IsOwnerOrStaff()

    def test_list_level_needs_login_only(self):
        assert self.perm.has_permission(req(MEMBER), None)
        assert not self.perm.has_permission(req(ANON), None)

    def test_staff_can_touch_anything(self):
        loan = SimpleNamespace(member=SimpleNamespace(pk=99))
        view = SimpleNamespace(owner_field="member")
        assert self.perm.has_object_permission(req(LIBRARIAN), view, loan)
        assert self.perm.has_object_permission(req(ADMIN), view, loan)

    def test_member_owns_record_through_owner_field(self):
        view = SimpleNamespace(owner_field="member")
        mine = SimpleNamespace(member=SimpleNamespace(pk=MEMBER.pk))
        theirs = SimpleNamespace(member=SimpleNamespace(pk=99))
        assert self.perm.has_object_permission(req(MEMBER), view, mine)
        assert not self.perm.has_object_permission(req(MEMBER), view, theirs)

    def test_dotted_owner_field_for_fines(self):
        view = SimpleNamespace(owner_field="loan.member")
        mine = SimpleNamespace(loan=SimpleNamespace(member=SimpleNamespace(pk=MEMBER.pk)))
        theirs = SimpleNamespace(loan=SimpleNamespace(member=SimpleNamespace(pk=99)))
        assert self.perm.has_object_permission(req(MEMBER), view, mine)
        assert not self.perm.has_object_permission(req(MEMBER), view, theirs)

    def test_object_is_the_user_when_no_owner_field(self):
        view = SimpleNamespace()  # no owner_field: /users/{id}/ routes
        assert self.perm.has_object_permission(req(MEMBER), view, SimpleNamespace(pk=MEMBER.pk))
        assert not self.perm.has_object_permission(req(MEMBER), view, SimpleNamespace(pk=99))

    def test_missing_owner_denies_instead_of_crashing(self):
        view = SimpleNamespace(owner_field="loan.member")
        orphan = SimpleNamespace(loan=None)
        assert not self.perm.has_object_permission(req(MEMBER), view, orphan)
