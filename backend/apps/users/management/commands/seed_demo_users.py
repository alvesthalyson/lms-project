"""Demo accounts and a little activity, so the dashboard and loan desk have something to show.

DEVELOPMENT ONLY: the passwords are public (they are printed below), so the command
refuses to run unless DJANGO_DEBUG is on. Safe to repeat.
Run: python manage.py seed_demo_users
"""

from datetime import timedelta

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.books.models import Book
from apps.loans.models import Loan
from apps.loans.services import loan_service
from apps.reservations.services import reservation_service
from apps.users.models import Role, User
from apps.users.services.user_service import register_member

PASSWORD = "Demo-pass-123"

STAFF = [
    ("admin@example.com", "Ana", "Admin", Role.ADMIN),
    ("librarian@example.com", "Luis", "Librarian", Role.LIBRARIAN),
]
MEMBERS = [
    ("maria@example.com", "Maria", "Souza"),
    ("joao@example.com", "João", "Silva"),
    ("carla@example.com", "Carla", "Lima"),
]


class Command(BaseCommand):
    help = "Create demo staff and members, plus a few loans and a reservation (development only)."

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_demo_users only runs with DJANGO_DEBUG=true (the passwords are public).")

        call_command("seed_demo", verbosity=0)

        for email, first, last, role in STAFF:
            if User.objects.filter(email=email).exists():
                continue
            if role == Role.ADMIN:
                User.objects.create_superuser(email, PASSWORD, first_name=first, last_name=last)
            else:
                User.objects.create_user(email, PASSWORD, first_name=first, last_name=last, role=role)

        members = {}
        for email, first, last in MEMBERS:
            members[email] = User.objects.filter(email=email).first() or register_member(
                email=email, password=PASSWORD, first_name=first, last_name=last
            )

        self._demo_activity(members, User.objects.get(email="librarian@example.com"))

        self.stdout.write(self.style.SUCCESS("Demo accounts (password for all: %s):" % PASSWORD))
        for email, _, _, role in STAFF:
            self.stdout.write(f"  {role:<10} {email}")
        for email in members:
            self.stdout.write(f"  MEMBER     {email}")

    def _demo_activity(self, members, librarian) -> None:
        if Loan.objects.exists():
            return  # already has activity; do not pile more on top
        maria, joao, carla = members["maria@example.com"], members["joao@example.com"], members["carla@example.com"]

        # An ordinary loan, and one that is already late (the dashboard's "overdue" counter).
        loan_service.create_loan(member=maria, issued_by=librarian, book=Book.objects.get(isbn="9780132350884"))
        late = loan_service.create_loan(member=joao, issued_by=librarian, book=Book.objects.get(isbn="9788535911664"))
        Loan.objects.filter(pk=late.pk).update(
            loaned_at=timezone.now() - timedelta(days=20), due_date=timezone.localdate() - timedelta(days=5)
        )

        # A title with a single copy, lent out, with someone waiting in line for it.
        single = Book.objects.get(isbn="9789722036818")
        loan_service.create_loan(member=maria, issued_by=librarian, book=single)
        reservation_service.reserve(member=carla, book=single, requested_by=carla)
