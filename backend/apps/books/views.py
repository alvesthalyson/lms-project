from django.db.models import QuerySet
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.books import filters
from apps.books.models import Author, Book, BookCopy, Category
from apps.books.serializers import (
    AuthorSerializer,
    BookCopyCreateSerializer,
    BookCopySerializer,
    BookCopyUpdateSerializer,
    BookDetailSerializer,
    BookListSerializer,
    BookWriteSerializer,
    CategorySerializer,
)
from apps.books.services import book_service
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
    ordering_fields = ["title", "created_at", "publication_year", "available_copies"]
    ordering = ["title", "id"]

    def get_queryset(self) -> QuerySet[Book]:
        queryset = Book.objects.select_related("category").prefetch_related("authors")
        if _is_staff(self.request):
            # Staff see withdrawn titles only when they ask (?is_active=false).
            if "is_active" not in self.request.query_params and self.action == "list":
                queryset = queryset.filter(is_active=True)
            return queryset
        return queryset.filter(is_active=True)

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
