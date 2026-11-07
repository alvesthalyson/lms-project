"""Create the default shelves (categories) of the library. Safe to run any number of times."""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from apps.books.models import Category

#: The shelves of the main reading room, in the order they appear on the Home map.
#: The first four were already in use; the last four are the new ones.
DEFAULT_CATEGORIES: tuple[str, ...] = (
    "Programação",
    "Ficção",
    "Poesia",
    "Ciência",
    "História",
    "Filosofia",
    "Arte",
    "Romance",
)


class Command(BaseCommand):
    help = "Create the default library categories if they do not exist yet (idempotent)."

    @transaction.atomic
    def handle(self, *args: object, **options: object) -> None:
        created = 0
        for name in DEFAULT_CATEGORIES:
            _, was_created = Category.objects.get_or_create(
                slug=slugify(name), defaults={"name": name}
            )
            created += int(was_created)
        self.stdout.write(
            self.style.SUCCESS(
                f"{created} category(ies) created, {len(DEFAULT_CATEGORIES) - created} already existed."
            )
        )
