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


#: Nationality (ISO alpha-2) of the authors above, so the globe on the Home lights up.
AUTHOR_COUNTRY = {
    "Robert C. Martin": "US",
    "Andrew Hunt": "US",
    "Machado de Assis": "BR",
    "Clarice Lispector": "BR",
    "Paulo Coelho": "BR",
    "Carlos Drummond de Andrade": "BR",
    "Fernando Pessoa": "PT",
    "Stephen Hawking": "GB",
    "Carl Sagan": "US",
    "Yuval Noah Harari": "IL",
    "Gilberto Freyre": "BR",
    "Platão": "GR",
    "Friedrich Nietzsche": "DE",
    "E. H. Gombrich": "AT",
    "John Berger": "GB",
}

#: More titles from around the world, so the globe has many countries to visit.
#: (title, author, country, year, category, copies). ISBNs are valid placeholders, not the real ones.
WORLD_BOOKS = [
    ("Cem Anos de Solidão", "Gabriel García Márquez", "CO", 1967, "Romance", 2),
    ("Dom Quixote", "Miguel de Cervantes", "ES", 1605, "Romance", 2),
    ("Os Miseráveis", "Victor Hugo", "FR", 1862, "Romance", 2),
    ("O Pequeno Príncipe", "Antoine de Saint-Exupéry", "FR", 1943, "Fantasia", 3),
    ("Crime e Castigo", "Fiódor Dostoiévski", "RU", 1866, "Romance", 2),
    ("O Hobbit", "J. R. R. Tolkien", "GB", 1937, "Fantasia", 3),
    ("1984", "George Orwell", "GB", 1949, "Ficção", 3),
    ("A Metamorfose", "Franz Kafka", "CZ", 1915, "Ficção", 2),
    ("Ficções", "Jorge Luis Borges", "AR", 1944, "Ficção", 2),
    ("Pedro Páramo", "Juan Rulfo", "MX", 1955, "Ficção", 2),
    ("O Mundo se Despedaça", "Chinua Achebe", "NG", 1958, "Romance", 2),
    ("O Estrangeiro", "Albert Camus", "FR", 1942, "Filosofia", 2),
    ("Os Lusíadas", "Luís de Camões", "PT", 1572, "Poesia", 2),
    ("A Ilha do Tesouro", "Robert Louis Stevenson", "GB", 1883, "Aventura", 2),
    ("Sherlock Holmes: Um Estudo em Vermelho", "Arthur Conan Doyle", "GB", 1887, "Mistério", 2),
    ("Assassinato no Expresso do Oriente", "Agatha Christie", "GB", 1934, "Mistério", 2),
    ("Anna Karenina", "Liev Tolstói", "RU", 1878, "Romance", 2),
    ("A Casa dos Espíritos", "Isabel Allende", "CL", 1982, "Romance", 2),
    ("O Nome da Rosa", "Umberto Eco", "IT", 1980, "Mistério", 2),
    ("Orgulho e Preconceito", "Jane Austen", "GB", 1813, "Romance", 2),
    ("A Vida de Leonardo da Vinci", "Walter Isaacson", "US", 2017, "Biografia", 2),
    ("Mandela: Longa Caminhada até a Liberdade", "Nelson Mandela", "ZA", 1994, "Biografia", 2),
    ("O Diário de Anne Frank", "Anne Frank", "NL", 1947, "Biografia", 2),
]


def _placeholder_isbn(n: int) -> str:
    """A valid ISBN-13 (978-0-0001-0xxx-c) for the world books, which have no real ISBN here."""
    body = f"97800010{n:04d}"
    total = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(body))
    return body + str((10 - total % 10) % 10)


def _ensure_country(author: Author, country: str) -> None:
    """Fill the nationality of an author who has none yet (never overwrites one set by hand)."""
    if country and not author.country:
        author.country = country
        author.save(update_fields=["country", "updated_at"])


def _add_book(*, title, author_name, country, isbn, year, cat_name, copies) -> bool:
    category, _ = Category.objects.get_or_create(slug=slugify(cat_name), defaults={"name": cat_name})
    author, _ = Author.objects.get_or_create(name=author_name)
    _ensure_country(author, country)
    book, was_created = Book.objects.get_or_create(
        isbn=isbn,
        defaults={"title": title, "publication_year": year, "category": category, "publisher": "Edição demo"},
    )
    book.authors.add(author)
    if was_created:
        for n in range(1, copies + 1):
            BookCopy.objects.create(book=book, barcode=f"DEMO-{isbn}-{n}")
        sync_book_counts(book.pk)
    return was_created


class Command(BaseCommand):
    help = "Create demo authors, books and copies (idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        call_command("seed_categories", verbosity=0)
        created = 0
        for title, author_name, isbn, year, cat_name, copies in DEMO_BOOKS:
            created += _add_book(
                title=title, author_name=author_name, country=AUTHOR_COUNTRY.get(author_name, ""),
                isbn=isbn, year=year, cat_name=cat_name, copies=copies,
            )
        for n, (title, author_name, country, year, cat_name, copies) in enumerate(WORLD_BOOKS, start=1):
            created += _add_book(
                title=title, author_name=author_name, country=country,
                isbn=_placeholder_isbn(n), year=year, cat_name=cat_name, copies=copies,
            )
        total = len(DEMO_BOOKS) + len(WORLD_BOOKS)
        self.stdout.write(self.style.SUCCESS(f"{created} new demo books ({total} total)."))
