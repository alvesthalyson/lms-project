from django.contrib import admin

from apps.core.admin_utils import ReadOnlyAdmin

from .models import Reservation


@admin.register(Reservation)
class ReservationAdmin(ReadOnlyAdmin):
    list_display = ("id", "member", "book", "status", "created_at", "expires_at")
    list_filter = ("status",)
    search_fields = ("member__email", "member__last_name", "book__title")
    list_select_related = ("member", "book")
