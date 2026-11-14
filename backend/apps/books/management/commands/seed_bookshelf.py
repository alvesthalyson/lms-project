"""Add the five Bookshelf school-project novels to the catalogue (idempotent, 2 copies each).

Bookshelf mostly had no ISBN, so those titles get a valid placeholder ISBN-13 (978-0-00000-xxx-c).
Run `fetch_covers` afterwards to get covers.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from apps.books.models import Author, Book, BookCopy, Category
from apps.books.services.inventory_service import sync_book_counts


def _isbn13(body12: str) -> str:
    total = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(body12))
    return body12 + str((10 - total % 10) % 10)


# (title, author, year, isbn or None, description)
BOOKS = [
    ("Kafka on the Shore", "Haruki Murakami", 2002, "9781400079278",
     "A teenage runaway and an elderly man who talks to cats follow separate, strange paths that slowly converge."),
    ("Norwegian Wood", "Haruki Murakami", 1987, None,
     "A man looks back on love, loss and friendship during his university years in 1960s Tokyo."),
    ("Kokoro", "Natsume Soseki", 1914, None,
     "A student's friendship with an older man he calls Sensei leads to a confession about guilt and isolation after the Meiji era."),
    ("Noli Me Tangere", "Jose Rizal", 1887, None,
     "A young man returns to the Philippines from Europe and confronts abuse by the colonial authorities and the church."),
    ("El Filibusterismo", "Jose Rizal", 1891, None,
     "The sequel to Noli Me Tangere, following a vengeful return and a plot against the colonial order."),
]
COPIES = 2


class Command(BaseCommand):
    help = "Add the Bookshelf demo novels (idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        category, _ = Category.objects.get_or_create(slug=slugify("Romance"), defaults={"name": "Romance"})
        created = 0
        for n, (title, author_name, year, isbn, description) in enumerate(BOOKS, start=1):
            if isbn is None:
                isbn = _isbn13(f"978000000{n:03d}")
            author, _ = Author.objects.get_or_create(name=author_name)
            book, was_created = Book.objects.get_or_create(
                isbn=isbn,
                defaults={"title": title, "publication_year": year, "category": category, "description": description},
            )
            if was_created:
                created += 1
                book.authors.add(author)
                for i in range(1, COPIES + 1):
                    BookCopy.objects.create(book=book, barcode=f"BKS{n:02d}{i:02d}")
                sync_book_counts(book.pk)
        self.stdout.write(self.style.SUCCESS(f"Bookshelf novels: {created} new, {len(BOOKS) - created} already there."))
