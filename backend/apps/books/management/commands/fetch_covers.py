"""Fill Book.cover_url from Open Library (ISBN first, then title + author). Nothing is downloaded.

    python manage.py fetch_covers --dry-run | (no flag) | --force | --limit 20
"""

import time

from django.core.management.base import BaseCommand, CommandError

from apps.books.models import Book
from apps.books.services import openlibrary

PAUSE = 0.5
MAX_NETWORK_FAILURES = 3


class Command(BaseCommand):
    help = "Fill in book cover URLs from Open Library."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--force", action="store_true", help="Also replace covers already set.")
        parser.add_argument("--limit", type=int, default=0)

    def handle(self, *args, **options):
        books = Book.objects.filter(is_active=True).prefetch_related("authors").order_by("id")
        if not options["force"]:
            books = books.filter(cover_url="", cover_image="")
        if options["limit"]:
            books = books[: options["limit"]]
        books = list(books)
        if not books:
            self.stdout.write("Every book already has a cover. Use --force to replace them.")
            return

        found = missing = failures = 0
        for index, book in enumerate(books):
            if index:
                time.sleep(PAUSE)
            first = book.authors.first()
            try:
                url = openlibrary.find_cover_url(
                    isbn=book.isbn, title=book.title, author=first.name if first else ""
                )
            except openlibrary.NetworkProblem as exc:
                failures += 1
                self.stdout.write(self.style.WARNING(f"{book.title}: could not reach Open Library ({exc})"))
                if failures >= MAX_NETWORK_FAILURES:
                    raise CommandError("Open Library did not answer 3 times. Check your connection.") from exc
                continue
            failures = 0
            if url is None:
                missing += 1
                self.stdout.write(f"{book.title}: no cover found")
                continue
            found += 1
            if options["dry_run"]:
                self.stdout.write(f"{book.title}: would use {url}")
            else:
                book.cover_url = url
                book.save(update_fields=["cover_url", "updated_at"])
                self.stdout.write(self.style.SUCCESS(f"{book.title}: saved {url}"))
        verb = "found" if options["dry_run"] else "saved"
        self.stdout.write(f"Done. Covers {verb}: {found}. No cover found: {missing}.")
