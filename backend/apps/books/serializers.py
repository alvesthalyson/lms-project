import re

from django.utils.text import slugify
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from .models import Author, Book, BookCopy, Category, CopyStatus, Review

MAX_COVER_BYTES = 5 * 1024 * 1024


def is_valid_isbn(value: str) -> bool:
    """Checksum validation for a normalised ISBN-10 / ISBN-13 (no hyphens, upper-case)."""
    if re.fullmatch(r"\d{13}", value):
        total = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(value[:12]))
        return (10 - total % 10) % 10 == int(value[12])
    if re.fullmatch(r"\d{9}[\dX]", value):
        total = sum(
            (10 - i) * (10 if d == "X" else int(d)) for i, d in enumerate(value)
        )
        return total % 11 == 0
    return False


class ISBNField(serializers.CharField):
    """
    Accepts '978-0-13-449416-6' and stores '9780134494166'. Normalising in
    to_internal_value means the uniqueness and max_length validators see the
    cleaned value, so '978-...' and '978...' count as the same ISBN.
    """

    def to_internal_value(self, data):
        value = re.sub(r"[\s-]", "", super().to_internal_value(data)).upper()
        if not is_valid_isbn(value):
            raise serializers.ValidationError(
                "Enter a valid ISBN-10 or ISBN-13.", code="invalid_isbn"
            )
        return value


# --------------------------------------------------------------------------
# Categories and authors
# --------------------------------------------------------------------------


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug"]
        extra_kwargs = {"slug": {"required": False}}

    def validate(self, attrs):
        # On create, derive the slug from the name when the client omits it.
        if self.instance is None and not attrs.get("slug"):
            slug = slugify(attrs["name"])
            if not slug:
                raise serializers.ValidationError(
                    {"name": "Name must contain letters or digits."}
                )
            if Category.objects.filter(slug=slug).exists():
                raise serializers.ValidationError(
                    {"slug": "A category with this slug already exists."}
                )
            attrs["slug"] = slug
        return attrs


class AuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Author
        fields = ["id", "name"]


# --------------------------------------------------------------------------
# Copies
# --------------------------------------------------------------------------


class BookCopySerializer(serializers.ModelSerializer):
    book_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = BookCopy
        fields = [
            "id",
            "book_id",
            "barcode",
            "status",
            "condition_notes",
            "acquired_at",
        ]
        read_only_fields = fields


class BookCopyCreateSerializer(serializers.ModelSerializer):
    """POST /books/{id}/copies/ - the book comes from the URL, status starts AVAILABLE."""

    class Meta:
        model = BookCopy
        fields = ["barcode", "condition_notes", "acquired_at"]
        # Left out, the service generates one (B000012-003).
        extra_kwargs = {"barcode": {"required": False}}


class BookCopyUpdateSerializer(serializers.ModelSerializer):
    """
    PATCH /copies/{id}/ - staff may only move a copy between AVAILABLE, LOST
    and DAMAGED. ON_LOAN / ON_HOLD are controlled by the loan and reservation
    services. Whether a given transition is legal is checked in the service.
    """

    status = serializers.ChoiceField(
        choices=[
            (CopyStatus.AVAILABLE.value, CopyStatus.AVAILABLE.label),
            (CopyStatus.LOST.value, CopyStatus.LOST.label),
            (CopyStatus.DAMAGED.value, CopyStatus.DAMAGED.label),
        ],
        required=False,
    )

    class Meta:
        model = BookCopy
        fields = ["status", "condition_notes"]


# --------------------------------------------------------------------------
# Books
# --------------------------------------------------------------------------


def cover_for(book: Book, request=None) -> str | None:
    """The uploaded cover if there is one, else the external cover URL, else None."""
    if book.cover_image:
        url = book.cover_image.url
        return request.build_absolute_uri(url) if request is not None else url
    return book.cover_url or None


class _CoverMixin(serializers.Serializer):
    cover_image = serializers.SerializerMethodField()

    def get_cover_image(self, obj) -> str | None:
        return cover_for(obj, self.context.get("request"))


class BookSummarySerializer(_CoverMixin, serializers.ModelSerializer):
    """Tiny nested representation used inside loans, fines, reservations, dashboard."""

    class Meta:
        model = Book
        fields = ["id", "title", "isbn", "cover_image"]
        read_only_fields = fields


