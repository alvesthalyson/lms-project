from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import IsLibrarian

from .models import User
from .serializers import ChangePasswordSerializer, ProfileUpdateSerializer, UserSerializer
from .services import user_service


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """Staff-only member lookup (the loan desk picks a member from here)."""

    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsLibrarian]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["role", "is_blocked", "is_active"]
    search_fields = ["email", "first_name", "last_name", "member_number"]
    ordering_fields = ["last_name", "date_joined"]
    ordering = ["last_name", "first_name", "id"]

    # `me` is declared on the list route, so the router puts it before /users/{id}/.
    @action(detail=False, methods=["get", "patch"], url_path="me", permission_classes=[IsAuthenticated])
    def me(self, request):
        """Own profile: any signed-in user. PATCH changes contact data only."""
        if request.method == "PATCH":
            serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            user_service.update_profile(user=request.user, validated_data=serializer.validated_data)
        return Response(UserSerializer(request.user).data)

    @action(detail=False, methods=["post"], url_path="me/password", permission_classes=[IsAuthenticated])
    def change_password(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user_service.change_password(user=request.user, new_password=serializer.validated_data["new_password"])
        return Response(status=status.HTTP_204_NO_CONTENT)
