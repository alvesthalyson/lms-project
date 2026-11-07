"""
Permission classes. Roles come from User.role (not Django's is_staff), and
ADMIN is a superset of LIBRARIAN:

    IsAdmin           ADMIN
    IsLibrarian       LIBRARIAN or ADMIN        ("Librarian+" in docs/API.md)
    IsOwnerOrStaff    the record belongs to the caller, or LIBRARIAN / ADMIN
    IsLibrarianOrReadOnly   safe methods for everyone (even anonymous), writes for Librarian+

Anonymous users never pass IsAdmin / IsLibrarian / IsOwnerOrStaff. Deactivated
accounts are rejected earlier, by JWTAuthentication, which checks user.is_active
on every request.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.users.models import Role

if TYPE_CHECKING:
    from rest_framework.request import Request
    from rest_framework.views import APIView

STAFF_ROLES = (Role.ADMIN, Role.LIBRARIAN)


def _role(request: Request) -> str | None:
    user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    return getattr(user, "role", None)


class IsAdmin(BasePermission):
    message = "Only administrators can do this."

    def has_permission(self, request: Request, view: APIView) -> bool:
        return _role(request) == Role.ADMIN


class IsLibrarian(BasePermission):
    """LIBRARIAN or ADMIN."""

    message = "Only librarians and administrators can do this."

    def has_permission(self, request: Request, view: APIView) -> bool:
        return _role(request) in STAFF_ROLES


class IsLibrarianOrReadOnly(BasePermission):
    """Public reads (the catalogue), staff-only writes."""

    message = "Only librarians and administrators can change this."

    def has_permission(self, request: Request, view: APIView) -> bool:
        if request.method in SAFE_METHODS:
            return True
        return _role(request) in STAFF_ROLES


def _resolve(obj: object, path: str) -> object | None:
    """Follow a dotted path such as 'loan.member'; returns None if any hop is missing."""
    for part in path.split("."):
        obj = getattr(obj, part, None)
        if obj is None:
            return None
    return obj


class IsOwnerOrStaff(BasePermission):
    """
    Object-level: staff may touch anything, a member only their own records.

    The view says where the owner lives with `owner_field`:
        owner_field = "member"        # Loan, Reservation
        owner_field = "loan.member"   # Fine (dotted paths are fine)
        owner_field = None / unset    # the object IS the user (User detail routes)

    has_permission only requires a logged-in user, so list endpoints stay
    reachable for members; they must also scope their queryset with
    MemberScopedQuerysetMixin, so other people's rows are 404s, not 403s.
    """

    message = "You can only access your own records."

    def has_permission(self, request: Request, view: APIView) -> bool:
        return _role(request) is not None

    def has_object_permission(self, request: Request, view: APIView, obj: object) -> bool:
        if _role(request) in STAFF_ROLES:
            return True
        owner_field = getattr(view, "owner_field", None)
        owner = obj if not owner_field else _resolve(obj, owner_field)
        return owner is not None and getattr(owner, "pk", None) == request.user.pk
