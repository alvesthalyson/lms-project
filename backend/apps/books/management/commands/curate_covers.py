"""Make sure every book has a real cover photo; remove the ones that cannot get one.

For each active book with no cover (or whose cover link no longer works) it looks for an edition on Open Library
that has a photo, by ISBN first and then by title and author. If it finds none, the book is removed:
deleted for good when nothing ever happened to it (no loans or reservations), otherwise just taken off the shelves (inactive),
and left alone when copies are out on loan right now.

    python manage.py curate_covers            # only shows what it would do
    python manage.py curate_covers --apply    # does it
"""

import time

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.books.models import Book
from apps.books.services import book_service, openlibrary
from apps.core.exceptions import BusinessRuleError
from apps.loans.models import Loan
from apps.reservations.models import Reservation

PAUSE = 0.4
MAX_NETWORK_FAILURES = 3


def has_working_cover(book: Book) -> bool:
    if book.cover_image:
        return True
    return bool(book.cover_url) and openlibrary.cover_exists(book.cover_url)


def replacement_cover(book: Book) -> str | None:
    first = book.authors.first()
    url = openlibrary.find_cover_url(isbn=book.isbn, title=book.title, author=first.name if first else "")
    if url and openlibrary.cover_exists(url):
        return url
    edition = openlibrary.find_edition_with_cover(title=book.title, author=first.name if first else "")
    return edition["cover_url"] if edition else None


@transaction.atomic
def remove_book(book: Book) -> str:
    """'deleted', 'deactivated' or 'kept (on loan)'."""
    if Loan.objects.filter(copy__book=book).exists() or Reservation.objects.filter(book=book).exists():
        try:
            book_service.deactivate_book(book)
        except BusinessRuleError:
            return "kept (copies are on loan right now)"
        return "deactivated (it has loan or reservation history)"
    book.copies.all().delete()
    book.delete()
    return "deleted"


class Command(BaseCommand):
    help = "Give every book a real cover photo, or remove the book."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Make the changes (default: only report).")

    def handle(self, *args, **options):
        books = list(Book.objects.filter(is_active=True).prefetch_related("authors").order_by("id"))
        fixed = removed = ok = 0
        failures = 0
        for index, book in enumerate(books):
            if index:
                time.sleep(PAUSE)
            try:
                if has_working_cover(book):
                    ok += 1
                    continue
                url = replacement_cover(book)
            except openlibrary.NetworkProblem as exc:
                failures += 1
                self.stdout.write(self.style.WARNING(f"{book.title}: could not reach Open Library ({exc}); left as it is"))
                if failures >= MAX_NETWORK_FAILURES:
                    raise CommandError("Open Library did not answer 3 times. Nothing else was changed.") from exc
                continue
            failures = 0
            if url:
                fixed += 1
                self.stdout.write(self.style.SUCCESS(f"{book.title}: {'new cover ' + url if options['apply'] else 'would get ' + url}"))
                if options["apply"]:
                    book.cover_url = url
                    book.save(update_fields=["cover_url", "updated_at"])
                continue
            removed += 1
            if options["apply"]:
                self.stdout.write(self.style.WARNING(f"{book.title}: no cover photo anywhere -> {remove_book(book)}"))
            else:
                self.stdout.write(self.style.WARNING(f"{book.title}: no cover photo anywhere -> would be removed"))

        mode = "" if options["apply"] else " (dry run: nothing changed, add --apply)"
        self.stdout.write(f"\nDone{mode}. Already fine: {ok}. Cover fixed: {fixed}. Removed: {removed}.")
