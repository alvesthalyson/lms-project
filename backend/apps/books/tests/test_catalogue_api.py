import pytest
from rest_framework.test import APIClient

from apps.books.models import Book, CopyStatus
from apps.books.tests.factories import AuthorFactory, BookCopyFactory, BookFactory, CategoryFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def anon():
    return APIClient()


def as_user(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def results(response):
    return response.json()["results"]


class TestCategories:
    def test_public_list(self, anon):
        CategoryFactory(name="Poesia", slug="poesia")
        r = anon.get("/api/v1/categories/")
        assert r.status_code == 200
        assert [c["name"] for c in results(r)] == ["Poesia"]

    def test_member_cannot_create(self, member):
        r = as_user(member).post("/api/v1/categories/", {"name": "X"})
        assert r.status_code == 403

    def test_librarian_creates_with_generated_slug(self, librarian):
        r = as_user(librarian).post("/api/v1/categories/", {"name": "Ficção Científica"})
        assert r.status_code == 201
        assert r.json()["slug"] == "ficcao-cientifica"

    def test_delete_in_use_is_409(self, admin):
        book = BookFactory()
        r = as_user(admin).delete(f"/api/v1/categories/{book.category_id}/")
        assert r.status_code == 409

    def test_librarian_cannot_delete(self, librarian):
        cat = CategoryFactory()
        assert as_user(librarian).delete(f"/api/v1/categories/{cat.pk}/").status_code == 403

    def test_admin_deletes_unused(self, admin):
        cat = CategoryFactory()
        assert as_user(admin).delete(f"/api/v1/categories/{cat.pk}/").status_code == 204


class TestAuthors:
    def test_public_search(self, anon):
        AuthorFactory(name="Clarice Lispector")
        AuthorFactory(name="Other")
        r = anon.get("/api/v1/authors/", {"search": "clarice"})
        assert [a["name"] for a in results(r)] == ["Clarice Lispector"]

    def test_delete_in_use_is_409(self, admin):
        author = AuthorFactory()
        BookFactory(authors=[author])
        assert as_user(admin).delete(f"/api/v1/authors/{author.pk}/").status_code == 409


class TestBookList:
    def test_anonymous_sees_active_books_only(self, anon):
        BookFactory(title="Visible")
        BookFactory(title="Hidden", is_active=False)
        r = anon.get("/api/v1/books/")
        assert [b["title"] for b in results(r)] == ["Visible"]

    def test_filter_by_category(self, anon):
        cat = CategoryFactory()
        BookFactory(title="In", category=cat)
        BookFactory(title="Out")
        r = anon.get("/api/v1/books/", {"category": cat.pk})
        assert [b["title"] for b in results(r)] == ["In"]

    def test_filter_by_category_slug_and_available(self, anon):
        cat = CategoryFactory(slug="poesia")
        BookFactory(title="Free", category=cat, copies=1)
        BookFactory(title="None", category=cat)
        r = anon.get("/api/v1/books/", {"category_slug": "poesia", "available": "true"})
        assert [b["title"] for b in results(r)] == ["Free"]

    def test_search_matches_title_and_author(self, anon):
        BookFactory(title="Dom Casmurro", authors=[AuthorFactory(name="Machado de Assis")])
        BookFactory(title="Other")
        assert len(results(anon.get("/api/v1/books/", {"search": "casmurro"}))) == 1
        assert len(results(anon.get("/api/v1/books/", {"search": "machado"}))) == 1

    def test_ordering_and_page_size(self, anon):
        BookFactory.create_batch(3)
        r = anon.get("/api/v1/books/", {"page_size": 2, "ordering": "-created_at"})
        assert r.status_code == 200
        assert len(results(r)) == 2

    def test_staff_can_list_withdrawn(self, librarian):
        BookFactory(title="Hidden", is_active=False)
        r = as_user(librarian).get("/api/v1/books/", {"is_active": "false"})
        assert [b["title"] for b in results(r)] == ["Hidden"]

    def test_query_count_is_constant(self, anon, django_assert_max_num_queries):
        BookFactory.create_batch(5, copies=1)
        with django_assert_max_num_queries(6):
            anon.get("/api/v1/books/")


class TestBookWrite:
    def payload(self, **extra):
        cat, author = CategoryFactory(), AuthorFactory()
        data = {
            "title": "Novo",
            "isbn": "9780306406157",
            "category_id": cat.pk,
            "author_ids": [author.pk],
            "initial_copies": 3,
        }
        data.update(extra)
        return data

    def test_member_cannot_create(self, member):
        assert as_user(member).post("/api/v1/books/", self.payload(), format="json").status_code == 403

    def test_librarian_creates_with_copies(self, librarian):
        r = as_user(librarian).post("/api/v1/books/", self.payload(), format="json")
        assert r.status_code == 201
        body = r.json()
        assert body["total_copies"] == 3
        assert body["available_copies"] == 3
        assert Book.objects.get(pk=body["id"]).copies.count() == 3

    def test_duplicate_isbn_is_400(self, librarian):
        client = as_user(librarian)
        client.post("/api/v1/books/", self.payload(), format="json")
        r = client.post("/api/v1/books/", self.payload(), format="json")
        assert r.status_code == 400

    def test_patch_updates_authors(self, librarian):
        book = BookFactory()
        new = AuthorFactory()
        r = as_user(librarian).patch(
            f"/api/v1/books/{book.pk}/", {"author_ids": [new.pk]}, format="json"
        )
        assert r.status_code == 200
        assert [a["id"] for a in r.json()["authors"]] == [new.pk]

    def test_soft_delete_by_admin(self, admin, anon):
        book = BookFactory(copies=2)
        assert as_user(admin).delete(f"/api/v1/books/{book.pk}/").status_code == 204
        book.refresh_from_db()
        assert book.is_active is False
        assert anon.get(f"/api/v1/books/{book.pk}/").status_code == 404

    def test_delete_with_active_loan_is_409(self, admin):
        book = BookFactory(copies=1, copies__status=CopyStatus.ON_LOAN)
        r = as_user(admin).delete(f"/api/v1/books/{book.pk}/")
        assert r.status_code == 409
        assert r.json()["code"] == "book_has_active_loans" or "book_has_active_loans" in str(r.json())


class TestCopies:
    def test_anonymous_cannot_list_copies(self, anon):
        book = BookFactory(copies=1)
        assert anon.get(f"/api/v1/books/{book.pk}/copies/").status_code in (401, 403)

    def test_add_copy_updates_counters(self, librarian):
        book = BookFactory(copies=1)
        r = as_user(librarian).post(f"/api/v1/books/{book.pk}/copies/", {}, format="json")
        assert r.status_code == 201
        book.refresh_from_db()
        assert (book.total_copies, book.available_copies) == (2, 2)

    def test_mark_lost_updates_counters(self, librarian):
        book = BookFactory(copies=2)
        copy = book.copies.first()
        r = as_user(librarian).patch(f"/api/v1/copies/{copy.pk}/", {"status": "LOST"}, format="json")
        assert r.status_code == 200
        book.refresh_from_db()
        assert (book.total_copies, book.available_copies) == (1, 1)

    def test_on_loan_copy_not_editable(self, librarian):
        copy = BookCopyFactory(status=CopyStatus.ON_LOAN)
        r = as_user(librarian).patch(f"/api/v1/copies/{copy.pk}/", {"status": "LOST"}, format="json")
        assert r.status_code == 409
