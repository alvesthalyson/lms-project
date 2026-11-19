"""Add the most famous books of Sri Lanka, Nepal, Bangladesh, China, Mongolia, Brazil and Japan.

For each country the list in `apps/books/famous.py` is walked in order of fame; a title only counts when Open Library
has a real cover photo for it, and the first five that do are kept. Books the library already has are left alone.

    python manage.py seed_famous_books [--dry-run] [--copies 2] [--country JP --country BR]
"""

import time

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from apps.books.famous import COUNTRY_NAMES, FAMOUS, PER_COUNTRY
from apps.books.isbn import to_isbn10
from apps.books.models import Book, Category
from apps.books.services import import_service, openlibrary

PAUSE = 0.4
MAX_NETWORK_FAILURES = 3


def already_have(candidate: dict, title: str, author: str) -> bool:
    """Same ISBN (either form), or the same title by an author with the same name."""
    isbns = {candidate["isbn"]}
    twin = to_isbn10(candidate["isbn"])
    if twin:
        isbns.add(twin)
    if Book.objects.filter(isbn__in=isbns).exists():
        return True
    wanted = openlibrary._normalize(openlibrary.base_title(title))
    for book in Book.objects.filter(authors__name__iexact=author).only("title"):
        if openlibrary._normalize(openlibrary.base_title(book.title)) == wanted:
            return True
    return False


class Command(BaseCommand):
    help = "Add the most famous books (with real cover photos) of seven countries."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--copies", type=int, default=2)
        parser.add_argument("--country", action="append", choices=sorted(FAMOUS), help="Only these (repeatable).")

    def handle(self, *args, **options):
        call_command("seed_categories", verbosity=0)
        categories = {c.slug: c for c in Category.objects.all()}
        failures = 0
        added = skipped = short = 0

        for code in options["country"] or list(FAMOUS):
            self.stdout.write(self.style.MIGRATE_HEADING(f"\n{COUNTRY_NAMES[code]} ({code})"))
            kept = 0
            for title, author, slug in FAMOUS[code]:
                if kept >= PER_COUNTRY:
                    break
                time.sleep(PAUSE)
                try:
                    edition = openlibrary.find_edition_with_cover(title=title, author=author)
                except openlibrary.NetworkProblem as exc:
                    failures += 1
                    self.stdout.write(self.style.WARNING(f"  {title}: could not reach Open Library ({exc})"))
                    if failures >= MAX_NETWORK_FAILURES:
                        raise CommandError("Open Library did not answer 3 times. Check your connection.") from exc
                    continue
                failures = 0
                if edition is None:
                    self.stdout.write(f"  - {title}: no edition with a cover photo, skipped")
                    continue
                kept += 1  # it is one of the five, whether or not it is new
                if already_have(edition, title, author):
                    skipped += 1
                    self.stdout.write(f"  = {title}: already in the catalogue, ignored")
                    continue
                if options["dry_run"]:
                    self.stdout.write(f"  + {title} ({author}): would add, ISBN {edition['isbn']}")
                    added += 1
                    continue
                import_service.import_book(
                    {
                        "isbn": edition["isbn"],
                        "title": title,
                        "author_names": [author],
                        "publisher": edition["publisher"],
                        "publication_year": edition["publication_year"],
                        "pages": edition["pages"],
                        "description": "",
                        "cover_url": edition["cover_url"],
                        "category": categories[slug],
                        "copies": options["copies"],
                        "author_country": code,
                    }
                )
                added += 1
                self.stdout.write(self.style.SUCCESS(f"  + {title} ({author}): added"))
            if kept < PER_COUNTRY:
                short += 1
                self.stdout.write(self.style.WARNING(f"  only {kept} of {PER_COUNTRY} had a cover photo on Open Library"))

        verb = "would be added" if options["dry_run"] else "added"
        self.stdout.write(f"\nDone. Books {verb}: {added}. Already in the catalogue: {skipped}. Countries with fewer than {PER_COUNTRY}: {short}.")
