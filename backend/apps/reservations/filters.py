import django_filters as df

from apps.users.models import Role

from .models import ACTIVE_RESERVATION_STATUSES, Reservation, ReservationStatus


class ReservationFilter(df.FilterSet):
    status = df.ChoiceFilter(choices=ReservationStatus.choices)
    active = df.BooleanFilter(method="filter_active")
    member = df.NumberFilter(method="filter_member")
    book = df.NumberFilter(field_name="book_id")

    class Meta:
        model = Reservation
        fields: list[str] = []

    def filter_active(self, queryset, name, value):
        if value:
            return queryset.filter(status__in=ACTIVE_RESERVATION_STATUSES)
        return queryset.exclude(status__in=ACTIVE_RESERVATION_STATUSES)

    def filter_member(self, queryset, name, value):
        if getattr(self.request.user, "role", None) == Role.MEMBER:
            return queryset
        return queryset.filter(member_id=value)
