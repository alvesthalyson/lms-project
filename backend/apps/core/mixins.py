from __future__ import annotations

from typing import Any

from django.db.models import QuerySet

from apps.users.models import Role


class MemberScopedQuerysetMixin:
    """
    Members only ever see their own rows; staff see everything.

    Set `member_field` to the lookup that leads to the owning user:
        member_field = "member"         # loans, reservations
        member_field = "loan__member"   # fines

    Rows that are not theirs simply do not exist for a member, so detail
    routes answer 404 rather than leaking that the id exists. Combine with
    IsOwnerOrStaff for the nested /users/{id}/... routes.
    """

    member_field = "member"

    def get_queryset(self) -> QuerySet[Any]:
        queryset = super().get_queryset()
        user = self.request.user
        if getattr(user, "role", None) == Role.MEMBER:
            return queryset.filter(**{self.member_field: user})
        return queryset
