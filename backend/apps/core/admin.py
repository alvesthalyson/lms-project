from django.contrib import admin

from .admin_utils import ReadOnlyAdmin
from .models import ActivityLog, LibrarySettings


@admin.register(LibrarySettings)
class LibrarySettingsAdmin(admin.ModelAdmin):
    """The one row of loan rules (period, renewals, limit, fine per day, hold time)."""

    list_display = ("__str__", "loan_period_days", "renewal_period_days", "max_renewals", "max_active_loans", "fine_per_day")

    def has_add_permission(self, request):
        return not LibrarySettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ActivityLog)
class ActivityLogAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "action", "actor", "member", "book")
    list_filter = ("action",)
    search_fields = ("member__email", "book__title")
    list_select_related = ("actor", "member", "book")
    date_hierarchy = "created_at"
