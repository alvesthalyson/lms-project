import django_filters as df
from django.db.models import Q
from django.utils import timezone

from apps.users.models import Role

from .models import Fine, FineReason, FineStatus, Loan


def _is_member(request) -> bool:
    return getattr(request.user, "role", None) == Role.MEMBER


class LoanFilter(df.FilterSet):
    status = df.ChoiceFilter(
        choices=[("active", "active"), ("overdue", "overdue"), ("returned", "returned")],
        method="filter_status",
    )
    member = df.NumberFilter(method="filter_member")
    book = df.NumberFilter(field_name="copy__book_id")
    copy = df.NumberFilter(field_name="copy_id")
    due_from = df.DateFilter(field_name="due_date", lookup_expr="gte")
    due_to = df.DateFilter(field_name="due_date", lookup_expr="lte")
    loaned_from = df.DateFilter(field_name="loaned_at", lookup_expr="date__gte")
    loaned_to = df.DateFilter(field_name="loaned_at", lookup_expr="date__lte")
    search = df.CharFilter(method="filter_search")

    class Meta:
        model = Loan
        fields: list[str] = []

    def filter_status(self, queryset, name, value):
        if value == "active":
            return queryset.filter(returned_at__isnull=True)
        if value == "overdue":
            return queryset.filter(returned_at__isnull=True, due_date__lt=timezone.localdate())
        return queryset.filter(returned_at__isnull=False)

    def filter_member(self, queryset, name, value):
        # Members only ever see their own loans; the id is ignored for them.
        return queryset if _is_member(self.request) else queryset.filter(member_id=value)

    def filter_search(self, queryset, name, value):
        value = value.strip()
        if not value or _is_member(self.request):
            return queryset
        return queryset.filter(
            Q(member__email__icontains=value)
            | Q(member__first_name__icontains=value)
            | Q(member__last_name__icontains=value)
            | Q(copy__book__title__icontains=value)
            | Q(copy__barcode__icontains=value)
        )


class FineFilter(df.FilterSet):
    status = df.ChoiceFilter(choices=FineStatus.choices)
    reason = df.ChoiceFilter(choices=FineReason.choices)
    loan = df.NumberFilter(field_name="loan_id")
    member = df.NumberFilter(method="filter_member")

    class Meta:
        model = Fine
        fields: list[str] = []

    def filter_member(self, queryset, name, value):
        return queryset if _is_member(self.request) else queryset.filter(loan__member_id=value)
