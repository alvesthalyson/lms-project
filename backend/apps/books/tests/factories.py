import factory

from apps.books.models import Author, Book, BookCopy, Category, CopyStatus
from apps.books.services.inventory_service import sync_book_counts


def isbn13(n: int) -> str:
    """A VALID ISBN-13 (correct check digit), unique per n."""
    body = f"978{n:09d}"
    total = sum(int(digit) * (1 if i % 2 == 0 else 3) for i, digit in enumerate(body))
    return body + str((10 - total % 10) % 10)


class CategoryFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Category

    name = factory.Sequence(lambda n: f"Category {n}")
    slug = factory.Sequence(lambda n: f"category-{n}")


class AuthorFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Author

    name = factory.Sequence(lambda n: f"Author {n}")


class BookFactory(factory.django.DjangoModelFactory):
    """
    BookFactory()                              a title with no copies
    BookFactory(copies=3)                      three AVAILABLE copies, counters in sync (3 / 3)
    BookFactory(copies=1, copies__status=...)  one copy in another status (counters follow)
    BookFactory(authors=[a1, a2])              specific authors (default: one new author)
    """

    class Meta:
        model = Book
        skip_postgeneration_save = True

    title = factory.Sequence(lambda n: f"Book Title {n}")
    isbn = factory.Sequence(isbn13)
    publisher = "Test Press"
    publication_year = 2020
    category = factory.SubFactory(CategoryFactory)
    description = ""
    is_active = True

    @factory.post_generation
    def authors(self, create, extracted, **kwargs):
        if not create:
            return
        for author in extracted or [AuthorFactory()]:
            self.authors.add(author)

    @factory.post_generation
    def copies(self, create, extracted, **kwargs):
        if not create or not extracted:
            return
        BookCopyFactory.create_batch(extracted, book=self, **kwargs)
        sync_book_counts(self.pk)
        self.refresh_from_db()


class BookCopyFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = BookCopy

    book = factory.SubFactory(BookFactory)
    barcode = factory.Sequence(lambda n: f"BC-{n:06d}")
    status = CopyStatus.AVAILABLE
