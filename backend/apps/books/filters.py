import django_filters as df
from django.db.models import Q

from apps.books.models import Book


class BookFilter(df.FilterSet):
    search = df.CharFilter(method="filter_search")
    title = df.CharFilter(lookup_expr="icontains")
    isbn = df.CharFilter(method="filter_isbn")
    author = df.CharFilter(field_name="authors__name", lookup_expr="icontains", distinct=True)
    author_id = df.NumberFilter(field_name="authors__id", distinct=True)
    category = df.NumberFilter(field_name="category_id")
    category_slug = df.CharFilter(field_name="category__slug")
    publication_year = df.NumberFilter()
    year_from = df.NumberFilter(field_name="publication_year", lookup_expr="gte")
    year_to = df.NumberFilter(field_name="publication_year", lookup_expr="lte")
    available = df.BooleanFilter(method="filter_available")
    is_active = df.BooleanFilter(method="filter_is_active")

    class Meta:
        model = Book
        fields: list[str] = []

    def filter_search(self, queryset, name, value):
        value = value.strip()
        if not value:
            return queryset
        return queryset.filter(
            Q(title__icontains=value)
            | Q(authors__name__icontains=value)
            | Q(isbn__icontains=value.replace("-", ""))
        ).distinct()

    def filter_isbn(self, queryset, name, value):
        return queryset.filter(isbn=value.replace("-", "").strip())

    def filter_available(self, queryset, name, value):
        return queryset.filter(available_copies__gt=0) if value else queryset.filter(available_copies=0)

    def filter_is_active(self, queryset, name, value):
        # Only staff may look at withdrawn titles; the view enforces the default.
        return queryset.filter(is_active=value)
