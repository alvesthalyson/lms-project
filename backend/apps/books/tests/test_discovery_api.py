from io import StringIO
from unittest import mock

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.books.models import Book, Favorite, Review
from apps.books.services import openlibrary
from apps.books.tests.factories import AuthorFactory, BookFactory, CategoryFactory
from apps.users.tests.factories import MemberFactory

pytestmark = pytest.mark.django_db


def as_user(user=None):
    client = APIClient()
    if user:
        client.force_authenticate(user)
    return client


class TestReviews:
    def test_anyone_reads_but_must_sign_in_to_write(self):
        book = BookFactory()
        assert as_user().get(f"/api/v1/books/{book.pk}/reviews/").status_code == 200
        r = as_user().post(f"/api/v1/books/{book.pk}/reviews/", {"rating": 5})
        assert r.status_code in (401, 403)

    def test_create_then_edit_replaces_the_same_review(self, member):
        book = BookFactory()
        c = as_user(member)
        first = c.post(f"/api/v1/books/{book.pk}/reviews/", {"rating": 4, "comment": "Good"})
        again = c.post(f"/api/v1/books/{book.pk}/reviews/", {"rating": 2, "comment": "Meh"})
        assert (first.status_code, again.status_code) == (201, 200)
        assert Review.objects.filter(book=book).count() == 1
        assert again.json()["rating"] == 2 and again.json()["is_mine"] is True

    @pytest.mark.parametrize("rating", [0, 6])
    def test_rating_must_be_1_to_5(self, member, rating):
        book = BookFactory()
        r = as_user(member).post(f"/api/v1/books/{book.pk}/reviews/", {"rating": rating})
        assert r.status_code == 400

    def test_reviewer_name_hides_email(self, member):
        book = BookFactory()
        as_user(member).post(f"/api/v1/books/{book.pk}/reviews/", {"rating": 5})
        body = as_user().get(f"/api/v1/books/{book.pk}/reviews/").json()["results"][0]
        assert member.email not in str(body)

    def test_average_and_count_on_list_and_detail(self):
        book = BookFactory()
        Review.objects.create(book=book, user=MemberFactory(), rating=5)
        Review.objects.create(book=book, user=MemberFactory(), rating=3)
        row = as_user().get("/api/v1/books/").json()["results"][0]
        assert row["rating_count"] == 2 and float(row["rating_avg"]) == 4.0
        detail = as_user().get(f"/api/v1/books/{book.pk}/").json()
        assert detail["rating_count"] == 2

    def test_only_author_or_staff_delete(self, member, librarian):
        book = BookFactory()
        review = Review.objects.create(book=book, user=member, rating=4)
        stranger = MemberFactory()
        assert as_user(stranger).delete(f"/api/v1/reviews/{review.pk}/").status_code == 404
        assert as_user(librarian).delete(f"/api/v1/reviews/{review.pk}/").status_code == 204
        own = Review.objects.create(book=BookFactory(), user=member, rating=1)
        assert as_user(member).delete(f"/api/v1/reviews/{own.pk}/").status_code == 204


class TestFavorites:
    def test_put_delete_are_idempotent(self, member):
        book = BookFactory()
        c = as_user(member)
        assert c.put(f"/api/v1/books/{book.pk}/favorite/").json() == {"is_favorite": True}
        assert c.put(f"/api/v1/books/{book.pk}/favorite/").status_code == 200
        assert Favorite.objects.count() == 1
        assert c.delete(f"/api/v1/books/{book.pk}/favorite/").json() == {"is_favorite": False}
        assert c.delete(f"/api/v1/books/{book.pk}/favorite/").status_code == 200

    def test_requires_login(self):
        book = BookFactory()
        assert as_user().put(f"/api/v1/books/{book.pk}/favorite/").status_code in (401, 403)

    def test_flag_and_filter_are_per_user(self, member):
        liked, other = BookFactory(), BookFactory()
        Favorite.objects.create(user=member, book=liked)
        rows = as_user(member).get("/api/v1/books/?favorite=true").json()["results"]
        assert [r["id"] for r in rows] == [liked.pk] and rows[0]["is_favorite"] is True
        assert as_user(MemberFactory()).get("/api/v1/books/?favorite=true").json()["results"] == []
        assert as_user().get("/api/v1/books/?favorite=true").json()["results"] == []
        flags = {r["id"]: r["is_favorite"] for r in as_user(member).get("/api/v1/books/").json()["results"]}
        assert flags == {liked.pk: True, other.pk: False}


