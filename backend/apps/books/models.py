from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

from apps.core.models import TimeStampedModel

isbn_validator = RegexValidator(
    regex=r"^(\d{9}[\dX]|\d{13})$",
    message="ISBN must be 10 or 13 characters, digits only (last char of ISBN-10 may be X), no hyphens.",
)


def validate_not_future_year(value: int) -> None:
    if value > timezone.now().year:
        raise ValidationError("Publication year cannot be in the future.")


class CopyStatus(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Available"
    ON_LOAN = "ON_LOAN", "On loan"
    ON_HOLD = "ON_HOLD", "Held for a reservation"
    LOST = "LOST", "Lost"
    DAMAGED = "DAMAGED", "Damaged / withdrawn"


class Category(TimeStampedModel):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True)

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Author(TimeStampedModel):
    name = models.CharField(max_length=255)

    class Meta:
        ordering = ["name"]
        indexes = [
            GinIndex(
                fields=["name"], opclasses=["gin_trgm_ops"], name="author_name_trgm_idx"
            ),
        ]

    def __str__(self):
        return self.name


class Book(TimeStampedModel):
    title = models.CharField(max_length=255)
    authors = models.ManyToManyField(Author, related_name="books")
    isbn = models.CharField(max_length=13, unique=True, validators=[isbn_validator])
    publisher = models.CharField(max_length=255, blank=True)
    publication_year = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1000), validate_not_future_year],
    )
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name="books"
    )
    description = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to="covers/%Y/%m/", null=True, blank=True)
    cover_url = models.URLField(
        max_length=500,
        blank=True,
        help_text="External cover (e.g. Open Library). An uploaded cover_image wins over it.",
    )
    pages = models.PositiveIntegerField(null=True, blank=True)

    # Denormalised counters, kept in sync by the book/loan services inside a
    # transaction (see BookCopy). Cheap to filter and sort on.
    total_copies = models.PositiveIntegerField(default=0)
    available_copies = models.PositiveIntegerField(default=0)

    is_active = models.BooleanField(
        default=True, help_text="Soft-delete: hide from the catalogue, keep history."
    )

    class Meta:
        ordering = ["title", "id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(available_copies__lte=F("total_copies")),
                name="book_available_lte_total",
            ),
        ]
        indexes = [
            GinIndex(
                fields=["title"], opclasses=["gin_trgm_ops"], name="book_title_trgm_idx"
            ),
            models.Index(fields=["category", "title"], name="book_category_title_idx"),
            models.Index(fields=["is_active", "available_copies"], name="book_active_avail_idx"),
        ]

    def __str__(self):
        return self.title


class BookCopy(TimeStampedModel):
    """One physical copy. The loan references this, not the Book."""

    book = models.ForeignKey(Book, on_delete=models.PROTECT, related_name="copies")
    barcode = models.CharField(max_length=64, unique=True)
    status = models.CharField(
        max_length=10, choices=CopyStatus.choices, default=CopyStatus.AVAILABLE
    )
    condition_notes = models.TextField(blank=True)
    acquired_at = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "book copies"
        ordering = ["book_id", "barcode"]
        indexes = [
            models.Index(fields=["book", "status"], name="copy_book_status_idx"),
        ]

    def __str__(self):
        return f"{self.barcode} ({self.get_status_display()})"


class Review(TimeStampedModel):
    """A member's rating and optional comment. One per user and book; posting again edits it."""

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews"
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["book", "user"], name="review_one_per_user_book"),
            models.CheckConstraint(
                condition=Q(rating__gte=1, rating__lte=5), name="review_rating_1_5"
            ),
        ]

    def __str__(self):
        return f"{self.user_id} rated book {self.book_id}: {self.rating}"


class Favorite(TimeStampedModel):
    """A book on a member's wish list."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites"
    )
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="favorites")

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["user", "book"], name="favorite_one_per_user_book"),
        ]

    def __str__(self):
        return f"{self.user_id} saved book {self.book_id}"
