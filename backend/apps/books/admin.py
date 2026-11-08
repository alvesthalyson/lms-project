from django import forms
from django.contrib import admin, messages
from django.db.models import Count

from apps.books.models import Author, Book, BookCopy, Category, CopyStatus
from apps.books.services.inventory_service import lock_book, sync_book_counts
from apps.core.admin_utils import ReadOnlyAdmin

LOCKED_STATUSES = (CopyStatus.ON_LOAN, CopyStatus.ON_HOLD)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "book_count")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_books=Count("books"))

    @admin.display(description="Books", ordering="_books")
    def book_count(self, obj) -> int:
        return obj._books


@admin.register(Author)
class AuthorAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


class BookCopyForm(forms.ModelForm):
    class Meta:
        model = BookCopy
        fields = ("barcode", "status", "condition_notes", "acquired_at")

    def clean_status(self):
        """ON_LOAN and ON_HOLD belong to the loan and reservation services, not to a form."""
        status = self.cleaned_data["status"]
        before = self.instance.status if self.instance.pk else None
        if status != before and (status in LOCKED_STATUSES or before in LOCKED_STATUSES):
            raise forms.ValidationError(
                "On loan / on hold is set by loans and reservations. Return the loan or cancel the "
                "reservation on the site instead."
            )
        return status


class BookCopyInline(admin.TabularInline):
    model = BookCopy
    form = BookCopyForm
    extra = 0
    show_change_link = False


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("title", "isbn", "category", "total_copies", "available_copies", "is_active")
    list_filter = ("category", "is_active")
    search_fields = ("title", "isbn", "authors__name")
    list_select_related = ("category",)
    filter_horizontal = ("authors",)
    readonly_fields = ("total_copies", "available_copies", "created_at", "updated_at")
    inlines = [BookCopyInline]
    actions = ["deactivate", "activate"]

    def has_delete_permission(self, request, obj=None):
        # Titles are withdrawn (is_active=False), never erased: loans and fines keep pointing at them.
        return False

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        # Copies were edited: recompute the counters under the same row lock the services use.
        lock_book(form.instance.pk)
        sync_book_counts(form.instance.pk)

    @admin.action(description="Withdraw selected titles from the catalogue")
    def deactivate(self, request, queryset):
        busy = queryset.filter(copies__status__in=LOCKED_STATUSES).distinct()
        if busy.exists():
            self.message_user(
                request, "Some titles have copies on loan or on hold; nothing was changed.", messages.ERROR
            )
            return
        self.message_user(request, f"{queryset.update(is_active=False)} title(s) withdrawn.", messages.SUCCESS)

    @admin.action(description="Put selected titles back in the catalogue")
    def activate(self, request, queryset):
        self.message_user(request, f"{queryset.update(is_active=True)} title(s) restored.", messages.SUCCESS)


@admin.register(BookCopy)
class BookCopyAdmin(ReadOnlyAdmin):
    """Barcode lookup. Edit copies inside their book."""

    list_display = ("barcode", "book", "status")
    list_filter = ("status",)
    search_fields = ("barcode", "book__title", "book__isbn")
    list_select_related = ("book",)
