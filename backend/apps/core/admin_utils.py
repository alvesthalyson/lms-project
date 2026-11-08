"""Shared helpers for the Django admin."""

from django.contrib import admin


class ReadOnlyAdmin(admin.ModelAdmin):
    """
    Browse and search only. Loans, reservations, fines and the activity log are
    changed through the services (the site's loan desk), which enforce the rules
    and keep the book counters right; a free-form edit here could break both.
    """

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
