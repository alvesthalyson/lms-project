from django.db.models import Case, Count, IntegerField, OuterRef, Q, Subquery, Value, When
from django.db.models.functions import Coalesce
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.mixins import MemberScopedQuerysetMixin
from apps.users.models import Role

from .filters import ReservationFilter
from .models import Reservation, ReservationStatus
from .serializers import ReservationCreateSerializer, ReservationSerializer
from .services import reservation_service


def _with_queue_position(queryset):
    """Annotate the 1-based FIFO place among PENDING reservations (null for other statuses)."""
    ahead = (
        Reservation.objects.filter(book_id=OuterRef("book_id"), status=ReservationStatus.PENDING)
        .filter(
            Q(created_at__lt=OuterRef("created_at"))
            | Q(created_at=OuterRef("created_at"), id__lt=OuterRef("id"))
        )
        .order_by()
        .values("book_id")
        .annotate(n=Count("id"))
        .values("n")
    )
    return queryset.annotate(
        queue_position=Case(
            When(
                status=ReservationStatus.PENDING,
                then=Coalesce(Subquery(ahead, output_field=IntegerField()), Value(0)) + Value(1),
            ),
            default=Value(None),
            output_field=IntegerField(null=True),
        )
    )


class ReservationViewSet(MemberScopedQuerysetMixin, viewsets.GenericViewSet):
    queryset = Reservation.objects.select_related("member", "book")
    serializer_class = ReservationSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = ReservationFilter
    ordering_fields = ["created_at"]
    ordering = ["created_at", "id"]
    member_field = "member"

    def get_queryset(self):
        return _with_queue_position(super().get_queryset())

    def list(self, request):
        page = self.paginate_queryset(self.filter_queryset(self.get_queryset()))
        return self.get_paginated_response(ReservationSerializer(page, many=True).data)

    def retrieve(self, request, pk=None):
        return Response(ReservationSerializer(self.get_object()).data)

    def create(self, request):
        serializer = ReservationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if request.user.role == Role.MEMBER:
            if "member" in data:
                raise PermissionDenied("Members can only reserve for themselves.")
            member = request.user
        else:
            member = data.get("member")
            if member is None:
                raise ValidationError({"member_id": "Required when reserving on behalf of a member."})
        reservation = reservation_service.reserve(
            member=member, book=data["book"], requested_by=request.user
        )
        reservation.queue_position = reservation_service.queue_position(reservation)
        return Response(ReservationSerializer(reservation).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        reservation = reservation_service.cancel(
            reservation=self.get_object(), cancelled_by=request.user
        )
        reservation.queue_position = None
        return Response(ReservationSerializer(reservation).data)
