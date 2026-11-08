import pytest
from django.contrib import admin as django_admin
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import Client
from django.urls import reverse

from apps.books.admin import BookCopyForm
from apps.books.models import CopyStatus
from apps.books.tests.factories import BookCopyFactory, BookFactory
from apps.loans.models import Loan
from apps.reservations.models import Reservation
from apps.users.models import Role, User
from apps.users.tests.factories import MemberFactory

pytestmark = pytest.mark.django_db

OURS = ("users", "books", "loans", "reservations", "core")


@pytest.fixture
def admin_client(db):
    user = User.objects.create_superuser("root@example.com", "S3cure-passphrase", first_name="Root", last_name="User")
    client = Client()
    client.force_login(user)
    return client


def test_createsuperuser_gets_the_admin_role():
    user = User.objects.create_superuser("root@example.com", "x", first_name="A", last_name="B")
    assert user.role == Role.ADMIN


def test_every_model_page_opens(admin_client):
    BookFactory(copies=2)
    models = [m for m in django_admin.site._registry if m._meta.app_label in OURS]
    assert len(models) >= 10
    for model in models:
        url = reverse(f"admin:{model._meta.app_label}_{model._meta.model_name}_changelist")
        assert admin_client.get(url).status_code == 200, url


def test_book_page_and_add_user_page_open(admin_client):
    book = BookFactory(copies=1)
    assert admin_client.get(reverse("admin:books_book_change", args=[book.pk])).status_code == 200
    assert admin_client.get(reverse("admin:users_user_add")).status_code == 200
    assert admin_client.get(reverse("admin:books_book_add")).status_code == 200


def test_creating_a_member_gets_a_card_number(admin_client):
    response = admin_client.post(
        reverse("admin:users_user_add"),
        {
            "email": "new@example.com",
            "first_name": "New",
            "last_name": "Member",
            "role": "MEMBER",
            "password1": "S3cure-passphrase-9",
            "password2": "S3cure-passphrase-9",
        },
    )
    assert response.status_code == 302
    user = User.objects.get(email="new@example.com")
    assert user.member_number == f"M-{user.pk:06d}"
    assert not user.is_staff


def test_only_the_admin_role_can_open_the_admin_site(admin_client):
    member = MemberFactory()
    member.role = Role.LIBRARIAN
    member.save()
    from apps.users.admin import UserAdmin

    UserAdmin(User, django_admin.site).save_model(None, member, None, True)
    member.refresh_from_db()
    assert member.is_staff is False and member.is_superuser is False


def test_block_action(admin_client):
    member = MemberFactory()
    admin_client.post(
        reverse("admin:users_user_changelist"),
        {"action": "block_selected", "_selected_action": [member.pk]},
    )
    member.refresh_from_db()
    assert member.is_blocked is True and member.blocked_at is not None


class TestCopyForm:
    def data(self, status):
        return {"barcode": "X-1", "status": status, "condition_notes": "", "acquired_at": ""}

    def test_cannot_mark_a_copy_on_loan_by_hand(self):
        assert not BookCopyForm(data=self.data(CopyStatus.ON_LOAN)).is_valid()

    def test_cannot_free_a_copy_that_is_on_loan(self):
        copy = BookCopyFactory(status=CopyStatus.ON_LOAN)
        assert not BookCopyForm(data=self.data(CopyStatus.AVAILABLE), instance=copy).is_valid()

    def test_can_withdraw_an_available_copy(self):
        copy = BookCopyFactory(barcode="X-1")
        assert BookCopyForm(data=self.data(CopyStatus.LOST), instance=copy).is_valid()


class TestSeedDemoUsers:
    def test_refuses_outside_debug(self, settings):
        settings.DEBUG = False
        with pytest.raises(CommandError):
            call_command("seed_demo_users")

    def test_creates_accounts_and_activity_and_is_repeatable(self, settings):
        settings.DEBUG = True
        call_command("seed_demo_users", verbosity=0)
        call_command("seed_demo_users", verbosity=0)

        admin_user = User.objects.get(email="admin@example.com")
        assert admin_user.role == Role.ADMIN and admin_user.is_superuser
        assert User.objects.get(email="librarian@example.com").role == Role.LIBRARIAN
        assert User.objects.filter(role=Role.MEMBER).count() == 3
        assert Loan.objects.count() == 3
        assert Loan.objects.overdue().count() == 1
        assert Reservation.objects.filter(status="PENDING").count() == 1
