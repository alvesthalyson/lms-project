from io import StringIO
from unittest import mock

import pytest
from django.core.management import call_command

from apps.books.famous import FAMOUS, PER_COUNTRY
from apps.books.models import Book
from apps.books.services import openlibrary
from apps.books.tests.factories import AuthorFactory, BookFactory, BookCopyFactory, CategoryFactory

pytestmark = pytest.mark.django_db


def edition(title, isbn, cover="https://covers.openlibrary.org/b/id/1-L.jpg"):
    return {"isbn": isbn, "title": title, "authors": [], "publisher": "P", "publication_year": 2000, "pages": 300, "cover_url": cover, "subjects": []}


def fake_find(covered: set[str]):
    """find_edition_with_cover: an edition only for the titles in `covered`, with an ISBN made from the title."""
    count = iter(range(1, 10_000))

    def find(*, title, author):
        if title not in covered:
            return None
        n = next(count)
        digits = f"97800{n:07d}"
        total = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(digits))
        return edition(title, digits + str((10 - total % 10) % 10))

    return find


@pytest.fixture(autouse=True)
def no_sleep():
    with mock.patch("time.sleep"):
        yield


class TestSeedFamousBooks:
    def test_keeps_the_first_five_with_a_cover_photo_and_sets_the_author_country(self):
        titles = [t for t, _, _ in FAMOUS["JP"]]
        covered = set(titles[1:])  # the most famous one has no photo: it is skipped, the sixth takes its place
        with mock.patch.object(openlibrary, "find_edition_with_cover", side_effect=fake_find(covered)):
            call_command("seed_famous_books", country=["JP"], stdout=StringIO())
        books = Book.objects.all()
        assert books.count() == PER_COUNTRY
        assert not books.filter(title=titles[0]).exists()
        assert all(b.cover_url.startswith("https://covers.openlibrary.org/") for b in books)
        assert all(b.total_copies == 2 for b in books)
        assert {a.country for b in books for a in b.authors.all()} == {"JP"}

    def test_a_book_already_in_the_catalogue_is_ignored_not_replaced(self):
        title, author, _ = FAMOUS["BR"][0]
        have = BookFactory(title=title)
        have.authors.set([AuthorFactory(name=author)])
        covered = {t for t, _, _ in FAMOUS["BR"]}
        with mock.patch.object(openlibrary, "find_edition_with_cover", side_effect=fake_find(covered)):
            call_command("seed_famous_books", country=["BR"], stdout=StringIO())
        assert Book.objects.count() == 1 + (PER_COUNTRY - 1)
        assert Book.objects.filter(title=title).count() == 1

    def test_dry_run_changes_nothing(self):
        covered = {t for t, _, _ in FAMOUS["NP"]}
        out = StringIO()
        with mock.patch.object(openlibrary, "find_edition_with_cover", side_effect=fake_find(covered)):
            call_command("seed_famous_books", country=["NP"], dry_run=True, stdout=out)
        assert Book.objects.count() == 0
        assert "would add" in out.getvalue()

    def test_running_it_twice_adds_nothing_new(self):
        covered = {t for t, _, _ in FAMOUS["CN"]}
        for _ in range(2):
            with mock.patch.object(openlibrary, "find_edition_with_cover", side_effect=fake_find(covered)):
                call_command("seed_famous_books", country=["CN"], stdout=StringIO())
        assert Book.objects.count() == PER_COUNTRY


class TestCurateCovers:
    def run(self, *, apply=True, replacement=None, exists=True):
        with (
            mock.patch.object(openlibrary, "cover_exists", return_value=exists),
            mock.patch.object(openlibrary, "find_cover_url", return_value=replacement),
            mock.patch.object(openlibrary, "find_edition_with_cover", return_value=None),
        ):
            call_command("curate_covers", apply=apply, stdout=StringIO())

    def test_leaves_books_with_a_working_cover_alone(self):
        BookFactory(cover_url="https://covers.openlibrary.org/b/id/9-L.jpg")
        self.run()
        assert Book.objects.count() == 1

    def test_gives_a_coverless_book_a_cover_when_one_exists(self):
        book = BookFactory(cover_url="")
        self.run(replacement="https://covers.openlibrary.org/b/id/7-L.jpg")
        book.refresh_from_db()
        assert book.cover_url.endswith("/7-L.jpg")

    def test_deletes_a_coverless_book_nobody_ever_used(self):
        BookCopyFactory(book=BookFactory(cover_url=""))
        self.run()
        assert Book.objects.count() == 0

    def test_dry_run_only_reports(self):
        BookFactory(cover_url="")
        self.run(apply=False)
        assert Book.objects.count() == 1

    def test_a_broken_cover_link_counts_as_no_cover(self):
        BookFactory(cover_url="https://covers.openlibrary.org/b/id/404-L.jpg")
        self.run(exists=False)
        assert Book.objects.count() == 0
