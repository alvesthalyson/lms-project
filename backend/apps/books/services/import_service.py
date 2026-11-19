"""
Librarian import: look a book up in Open Library and add it to the catalogue in one step.

`lookup` only reads (and annotates what is already here). `import_book` is the write: it reuses authors
that already exist (same name, any case), creates the others, and then goes through `create_book` so the
copies and counters are created exactly as for a hand-typed book.
"""

from __future__ import annotations

import re
from typing import Any

from django.db import transaction
from django.db.models.functions import Lower

from apps.books.isbn import to_isbn10
from apps.books.models import Author, Book, Category
from apps.books.services import book_service, openlibrary
from apps.core.exceptions import ErrorCode, LookupUnavailable

# Open Library subjects -> our category slug. First slug with the most keyword hits wins.
CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "poesia": ("poetry", "poems", "poesia", "poésie"),
    "arte": ("art", "painting", "sculpture", "architecture", "design", "photography"),
    "programacao": ("computer", "programming", "software", "algorithms", "python", "javascript"),
    "ficcao": ("fiction", "novel", "short stories", "literature"),
    "ciencia": ("science", "physics", "chemistry", "biology", "mathematics", "astronomy", "nature"),
    "historia": ("history", "war", "ancient", "civilization", "politics"),
    "filosofia": ("philosophy", "ethics", "logic", "metaphysics"),
    "romance": ("romance", "love stories", "love"),
    "fantasia": ("fantasy", "magic", "dragons", "wizards", "fairy"),
    "aventura": ("adventure", "survival", "voyages", "exploration"),
    "misterio": ("mystery", "detective", "crime", "thriller", "suspense"),
    "biografia": ("biography", "autobiography", "memoir", "diaries"),
}


def suggest_category_slug(subjects: list[str]) -> str | None:
    """The category whose keywords appear most often in the book's subjects; None when nothing matches."""
    text = " ".join(s.lower() for s in subjects)
    best, best_hits = None, 0
    for slug, words in CATEGORY_KEYWORDS.items():
        hits = sum(len(re.findall(rf"\b{re.escape(word)}\b", text)) for word in words)
        if hits > best_hits:
            best, best_hits = slug, hits
    return best


def lookup(*, isbn: str = "", title: str = "", author: str = "") -> list[dict[str, Any]]:
    """Open Library candidates, each annotated with `in_catalogue` (book id or None) and a suggested category."""
    try:
        found = openlibrary.search_books(isbn=isbn, title=title, author=author)
    except openlibrary.NetworkProblem as exc:
        raise LookupUnavailable() from exc

    forms = set()
    for item in found:
        forms.add(item["isbn"])
        twin = to_isbn10(item["isbn"])
        if twin:
            forms.add(twin)
    existing = {b.isbn: b.pk for b in Book.objects.filter(isbn__in=forms).only("id", "isbn")}
    by_slug = dict(Category.objects.values_list("slug", "id"))

    for item in found:
        item["in_catalogue"] = existing.get(item["isbn"]) or existing.get(to_isbn10(item["isbn"]) or "")
        slug = suggest_category_slug(item["subjects"])
        item["suggested_category_id"] = by_slug.get(slug) if slug else None
    return found


@transaction.atomic
def import_book(validated_data: dict[str, Any]) -> Book:
    """Create the book (and its authors and copies) from a looked-up candidate the librarian confirmed."""
    data = dict(validated_data)
    names = data.pop("author_names")
    country = data.pop("author_country", "")

    authors = []
    for name in names:
        author = Author.objects.annotate(lower_name=Lower("name")).filter(lower_name=name.lower()).first()
        if author is None:
            author = Author.objects.create(name=name, country=country)
        elif country and not author.country:
            author.country = country  # fill the gap, never overwrite what someone set
            author.save(update_fields=["country", "updated_at"])
        authors.append(author)

    data["authors"] = authors
    data["initial_copies"] = data.pop("copies", 0)
    return book_service.create_book(data)
