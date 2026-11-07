from decimal import Decimal

from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.books.models import Book, BookCopy, CopyStatus
from apps.books.serializers import BookSummarySerializer
from apps.users.models import Role, User
from apps.users.serializers import UserSummarySerializer

from .models import Fine, FineReason, Loan

# --------------------------------------------------------------------------
# Loans
# --------------------------------------------------------------------------


class CopyBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookCopy
        fields = ["id", "barcode"]
        read_only_fields = fields


class LoanSerializer(serializers.ModelSerializer):
    """
    Read representation. `status` and `days_overdue` are derived, never stored.
    Views must use select_related("member", "copy__book") to avoid N+1 queries.
    The frontend computes remaining renewals as settings.max_renewals - renewal_count.
    """

    member = UserSummarySerializer(read_only=True)
    copy = CopyBriefSerializer(read_only=True)
    book = BookSummarySerializer(source="copy.book", read_only=True)
    status = serializers.SerializerMethodField()
    days_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Loan
        fields = [
            "id",
            "member",
            "copy",
            "book",
            "loaned_at",
            "due_date",
            "returned_at",
            "status",
            "days_overdue",
            "renewal_count",
        ]
        read_only_fields = fields

    @extend_schema_field(
        serializers.ChoiceField(choices=["active", "overdue", "returned"])
    )
    def get_status(self, obj) -> str:
        if obj.returned_at is not None:
            return "returned"
        return "overdue" if obj.due_date < timezone.localdate() else "active"

    def get_days_overdue(self, obj) -> int:
        return obj.days_overdue()


class LoanCreateSerializer(serializers.Serializer):
    """
    POST /loans/. Identify the copy directly (copy_id) or let the service pick
    one for a title (book_id). Provide exactly one of the two.
    """

    member_id = serializers.PrimaryKeyRelatedField(
        source="member",
        queryset=User.objects.filter(role=Role.MEMBER, is_active=True),
    )
    copy_id = serializers.PrimaryKeyRelatedField(
        source="copy", queryset=BookCopy.objects.all(), required=False
    )
    book_id = serializers.PrimaryKeyRelatedField(
        source="book", queryset=Book.objects.filter(is_active=True), required=False
    )
    due_date = serializers.DateField(
        required=False, help_text="Defaults to today + loan_period_days."
    )

    def validate_due_date(self, value):
        if value < timezone.localdate():
            raise serializers.ValidationError("Due date cannot be in the past.")
        return value

    def validate(self, attrs):
        if ("copy" in attrs) == ("book" in attrs):
            raise serializers.ValidationError(
                "Provide exactly one of copy_id or book_id.",
                code="copy_or_book_required",
            )
        return attrs


class LoanReturnSerializer(serializers.Serializer):
    """POST /loans/{id}/return/ - both fields optional, body may be empty."""

    copy_status = serializers.ChoiceField(
        choices=[
            (CopyStatus.AVAILABLE.value, CopyStatus.AVAILABLE.label),
            (CopyStatus.DAMAGED.value, CopyStatus.DAMAGED.label),
        ],
        default=CopyStatus.AVAILABLE.value,
    )
    condition_notes = serializers.CharField(
        required=False, allow_blank=True, max_length=1000
    )


# --------------------------------------------------------------------------
# Fines
# --------------------------------------------------------------------------


class FineSerializer(serializers.ModelSerializer):
    loan_id = serializers.IntegerField(read_only=True)
    member = UserSummarySerializer(source="loan.member", read_only=True)
    book = BookSummarySerializer(source="loan.copy.book", read_only=True)

    class Meta:
        model = Fine
        fields = [
            "id",
            "loan_id",
            "member",
            "book",
            "reason",
            "amount",
            "status",
            "paid_at",
            "note",
            "created_at",
        ]
        read_only_fields = fields


class FineCreateSerializer(serializers.Serializer):
    """
    POST /fines/ - manual fines only (lost or damaged). Overdue fines are
    created automatically when a late loan is returned.
    """

    loan_id = serializers.PrimaryKeyRelatedField(
        source="loan", queryset=Loan.objects.all()
    )
    reason = serializers.ChoiceField(
        choices=[
            (FineReason.LOST.value, FineReason.LOST.label),
            (FineReason.DAMAGED.value, FineReason.DAMAGED.label),
        ]
    )
    amount = serializers.DecimalField(
        max_digits=8, decimal_places=2, min_value=Decimal("0.01")
    )
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def validate(self, attrs):
        if Fine.objects.filter(loan=attrs["loan"], reason=attrs["reason"]).exists():
            raise serializers.ValidationError(
                "This loan already has a fine for that reason.", code="duplicate_fine"
            )
        return attrs


class FineActionSerializer(serializers.Serializer):
    """POST /fines/{id}/pay/ and /waive/ - optional note recorded on the fine."""

    note = serializers.CharField(required=False, allow_blank=True, max_length=255)


class LoanReturnResponseSerializer(serializers.Serializer):
    """Documents the body of POST /loans/{id}/return/."""

    loan = LoanSerializer()
    fine = FineSerializer(allow_null=True)
