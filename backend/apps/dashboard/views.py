from datetime import timedelta
from decimal import Decimal

import django_filters as df
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.books.models import Book
from apps.books.serializers import BookSummarySerializer
from apps.core.models import ActivityLog
from apps.core.permissions import IsLibrarian
from apps.loans.models import Fine, FineStatus, Loan
from apps.reservations.models import Reservation, ReservationStatus
from apps.users.models import Role, User

from .serializers import ActivityLogSerializer, DashboardSummarySerializer, MostBorrowedSerializer


class SummaryView(APIView):
    permission_classes = [IsLibrarian]

    def get(self, request):
        books = Book.objects.filter(is_active=True).aggregate(
            titles=Count("id"), total=Sum("total_copies"), available=Sum("available_copies")
        )
        members = User.objects.filter(role=Role.MEMBER)
        fines = Fine.objects.filter(status=FineStatus.UNPAID).aggregate(
            n=Count("id"), total=Sum("amount")
        )
        body = {
            "books": {
                "titles": books["titles"],
                "copies_total": books["total"] or 0,
                "copies_available": books["available"] or 0,
            },
            "members": {"total": members.count(), "blocked": members.filter(is_blocked=True).count()},
            "loans": {
                "active": Loan.objects.active().count(),
                "overdue": Loan.objects.overdue().count(),
            },
            "reservations": {
                "pending": Reservation.objects.filter(status=ReservationStatus.PENDING).count(),
                "ready": Reservation.objects.filter(status=ReservationStatus.READY).count(),
            },
            "fines": {"unpaid_count": fines["n"], "unpaid_total": fines["total"] or Decimal("0.00")},
        }
        return Response(DashboardSummarySerializer(body).data)


def _int_param(request, name: str, default: int, low: int, high: int) -> int:
    raw = request.query_params.get(name)
    if raw in (None, ""):
        return default
    try:
        value = int(raw)
    except ValueError:
        raise ValidationError({name: "Must be a whole number."})
    if not low <= value <= high:
        raise ValidationError({name: f"Must be between {low} and {high}."})
    return value


class MostBorrowedView(APIView):
    permission_classes = [IsLibrarian]

    def get(self, request):
        days = _int_param(request, "days", 30, 1, 365)
        limit = _int_param(request, "limit", 10, 1, 50)
        since = timezone.now() - timedelta(days=days)
        rows = list(
            Loan.objects.filter(loaned_at__gte=since)
            .values("copy__book_id")
            .annotate(loan_count=Count("id"))
            .order_by("-loan_count", "copy__book_id")[:limit]
        )
        books = Book.objects.in_bulk([row["copy__book_id"] for row in rows])
        body = [
            {"book": books[row["copy__book_id"]], "loan_count": row["loan_count"]} for row in rows
        ]
        return Response(MostBorrowedSerializer(body, many=True, context={"request": request}).data)


class ActivityFilter(df.FilterSet):
    action = df.CharFilter()
    member = df.NumberFilter(field_name="member_id")
    book = df.NumberFilter(field_name="book_id")
    since = df.DateFilter(field_name="created_at", lookup_expr="date__gte")

    class Meta:
        model = ActivityLog
        fields: list[str] = []


class ActivityView(generics.ListAPIView):
    permission_classes = [IsLibrarian]
    queryset = ActivityLog.objects.select_related("actor", "member", "book")
    serializer_class = ActivityLogSerializer
    filterset_class = ActivityFilter
    filter_backends = [DjangoFilterBackend]
