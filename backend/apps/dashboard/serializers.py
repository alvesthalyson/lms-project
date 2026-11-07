from rest_framework import serializers

from apps.books.serializers import BookSummarySerializer
from apps.core.models import ActivityLog
from apps.users.serializers import UserSummarySerializer


class BookStatsSerializer(serializers.Serializer):
    titles = serializers.IntegerField()
    copies_total = serializers.IntegerField()
    copies_available = serializers.IntegerField()


class MemberStatsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    blocked = serializers.IntegerField()


class LoanStatsSerializer(serializers.Serializer):
    active = serializers.IntegerField()
    overdue = serializers.IntegerField()


class ReservationStatsSerializer(serializers.Serializer):
    pending = serializers.IntegerField()
    ready = serializers.IntegerField()


class FineStatsSerializer(serializers.Serializer):
    unpaid_count = serializers.IntegerField()
    unpaid_total = serializers.DecimalField(max_digits=10, decimal_places=2)


class DashboardSummarySerializer(serializers.Serializer):
    """GET /dashboard/summary/ - one request fills the whole header row of the dashboard."""

    books = BookStatsSerializer()
    members = MemberStatsSerializer()
    loans = LoanStatsSerializer()
    reservations = ReservationStatsSerializer()
    fines = FineStatsSerializer()


class MostBorrowedSerializer(serializers.Serializer):
    """GET /dashboard/most-borrowed/ - a plain top-N array, not paginated."""

    book = BookSummarySerializer()
    loan_count = serializers.IntegerField()


class ActivityLogSerializer(serializers.ModelSerializer):
    action_label = serializers.CharField(source="get_action_display", read_only=True)
    actor = UserSummarySerializer(read_only=True)
    member = UserSummarySerializer(read_only=True)
    book = BookSummarySerializer(read_only=True)

    class Meta:
        model = ActivityLog
        fields = [
            "id",
            "action",
            "action_label",
            "actor",
            "member",
            "book",
            "metadata",
            "created_at",
        ]
        read_only_fields = fields
