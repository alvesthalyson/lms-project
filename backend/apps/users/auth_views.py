from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.core.serializers import ErrorResponseSerializer

from .serializers import (
    AuthResponseSerializer,
    LoginSerializer,
    LogoutSerializer,
    RegisterSerializer,
    UserSerializer,
)
from .services import user_service


class PublicAuthMixin:
    """
    register / login / refresh are open to everyone, with two deliberate details:

    * authentication_classes = []  A client that still sends an expired access
      token must not get a 401 on the very endpoint that fixes it.
    * 10 requests/min per IP (the "auth" scope) against password guessing.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class RegisterView(PublicAuthMixin, GenericAPIView):
    serializer_class = RegisterSerializer

    @extend_schema(
        request=RegisterSerializer,
        responses={201: AuthResponseSerializer, 400: ErrorResponseSerializer},
        summary="Register a new member account",
    )
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = user_service.register_member(**serializer.validated_data)

        refresh = LoginSerializer.get_token(user)  # same claims as a normal login (role)
        body = {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data,
        }
        return Response(body, status=status.HTTP_201_CREATED)


class LoginView(PublicAuthMixin, TokenObtainPairView):
    """Email + password -> {access, refresh, user}. Blocked members can still log in."""

    serializer_class = LoginSerializer

    @extend_schema(
        responses={200: AuthResponseSerializer, 401: ErrorResponseSerializer},
        summary="Log in",
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class RefreshView(PublicAuthMixin, TokenRefreshView):
    """
    Exchange a refresh token for a new access AND refresh token (rotation). The old
    refresh token is blacklisted, so a second use of it answers 401 token_not_valid.
    """

    @extend_schema(responses={401: ErrorResponseSerializer}, summary="Refresh the tokens")
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class LogoutView(GenericAPIView):
    """Blacklist the refresh token. The access token simply expires (15 minutes)."""

    serializer_class = LogoutSerializer
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=LogoutSerializer,
        responses={204: None, 400: ErrorResponseSerializer},
        summary="Log out (blacklist the refresh token)",
    )
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            token = RefreshToken(serializer.validated_data["refresh"])
        except TokenError:
            raise ValidationError({"refresh": ["Token is invalid or expired."]}) from None

        # You can only revoke your own sessions.
        if str(token.get(api_settings.USER_ID_CLAIM)) != str(request.user.pk):
            raise PermissionDenied("This refresh token belongs to another user.")

        token.blacklist()
        return Response(status=status.HTTP_204_NO_CONTENT)
