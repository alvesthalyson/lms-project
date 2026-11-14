from django.db.models import Avg, Count, Exists, OuterRef, QuerySet, Value, BooleanField
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.books import filters
from apps.books.models import Author, Book, BookCopy, Category, Favorite, Review
from apps.books.serializers import (
    AuthorSerializer,
    BookCopyCreateSerializer,
    BookCopySerializer,
    BookCopyUpdateSerializer,
    BookDetailSerializer,
    BookListSerializer,
    BookWriteSerializer,
    CategorySerializer,
    RelatedBookSerializer,
    ReviewSerializer,
    ReviewWriteSerializer,
)
from apps.books.services import book_service, discovery_service
from apps.core.permissions import IsAdmin, IsLibrarian, IsLibrarianOrReadOnly
from apps.users.models import Role

STAFF_ROLES = (Role.ADMIN, Role.LIBRARIAN)


def _is_staff(request) -> bool:
    return getattr(request.user, "role", None) in STAFF_ROLES


class _CatalogueViewSet(viewsets.ModelViewSet):
    """Public reads, Librarian+ writes, Admin-only deletes."""

    permission_classes = [IsLibrarianOrReadOnly]

    def get_permissions(self):
        if self.action == "destroy":
            return [IsAdmin()]
        return super().get_permissions()


class CategoryViewSet(_CatalogueViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    search_fields = ["name"]
    ordering_fields = ["name"]
    ordering = ["name"]

    def perform_destroy(self, instance):
        book_service.ensure_category_deletable(instance)
        instance.delete()


class AuthorViewSet(_CatalogueViewSet):
    queryset = Author.objects.all()
    serializer_class = AuthorSerializer
    search_fields = ["name"]
    ordering_fields = ["name"]
    ordering = ["name"]

    def perform_destroy(self, instance):
        book_service.ensure_author_deletable(instance)
        instance.delete()


class BookViewSet(_CatalogueViewSet):
    filterset_class = filters.BookFilter
    ordering_fields = ["title", "created_at", "publication_year", "available_copies", "rating_avg"]
    ordering = ["title", "id"]

    def get_queryset(self) -> QuerySet[Book]:
        queryset = (
            Book.objects.select_related("category")
            .prefetch_related("authors")
            .annotate(rating_avg=Avg("reviews__rating"), rating_count=Count("reviews", distinct=True))
        )
        user = self.request.user
        if user.is_authenticated:
            queryset = queryset.annotate(
                is_favorite=Exists(Favorite.objects.filter(user=user, book=OuterRef("pk")))
            )
        else:
            queryset = queryset.annotate(is_favorite=Value(False, output_field=BooleanField()))
        if _is_staff(self.request):
            # Staff see withdrawn titles only when they ask (?is_active=false).
            if "is_active" not in self.request.query_params and self.action == "list":
                queryset = queryset.filter(is_active=True)
            return queryset
        return queryset.filter(is_active=True)

    def get_permissions(self):
        # Reviews: anyone reads, signed-in users write. Wish list: signed-in only. Related: public.
        if self.action == "reviews":
            return [AllowAny()] if self.request.method == "GET" else [IsAuthenticated()]
        if self.action == "favorite":
            return [IsAuthenticated()]
        if self.action == "related":
            return [AllowAny()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == "list":
            return BookListSerializer
        if self.action in ("create", "update", "partial_update"):
            return BookWriteSerializer
        return BookDetailSerializer

    def _detail(self, book: Book) -> Response:
        book = (
            Book.objects.select_related("category").prefetch_related("authors").get(pk=book.pk)
        )
        return Response(BookDetailSerializer(book, context=self.get_serializer_context()).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        book = book_service.create_book(serializer.validated_data)
        response = self._detail(book)
        response.status_code = status.HTTP_201_CREATED
        return response

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        book = self.get_object()
        serializer = self.get_serializer(book, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        book = book_service.update_book(book, serializer.validated_data)
        return self._detail(book)

    def perform_destroy(self, instance):
        book_service.deactivate_book(instance)

    @action(detail=True, methods=["get", "post"], url_path="copies", permission_classes=[IsLibrarian])
    def copies(self, request, pk=None):
        book = self.get_object()
        if request.method == "GET":
            qs = book.copies.order_by("barcode")
            wanted = request.query_params.get("status")
            if wanted:
                qs = qs.filter(status=wanted)
            page = self.paginate_queryset(qs)
            return self.get_paginated_response(BookCopySerializer(page, many=True).data)
        serializer = BookCopyCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        copy = book_service.add_copy(book, serializer.validated_data)
        return Response(BookCopySerializer(copy).data, status=status.HTTP_201_CREATED)


    @action(detail=True, methods=["get", "post"], url_path="reviews")
    def reviews(self, request, pk=None):
        """GET: the book's reviews, newest first. POST: add or edit the caller's own review."""
        book = self.get_object()
        if request.method == "GET":
            queryset = book.reviews.select_related("user")
            page = self.paginate_queryset(queryset)
            data = ReviewSerializer(page, many=True, context={"request": request}).data
            return self.get_paginated_response(data)
        serializer = ReviewWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review, created = discovery_service.upsert_review(
            user=request.user, book=book, **serializer.validated_data
        )
        review = Review.objects.select_related("user").get(pk=review.pk)
        return Response(
            ReviewSerializer(review, context={"request": request}).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=["put", "delete"], url_path="favorite")
    def favorite(self, request, pk=None):
        """PUT adds the book to the caller's wish list, DELETE removes it. Both are idempotent."""
        book = self.get_object()
        wanted = request.method == "PUT"
        discovery_service.set_favorite(user=request.user, book=book, wanted=wanted)
        return Response({"is_favorite": wanted})

    @action(detail=True, methods=["get"], url_path="related")
    def related(self, request, pk=None):
        """'Read next' suggestions: readers also borrowed, same author, same category."""
        book = self.get_object()
        picks = discovery_service.recommendations(book, limit=6)
        ids = [b.pk for b, _ in picks]
        annotated = {b.pk: b for b in self.get_queryset().filter(pk__in=ids)}
        body = [{"reason": reason, "book": annotated[b.pk]} for b, reason in picks if b.pk in annotated]
        return Response(
            RelatedBookSerializer(body, many=True, context={"request": request}).data
        )


class ReviewViewSet(mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """DELETE /reviews/{id}/: the author or staff. (Reading and writing go through the book.)"""

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Review.objects.all()
        return queryset if _is_staff(self.request) else queryset.filter(user=self.request.user)


class CopyViewSet(viewsets.GenericViewSet):
    """PATCH /copies/{id}/ and GET /copies/{id}/ (Librarian+)."""

    queryset = BookCopy.objects.select_related("book")
    serializer_class = BookCopySerializer
    permission_classes = [IsLibrarian]
    http_method_names = ["get", "patch", "head", "options"]

    def retrieve(self, request, pk=None):
        return Response(BookCopySerializer(self.get_object()).data)

    def partial_update(self, request, pk=None):
        copy = self.get_object()
        serializer = BookCopyUpdateSerializer(copy, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        copy = book_service.update_copy(copy, serializer.validated_data)
        return Response(BookCopySerializer(copy).data)
