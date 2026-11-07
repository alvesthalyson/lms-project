from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User

# --------------------------------------------------------------------------
# Read serializers
# --------------------------------------------------------------------------


class UserSummarySerializer(serializers.ModelSerializer):
    """Small nested representation used inside loans, fines and reservations."""

    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "member_number"]
        read_only_fields = fields

    def get_full_name(self, obj) -> str:
        return obj.get_full_name() or obj.email


class UserSerializer(serializers.ModelSerializer):
    """Full read representation (profile, user detail, user list)."""

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "member_number",
            "phone",
            "address",
            "is_active",
            "is_blocked",
            "blocked_reason",
            "blocked_at",
            "date_joined",
        ]
        read_only_fields = fields


class BorrowingStatusSerializer(serializers.Serializer):
    """Output of GET /users/{id}/borrowing-status/ (built by the user service)."""

    can_borrow = serializers.BooleanField()
    reasons = serializers.ListField(
        child=serializers.ChoiceField(
            choices=[
                "manually_blocked",
                "unpaid_fines",
                "overdue_loans",
                "loan_limit_reached",
            ]
        )
    )
    active_loans = serializers.IntegerField()
    overdue_loans = serializers.IntegerField()
    unpaid_fines_total = serializers.DecimalField(max_digits=10, decimal_places=2)
    max_active_loans = serializers.IntegerField()


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------


def _email_field():
    return serializers.EmailField(
        validators=[
            UniqueValidator(
                queryset=User.objects.all(),
                lookup="iexact",
                message="A user with this email already exists.",
            )
        ]
    )


class RegisterSerializer(serializers.ModelSerializer):
    """Public self-registration. Always creates a MEMBER (the service decides the role)."""

    email = _email_field()
    password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
        trim_whitespace=False,
        style={"input_type": "password"},
    )

    class Meta:
        model = User
        fields = ["email", "password", "first_name", "last_name", "phone", "address"]
        extra_kwargs = {
            "first_name": {"required": True, "allow_blank": False},
            "last_name": {"required": True, "allow_blank": False},
        }

    def validate_email(self, value):
        return value.strip().lower()


class LoginSerializer(TokenObtainPairSerializer):
    """POST {email, password} -> {access, refresh, user}. Blocked users can still log in."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role  # lets the frontend route by role without a /me call
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class AuthResponseSerializer(serializers.Serializer):
    """Documents the body of register and login responses."""

    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer()


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(
        write_only=True, validators=[validate_password], trim_whitespace=False
    )

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError(
                "Current password is incorrect.", code="invalid_password"
            )
        return value


# --------------------------------------------------------------------------
# Write serializers
# --------------------------------------------------------------------------


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """PATCH /users/me/ - members can only touch these fields."""

    class Meta:
        model = User
        fields = ["first_name", "last_name", "phone", "address"]


class UserAdminWriteSerializer(serializers.ModelSerializer):
    """POST /users/ and PATCH /users/{id}/ (admin only)."""

    email = _email_field()
    password = serializers.CharField(
        write_only=True,
        required=False,
        validators=[validate_password],
        trim_whitespace=False,
        style={"input_type": "password"},
    )

    class Meta:
        model = User
        fields = [
            "email",
            "password",
            "first_name",
            "last_name",
            "role",
            "phone",
            "address",
            "is_active",
        ]

    def validate_email(self, value):
        return value.strip().lower()

    def validate(self, attrs):
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({"password": "This field is required."})
        return attrs


class BlockUserSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=255)
