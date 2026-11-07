"""
Catalogue writes: books, copies, and the guarded deletes.

Views hand over `validated_data`; everything that touches more than one row
runs inside transaction.atomic and takes the Book row lock first (see
inventory_service), so it never races with a loan.
"""

from __future__ import annotations

from typing import Any

from django.db import transaction

from apps.books.models import Author, Book, BookCopy, Category, CopyStatus
from apps.books.services.inventory_service import (
    lock_book,
    lock_copy,
    set_copy_status,
    sync_book_counts,
)
from apps.core.exceptions import BusinessRuleError, ErrorCode

EDITABLE_STATUSES = (CopyStatus.AVAILABLE, CopyStatus.LOST, CopyStatus.DAMAGED)


def _next_barcode(book: Book) -> str:
    """Generated barcode `B000012-003`, skipping any that already exist."""
    n = book.copies.count() + 1
    while True:
        barcode = f"B{book.pk:06d}-{n:03d}"
        if not BookCopy.objects.filter(barcode=barcode).exists():
            return barcode
        n += 1


@transaction.atomic
def create_book(validated_data: dict[str, Any]) -> Book:
    data = dict(validated_data)
    authors = data.pop("authors")
    initial_copies = data.pop("initial_copies", 0)
    book = Book.objects.create(**data)
    book.authors.set(authors)
    if initial_copies:
        for _ in range(initial_copies):
            BookCopy.objects.create(book=book, barcode=_next_barcode(book))
        sync_book_counts(book.pk)
        book.refresh_from_db()
    return book


@transaction.atomic
def update_book(book: Book, validated_data: dict[str, Any]) -> Book:
    book = lock_book(book.pk)
    data = dict(validated_data)
    authors = data.pop("authors", None)
    data.pop("initial_copies", None)
    for field, value in data.items():
        setattr(book, field, value)
    book.save()
    if authors is not None:
        book.authors.set(authors)
    return book


@transaction.atomic
def deactivate_book(book: Book) -> Book:
    """Soft delete. Refused while any copy is out on loan or on hold."""
    book = lock_book(book.pk)
    if book.copies.filter(status__in=(CopyStatus.ON_LOAN, CopyStatus.ON_HOLD)).exists():
        raise BusinessRuleError(
            "This book has copies on loan or on hold.", code=ErrorCode.BOOK_HAS_ACTIVE_LOANS
        )
    book.is_active = False
    book.save(update_fields=["is_active", "updated_at"])
    return book


@transaction.atomic
def add_copy(book: Book, validated_data: dict[str, Any]) -> BookCopy:
    book = lock_book(book.pk)
    data = dict(validated_data)
    data.setdefault("barcode", None)
    barcode = data.pop("barcode") or _next_barcode(book)
    copy = BookCopy.objects.create(book=book, barcode=barcode, **data)
    sync_book_counts(book.pk)
    return copy


@transaction.atomic
def update_copy(copy: BookCopy, validated_data: dict[str, Any]) -> BookCopy:
    copy = lock_copy(copy.pk)
    lock_book(copy.book_id)
    if copy.status not in EDITABLE_STATUSES:
        raise BusinessRuleError(
            "A copy on loan or on hold cannot be edited.",
            code=ErrorCode.COPY_STATUS_NOT_EDITABLE,
        )
    set_copy_status(
        copy,
        validated_data.get("status", copy.status),
        condition_notes=validated_data.get("condition_notes"),
    )
    return copy


def ensure_category_deletable(category: Category) -> None:
    if category.books.exists():
        raise BusinessRuleError("Category has books.", code=ErrorCode.CATEGORY_IN_USE)


def ensure_author_deletable(author: Author) -> None:
    if author.books.exists():
        raise BusinessRuleError("Author has books.", code=ErrorCode.AUTHOR_IN_USE)
