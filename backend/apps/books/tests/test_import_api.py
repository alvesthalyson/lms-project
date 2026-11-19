from unittest import mock

import pytest
from rest_framework.test import APIClient

from apps.books.models import Author, Book
from apps.books.services import openlibrary
from apps.books.services.import_service import suggest_category_slug
from apps.books.tests.factories import AuthorFactory, BookFactory, CategoryFactory

pytestmark = pytest.mark.django_db

CLEAN_CODE = {
    "title": "Clean Code",
    "author_name": ["Robert C. Martin"],
    "first_publish_year": 2008,
    "isbn": ["0132350882", "9780132350884"],
    "publisher": ["Prentice Hall"],
    "number_of_pages_median": 464,
    "cover_i": 123,
    "subject": ["Computer programming", "Software engineering"],
}


def as_user(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def fake_open_library(*docs):
    return mock.patch.object(openlibrary, "_get_json", return_value={"docs": list(docs)})


class TestLookup:
    def test_only_librarians_can_look_up(self, member):
        assert APIClient().get("/api/v1/books/lookup/", {"title": "x"}).status_code == 401
        assert as_user(member).get("/api/v1/books/lookup/", {"title": "x"}).status_code == 403

    def test_needs_something_to_look_for(self, librarian):
        r = as_user(librarian).get("/api/v1/books/lookup/")
        assert r.status_code == 400

    def test_returns_candidates_with_cover_isbn13_and_a_suggested_category(self, librarian):
        prog = CategoryFactory(name="Programação", slug="programacao")
        with fake_open_library(CLEAN_CODE):
            r = as_user(librarian).get("/api/v1/books/lookup/", {"title": "clean code"})
        assert r.status_code == 200
        [row] = r.json()["results"]
        assert row["isbn"] == "9780132350884"
        assert row["title"] == "Clean Code"
        assert row["authors"] == ["Robert C. Martin"]
        assert row["publication_year"] == 2008 and row["pages"] == 464
        assert row["cover_url"] == "https://covers.openlibrary.org/b/id/123-L.jpg"
        assert row["suggested_category_id"] == prog.pk
        assert row["in_catalogue"] is None

    def test_marks_books_the_library_already_has(self, librarian):
        have = BookFactory(isbn="9780132350884")
        with fake_open_library(CLEAN_CODE):
            r = as_user(librarian).get("/api/v1/books/lookup/", {"isbn": "0-13-235088-2"})
        assert r.json()["results"][0]["in_catalogue"] == have.pk

    def test_isbn_search_asks_open_library_for_the_isbn13(self, librarian):
        with fake_open_library(CLEAN_CODE) as get:
            as_user(librarian).get("/api/v1/books/lookup/", {"isbn": "0132350882"})
        assert "isbn%3A9780132350884" in get.call_args.args[0]

    def test_an_invalid_isbn_finds_nothing_without_calling_out(self, librarian):
        with fake_open_library(CLEAN_CODE) as get:
            r = as_user(librarian).get("/api/v1/books/lookup/", {"isbn": "123"})
        assert r.json() == {"results": []}
        get.assert_not_called()

    def test_open_library_being_down_is_a_503_with_a_code(self, librarian):
        with mock.patch.object(openlibrary, "_get_json", side_effect=openlibrary.NetworkProblem("down")):
            r = as_user(librarian).get("/api/v1/books/lookup/", {"title": "x"})
        assert r.status_code == 503
        assert r.json()["code"] == "lookup_unavailable"


def payload(**over):
    body = {
        "isbn": "9780132350884",
        "title": "Clean Code",
        "author_names": ["Robert C. Martin"],
        "publisher": "Prentice Hall",
        "publication_year": 2008,
        "pages": 464,
        "cover_url": "https://covers.openlibrary.org/b/id/123-L.jpg",
        "category_id": CategoryFactory().pk,
        "copies": 2,
    }
    body.update(over)
    return body


class TestImport:
    def test_only_librarians_can_import(self, member):
        assert as_user(member).post("/api/v1/books/import/", payload(), format="json").status_code == 403

    def test_creates_the_book_the_author_and_the_copies(self, librarian):
        r = as_user(librarian).post("/api/v1/books/import/", payload(author_country="us"), format="json")
        assert r.status_code == 201, r.json()
        book = Book.objects.get(isbn="9780132350884")
        assert book.cover_url == "https://covers.openlibrary.org/b/id/123-L.jpg"
        assert (book.total_copies, book.available_copies) == (2, 2)
        assert r.json()["title"] == "Clean Code"
        [author] = book.authors.all()
        assert (author.name, author.country) == ("Robert C. Martin", "US")

    def test_reuses_an_author_that_exists_whatever_the_case(self, librarian):
        existing = AuthorFactory(name="Robert C. Martin", country="")
        r = as_user(librarian).post(
            "/api/v1/books/import/", payload(author_names=["robert c. martin"], author_country="US"), format="json"
        )
        assert r.status_code == 201
        assert Author.objects.count() == 1
        existing.refresh_from_db()
        assert existing.country == "US"  # filled in, because it was empty

    def test_does_not_overwrite_an_authors_country(self, librarian):
        existing = AuthorFactory(name="Machado de Assis", country="BR")
        as_user(librarian).post(
            "/api/v1/books/import/", payload(author_names=["Machado de Assis"], author_country="PT"), format="json"
        )
        existing.refresh_from_db()
        assert existing.country == "BR"

    def test_an_isbn10_is_stored_as_isbn13(self, librarian):
        r = as_user(librarian).post("/api/v1/books/import/", payload(isbn="0-13-235088-2"), format="json")
        assert r.status_code == 201
        assert Book.objects.get().isbn == "9780132350884"

    def test_the_same_book_twice_is_refused_even_in_the_other_isbn_form(self, librarian):
        BookFactory(isbn="9780132350884")
        r = as_user(librarian).post("/api/v1/books/import/", payload(isbn="0132350882"), format="json")
        assert r.status_code == 400
        assert "isbn" in r.json()["field_errors"]

    def test_a_silly_year_from_the_web_becomes_unknown_instead_of_failing(self, librarian):
        r = as_user(librarian).post("/api/v1/books/import/", payload(publication_year=3024), format="json")
        assert r.status_code == 201
        assert Book.objects.get().publication_year is None

    def test_needs_an_author_and_a_category(self, librarian):
        r = as_user(librarian).post("/api/v1/books/import/", payload(author_names=[], category_id=999999), format="json")
        assert r.status_code == 400
        assert {"author_names", "category_id"} <= set(r.json()["field_errors"])


class TestSuggestCategory:
    def test_picks_the_category_with_most_keyword_hits(self):
        assert suggest_category_slug(["Fantasy fiction", "Wizards", "Magic"]) == "fantasia"
        assert suggest_category_slug(["Poetry", "Poems, Brazilian"]) == "poesia"
        assert suggest_category_slug(["Biography", "Autobiography"]) == "biografia"

    def test_none_when_nothing_matches(self):
        assert suggest_category_slug(["Cooking", "Gardening"]) is None
        assert suggest_category_slug([]) is None
