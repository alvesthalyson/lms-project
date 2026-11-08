from django.contrib import admin
from django.utils import timezone

from apps.core.admin_utils import ReadOnlyAdmin

from .models import Fine, Loan


class LoanStatusFilter(admin.SimpleListFilter):
    title = "status"
    parameter_name = "status"

    def lookups(self, request, model_admin):
        return [("active", "Active"), ("overdue", "Overdue"), ("returned", "Returned")]

    def queryset(self, request, queryset):
        if self.value() == "active":
            return queryset.filter(returned_at__isnull=True)
        if self.value() == "overdue":
            return queryset.filter(returned_at__isnull=True, due_date__lt=timezone.localdate())
        if self.value() == "returned":
            return queryset.filter(returned_at__isnull=False)
        return queryset


@admin.register(Loan)
class LoanAdmin(ReadOnlyAdmin):
    list_display = ("id", "member", "book_title", "loaned_at", "due_date", "returned_at", "renewal_count")
    list_filter = (LoanStatusFilter,)
    search_fields = ("member__email", "member__first_name", "member__last_name", "copy__barcode", "copy__book__title")
    list_select_related = ("member", "copy__book")
    date_hierarchy = "loaned_at"

    @admin.display(description="Book", ordering="copy__book__title")
    def book_title(self, obj) -> str:
        return obj.copy.book.title


@admin.register(Fine)
class FineAdmin(ReadOnlyAdmin):
    list_display = ("id", "member", "reason", "amount", "status", "created_at")
    list_filter = ("status", "reason")
    search_fields = ("loan__member__email", "loan__member__last_name", "loan__copy__book__title")
    list_select_related = ("loan__member", "loan__copy__book")

    @admin.display(description="Member", ordering="loan__member__last_name")
    def member(self, obj) -> str:
        return str(obj.loan.member)
