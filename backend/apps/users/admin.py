from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import BaseUserCreationForm, UserChangeForm as BaseUserChangeForm
from django.utils import timezone

from .models import Role, User


class UserCreationForm(BaseUserCreationForm):
    """Django's own forms are built for auth.User (with a username); ours signs in by e-mail."""

    class Meta:
        model = User
        fields = ("email", "first_name", "last_name", "role")


class UserChangeForm(BaseUserChangeForm):
    class Meta(BaseUserChangeForm.Meta):
        model = User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """Members and staff. `role` decides what the site lets a user do."""

    form = UserChangeForm
    add_form = UserCreationForm
    ordering = ("last_name", "first_name", "id")
    list_display = ("email", "full_name", "role", "member_number", "is_blocked", "is_active")
    list_filter = ("role", "is_blocked", "is_active")
    search_fields = ("email", "first_name", "last_name", "member_number")
    actions = ["block_selected", "unblock_selected"]

    # is_staff / is_superuser follow the role (see save_model), so they are shown, not edited.
    readonly_fields = ("member_number", "blocked_at", "is_staff", "is_superuser", "last_login", "date_joined")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal data", {"fields": ("first_name", "last_name", "phone", "address")}),
        ("Library", {"fields": ("role", "member_number", "is_blocked", "blocked_reason", "blocked_at")}),
        (
            "Permissions",
            {
                "fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions"),
                "description": "ADMIN users can sign in to this admin site; the other roles cannot.",
            },
        ),
        ("Dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "first_name", "last_name", "role", "password1", "password2"),
            },
        ),
    )

    @admin.display(description="Name", ordering="last_name")
    def full_name(self, obj: User) -> str:
        return obj.get_full_name() or "—"

    def save_model(self, request, obj, form, change):
        # Only the ADMIN role may open this admin site.
        obj.is_staff = obj.is_superuser = obj.role == Role.ADMIN
        super().save_model(request, obj, form, change)
        if obj.role == Role.MEMBER and not obj.member_number:
            obj.member_number = f"M-{obj.pk:06d}"
            obj.save(update_fields=["member_number"])

    @admin.action(description="Block selected users")
    def block_selected(self, request, queryset):
        updated = queryset.exclude(pk=request.user.pk).update(
            is_blocked=True, blocked_at=timezone.now(), blocked_reason="Blocked by an administrator"
        )
        self.message_user(request, f"{updated} user(s) blocked.", messages.SUCCESS)

    @admin.action(description="Unblock selected users")
    def unblock_selected(self, request, queryset):
        updated = queryset.update(is_blocked=False, blocked_at=None, blocked_reason="")
        self.message_user(request, f"{updated} user(s) unblocked.", messages.SUCCESS)
