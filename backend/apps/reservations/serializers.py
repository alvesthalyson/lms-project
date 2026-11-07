from rest_framework import serializers

from apps.books.models import Book
from apps.books.serializers import BookSummarySerializer
from apps.users.models import Role, User
from apps.users.serializers import UserSummarySerializer

from .models import Reservation


class ReservationSerializer(serializers.ModelSerializer):
    """
    `queue_position` is the 1-based place among PENDING reservations for the
    book, and null for every other status. The view annotates it on the
    queryset (or the service sets it on the instance after create/cancel).
    """

    member = UserSummarySerializer(read_only=True)
    book = BookSummarySerializer(read_only=True)
    loan_id = serializers.IntegerField(read_only=True, allow_null=True)
    queue_position = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = Reservation
        fields = [
            "id",
            "member",
            "book",
            "status",
            "queue_position",
            "notified_at",
            "expires_at",
            "loan_id",
            "created_at",
        ]
        read_only_fields = fields


class ReservationCreateSerializer(serializers.Serializer):
    """
    POST /reservations/. Members reserve for themselves and must omit
    member_id; staff may reserve on behalf of a member. The view rejects
    member_id from a MEMBER caller with 403.
    """

    book_id = serializers.PrimaryKeyRelatedField(
        source="book", queryset=Book.objects.filter(is_active=True)
    )
    member_id = serializers.PrimaryKeyRelatedField(
        source="member",
        queryset=User.objects.filter(role=Role.MEMBER, is_active=True),
        required=False,
    )
