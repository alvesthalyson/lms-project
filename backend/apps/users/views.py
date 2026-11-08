from rest_framework import filters, viewsets
from django_filters.rest_framework import DjangoFilterBackend

from apps.core.permissions import IsLibrarian

from .models import User
from .serializers import UserSerializer


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
