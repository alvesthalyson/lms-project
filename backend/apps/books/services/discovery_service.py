"""Reviews, wish list and 'read next' suggestions."""

from __future__ import annotations

from django.db import transaction
from django.db.models import Avg, Count, F

from apps.books.models import Book, Favorite, Review
from apps.users.models import User

Reason = str  # "readers" | "author" | "category"


@transaction.atomic
def upsert_review(*, user: User, book: Book, rating: int, comment: str = "") -> tuple[Review, bool]:
    """One review per user and book: posting again replaces it. Returns (review, created)."""
    review, created = Review.objects.update_or_create(
        book=book, user=user, defaults={"rating": rating, "comment": comment.strip()}
    )
    return review, created


def set_favorite(*, user: User, book: Book, wanted: bool) -> bool:
    """Add or remove a book from the wish list. Repeating it is harmless."""
    if wanted:
        Favorite.objects.get_or_create(user=user, book=book)
    else:
        Favorite.objects.filter(user=user, book=book).delete()
    return wanted


def recommendations(book: Book, limit: int = 6) -> list[tuple[Book, Reason]]:
    """
    Books to read next, as (book, reason) pairs, each book once under the first reason that fits:

      readers   members who borrowed this book also borrowed it (counted, never named)
      author    another title by one of the same authors
      category  another title in the same category

    Within the author and category groups, better-rated books come first. Withdrawn titles are skipped.
    """
    from apps.loans.models import Loan  # local import: loans depends on books

    picked: dict[int, Reason] = {}

    also = (
        Loan.objects.filter(member__in=Loan.objects.filter(copy__book=book).values("member"))
        .exclude(copy__book=book)
        .filter(copy__book__is_active=True)
        .values("copy__book")
        .annotate(readers=Count("member", distinct=True))
        .order_by("-readers", "copy__book")[:limit]
    )
    for row in also:
        picked[row["copy__book"]] = "readers"

    def best_first(queryset):
        return (
            queryset.filter(is_active=True)
            .exclude(pk=book.pk)
            .annotate(_avg=Avg("reviews__rating"))
            .order_by(F("_avg").desc(nulls_last=True), "title")
            .values_list("pk", flat=True)
            .distinct()
        )

    groups = [("author", Book.objects.filter(authors__in=book.authors.all()))]
    groups.append(("category", Book.objects.filter(category_id=book.category_id)))
    for reason, queryset in groups:
        for pk in best_first(queryset)[:limit]:
            if len(picked) >= limit:
                break
            picked.setdefault(pk, reason)

    ids = list(picked)[:limit]
    found = {b.pk: b for b in Book.objects.filter(pk__in=ids)}
    return [(found[pk], picked[pk]) for pk in ids if pk in found]
