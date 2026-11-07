from decimal import Decimal

from rest_framework import serializers

from .models import LibrarySettings


class ErrorResponseSerializer(serializers.Serializer):
    """Documents the error body for drf-spectacular (every non-2xx response)."""

    detail = serializers.CharField()
    code = serializers.CharField()
    field_errors = serializers.DictField(
        child=serializers.ListField(child=serializers.CharField())
    )


class LibrarySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = LibrarySettings
        fields = [
            "loan_period_days",
            "renewal_period_days",
            "max_renewals",
            "max_active_loans",
            "fine_per_day",
            "reservation_hold_hours",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]
        extra_kwargs = {
            "loan_period_days": {"min_value": 1, "max_value": 365},
            "renewal_period_days": {"min_value": 1, "max_value": 365},
            "max_renewals": {"min_value": 0, "max_value": 10},
            "max_active_loans": {"min_value": 1, "max_value": 50},
            "reservation_hold_hours": {"min_value": 1, "max_value": 720},
            "fine_per_day": {"min_value": Decimal("0")},
        }