class BookListSerializer(_CoverMixin, serializers.ModelSerializer):
    """
    Catalogue rows. Authors and category are one level of nesting, nothing deeper.
    `rating_avg`, `rating_count` and `is_favorite` come from queryset annotations (see BookViewSet);
    without them (a book serialised outside the catalogue) they fall back to null / 0 / false.
    """

    authors = AuthorSerializer(many=True, read_only=True)
    category = CategorySerializer(read_only=True)
    is_available = serializers.SerializerMethodField()
    rating_avg = serializers.SerializerMethodField()
    rating_count = serializers.SerializerMethodField()
    is_favorite = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = [
            "id",
            "title",
            "authors",
            "isbn",
            "publisher",
            "publication_year",
            "category",
            "cover_image",
            "total_copies",
            "available_copies",
            "is_available",
            "is_active",
            "rating_avg",
            "rating_count",
            "is_favorite",
        ]
        read_only_fields = fields

    def get_is_available(self, obj) -> bool:
        return obj.available_copies > 0

    def get_rating_avg(self, obj) -> float | None:
        value = getattr(obj, "rating_avg", None)
        return round(float(value), 1) if value is not None else None

    def get_rating_count(self, obj) -> int:
        return getattr(obj, "rating_count", 0) or 0

    def get_is_favorite(self, obj) -> bool:
        return bool(getattr(obj, "is_favorite", False))


class BookDetailSerializer(BookListSerializer):
    class Meta(BookListSerializer.Meta):
        fields = BookListSerializer.Meta.fields + [
            "description",
            "pages",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class BookWriteSerializer(serializers.ModelSerializer):
    """
    POST /books/ and PATCH /books/{id}/. Counters are read-only here: they
    change only through copies. `initial_copies` is a create-time shortcut
    that makes the service add N copies with generated barcodes.
    Views answer with BookDetailSerializer.
    """

    isbn = ISBNField(
        max_length=13,
        validators=[
            UniqueValidator(
                queryset=Book.objects.all(),
                message="A book with this ISBN already exists.",
            )
        ],
    )
    category_id = serializers.PrimaryKeyRelatedField(
        source="category", queryset=Category.objects.all()
    )
    author_ids = serializers.PrimaryKeyRelatedField(
        source="authors", queryset=Author.objects.all(), many=True, allow_empty=False
    )
    initial_copies = serializers.IntegerField(
        write_only=True, required=False, min_value=0, max_value=500, default=0
    )

    class Meta:
        model = Book
        fields = [
            "title",
            "isbn",
            "publisher",
            "publication_year",
            "category_id",
            "author_ids",
            "description",
            "cover_image",
            "cover_url",
            "pages",
            "initial_copies",
        ]

    def validate_cover_url(self, url):
        if url and not url.startswith("https://"):
            raise serializers.ValidationError("The cover URL must start with https://.")
        return url

    def validate_cover_image(self, image):
        if image and image.size > MAX_COVER_BYTES:
            raise serializers.ValidationError("Cover image must be 5 MB or smaller.")
        return image

    def validate(self, attrs):
        if self.instance is not None:
            if attrs.get("initial_copies"):
                raise serializers.ValidationError(
                    {
                        "initial_copies": "Only allowed when creating a book. "
                        "Add copies with POST /books/{id}/copies/."
                    }
                )
            attrs.pop("initial_copies", None)
        return attrs


class ReviewSerializer(serializers.ModelSerializer):
    """
    Public representation. The reviewer is shown as "First L." (never the e-mail), and
    `is_mine` lets the page offer edit/delete without comparing ids.
    """

    reviewer = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ["id", "reviewer", "rating", "comment", "created_at", "is_mine"]
        read_only_fields = fields

    def get_reviewer(self, obj) -> str:
        first = (obj.user.first_name or "").strip()
        last = (obj.user.last_name or "").strip()
        if first and last:
            return f"{first} {last[0]}."
        return first or "Reader"

    def get_is_mine(self, obj) -> bool:
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and obj.user_id == request.user.id)


class ReviewWriteSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")


class RelatedBookSerializer(serializers.Serializer):
    """One 'read next' suggestion: why it was picked, and the book."""

    reason = serializers.ChoiceField(choices=["readers", "author", "category"])
    book = BookListSerializer()
