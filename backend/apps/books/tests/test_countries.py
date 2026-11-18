from io import StringIO

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.books.models import Author
from apps.books.tests.factories import AuthorFactory, BookFactory

pytestmark = pytest.mark.django_db


class TestCountryCounts:
    def test_counts_books_per_author_country_most_first(self):
        br, jp = AuthorFactory(country="BR"), AuthorFactory(country="JP")
        BookFactory(authors=[br])
        BookFactory(authors=[br])
        BookFactory(authors=[jp])
        r = APIClient().get("/api/v1/books/countries/")
        assert r.status_code == 200
        assert r.json() == [{"country": "BR", "books": 2}, {"country": "JP", "books": 1}]

    def test_is_public_and_leaves_out_authors_without_a_country_and_withdrawn_books(self):
        BookFactory(authors=[AuthorFactory(country="")])
        BookFactory(authors=[AuthorFactory(country="PT")], is_active=False)
        assert APIClient().get("/api/v1/books/countries/").json() == []

    def test_a_book_with_two_countries_counts_once_for_each(self):
        BookFactory(authors=[AuthorFactory(country="BR"), AuthorFactory(country="PT")])
        rows = {row["country"]: row["books"] for row in APIClient().get("/api/v1/books/countries/").json()}
        assert rows == {"BR": 1, "PT": 1}


class TestAuthorCountryFilter:
    def test_filters_books_by_author_nationality_in_any_case(self):
        wanted = BookFactory(authors=[AuthorFactory(country="JP")])
        BookFactory(authors=[AuthorFactory(country="BR")])
        for value in ("JP", "jp"):
            r = APIClient().get("/api/v1/books/", {"author_country": value})
            assert [b["id"] for b in r.json()["results"]] == [wanted.pk]

    def test_book_rows_show_the_author_country(self):
        BookFactory(authors=[AuthorFactory(country="BR")])
        row = APIClient().get("/api/v1/books/").json()["results"][0]
        assert row["authors"][0]["country"] == "BR"


class TestAuthorCountryField:
    def test_rejects_anything_but_two_capital_letters(self, librarian):
        c = APIClient()
        c.force_authenticate(librarian)
        assert c.post("/api/v1/authors/", {"name": "X", "country": "Brazil"}).status_code == 400
        ok = c.post("/api/v1/authors/", {"name": "X", "country": "br"})
        assert ok.status_code == 201 and ok.json()["country"] == "BR"


def test_demo_seed_sets_countries_and_is_idempotent():
    call_command("seed_demo", stdout=StringIO())
    call_command("seed_demo", stdout=StringIO())
    assert Author.objects.get(name="Machado de Assis").country == "BR"
    assert Author.objects.exclude(country="").count() >= 20
    rows = APIClient().get("/api/v1/books/countries/").json()
    assert len(rows) >= 15 and rows[0]["country"] in {"BR", "GB"}


def test_seed_never_overwrites_a_country_set_by_hand():
    AuthorFactory(name="Machado de Assis", country="PT")
    call_command("seed_demo", stdout=StringIO())
    assert Author.objects.get(name="Machado de Assis").country == "PT"