class TestRelated:
    def test_same_author_then_category_without_self(self):
        author = AuthorFactory()
        cat = CategoryFactory()
        base = BookFactory(authors=[author], category=cat)
        same_author = BookFactory(authors=[author])
        same_cat = BookFactory(category=cat)
        BookFactory()  # unrelated
        body = as_user().get(f"/api/v1/books/{base.pk}/related/").json()
        reasons = {row["book"]["id"]: row["reason"] for row in body}
        assert reasons == {same_author.pk: "author", same_cat.pk: "category"}

    def test_withdrawn_titles_are_skipped(self):
        author = AuthorFactory()
        base = BookFactory(authors=[author])
        BookFactory(authors=[author], is_active=False)
        assert as_user().get(f"/api/v1/books/{base.pk}/related/").json() == []


class TestCoverFallback:
    def test_external_cover_url_is_served_and_https_only(self, librarian):
        book = BookFactory(cover_url="https://covers.openlibrary.org/b/id/1-L.jpg")
        assert as_user().get(f"/api/v1/books/{book.pk}/").json()["cover_image"].endswith("/b/id/1-L.jpg")
        r = as_user(librarian).patch(f"/api/v1/books/{book.pk}/", {"cover_url": "http://x.test/a.jpg"})
        assert r.status_code == 400


class TestFetchCovers:
    def run(self, *args):
        out = StringIO()
        call_command("fetch_covers", *args, stdout=out)
        return out.getvalue()

    def test_saves_cover_for_books_without_one(self):
        book = BookFactory()
        with mock.patch("apps.books.management.commands.fetch_covers.time.sleep"), mock.patch.object(
            openlibrary, "_get_json", return_value={"docs": [{"title": book.title, "cover_i": 42}]}
        ):
            self.run()
        book.refresh_from_db()
        assert book.cover_url == "https://covers.openlibrary.org/b/id/42-L.jpg"

    def test_dry_run_saves_nothing_and_skips_existing(self):
        BookFactory(cover_url="https://covers.openlibrary.org/b/id/1-L.jpg")
        fresh = BookFactory()
        with mock.patch.object(openlibrary, "_get_json", return_value={"docs": [{"title": fresh.title, "cover_i": 7}]}):
            out = self.run("--dry-run")
        fresh.refresh_from_db()
        assert fresh.cover_url == "" and "would use" in out

    def test_gives_up_after_three_network_failures(self):
        from django.core.management.base import CommandError

        for _ in range(4):
            BookFactory()
        with mock.patch("apps.books.management.commands.fetch_covers.time.sleep"), mock.patch.object(
            openlibrary, "_get_json", side_effect=openlibrary.NetworkProblem("down")
        ):
            with pytest.raises(CommandError):
                self.run()

    def test_subtitle_matches_but_different_book_does_not(self):
        assert openlibrary.base_title("Kokoro: A Novel") == "Kokoro"
        with mock.patch.object(openlibrary, "_get_json", return_value={"docs": [{"title": "Kokoro and the Giant Panda", "cover_i": 9}]}):
            assert openlibrary.find_cover_url(isbn="", title="Kokoro", author="X") is None


class TestSeedBookshelf:
    def test_idempotent_with_valid_isbns_and_copies(self):
        call_command("seed_bookshelf", stdout=StringIO())
        call_command("seed_bookshelf", stdout=StringIO())
        assert Book.objects.count() == 5
        book = Book.objects.get(title="Noli Me Tangere")
        assert book.total_copies == 2 == book.available_copies
        for b in Book.objects.all():
            b.full_clean(exclude=["category", "cover_image"])
