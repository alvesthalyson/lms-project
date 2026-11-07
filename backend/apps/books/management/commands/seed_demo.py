"""Demo catalogue: authors, books and copies, so the Home shelves are not empty.

Idempotent: books are matched by ISBN, authors and categories by name/slug.
Run: python manage.py seed_demo
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from apps.books.models import Author, Book, BookCopy, Category
from apps.books.services.inventory_service import sync_book_counts

# (title, author, isbn, year, category, copies)
DEMO_BOOKS = [
    ("Código Limpo", "Robert C. Martin", "9780132350884", 2008, "Programação", 3),
    ("O Programador Pragmático", "Andrew Hunt", "9780201616224", 1999, "Programação", 2),
    ("Dom Casmurro", "Machado de Assis", "9788535911664", 1899, "Romance", 4),
    ("Memórias Póstumas de Brás Cubas", "Machado de Assis", "9788535910667", 1881, "Romance", 2),
    ("A Hora da Estrela", "Clarice Lispector", "9788532508584", 1977, "Ficção", 2),
    ("O Alquimista", "Paulo Coelho", "9788576653660", 1988, "Ficção", 3),
    ("Antologia Poética", "Carlos Drummond de Andrade", "9788535914054", 1962, "Poesia", 2),
    ("Poesias Completas", "Fernando Pessoa", "9789722036818", 1942, "Poesia", 1),
    ("Uma Breve História do Tempo", "Stephen Hawking", "9788580575323", 1988, "Ciência", 2),
    ("Cosmos", "Carl Sagan", "9788535933413", 1980, "Ciência", 3),
    ("Sapiens", "Yuval Noah Harari", "9788525432186", 2011, "História", 5),
    ("Casa-Grande & Senzala", "Gilberto Freyre", "9788526020733", 1933, "História", 1),
    ("A República", "Platão", "9788572328067", None, "Filosofia", 2),
    ("Assim Falou Zaratustra", "Friedrich Nietzsche", "9788535912005", 1883, "Filosofia", 2),
    ("A História da Arte", "E. H. Gombrich", "9788521618164", 1950, "Arte", 2),
    ("Modos de Ver", "John Berger", "9788578270384", 1972, "Arte", 1),
]


class Command(BaseCommand):
    help = "Create demo authors, books and copies (idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        call_command("seed_categories", verbosity=0)
        created = 0
        for title, author_name, isbn, year, cat_name, copies in DEMO_BOOKS:
            category, _ = Category.objects.get_or_create(
                slug=slugify(cat_name), defaults={"name": cat_name}
            )
            author, _ = Author.objects.get_or_create(name=author_name)
            book, was_created = Book.objects.get_or_create(
                isbn=isbn,
                defaults={
                    "title": title,
                    "publication_year": year,
                    "category": category,
                    "publisher": "Edição demo",
                },
            )
            book.authors.add(author)
            if was_created:
                created += 1
                for n in range(1, copies + 1):
                    BookCopy.objects.create(book=book, barcode=f"DEMO-{isbn}-{n}")
                sync_book_counts(book.pk)
        self.stdout.write(self.style.SUCCESS(f"{created} new demo books ({len(DEMO_BOOKS)} total)."))
