from django.db import connection
from django.http import JsonResponse


def healthz(request):
    """Liveness + database check for Docker / load balancers. No auth, no throttling, no body details."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        return JsonResponse({"status": "unavailable"}, status=503)
    return JsonResponse({"status": "ok"})


from rest_framework.permissions import IsAuthenticated  # noqa: E402
from rest_framework.response import Response  # noqa: E402
from rest_framework.views import APIView  # noqa: E402

from .models import LibrarySettings  # noqa: E402
from .permissions import IsAdmin  # noqa: E402
from .serializers import LibrarySettingsSerializer  # noqa: E402


class LibrarySettingsView(APIView):
    """GET for everyone signed in (members need the limits); PATCH for admins."""

    def get_permissions(self):
        return [IsAdmin()] if self.request.method == "PATCH" else [IsAuthenticated()]

    def get(self, request):
        return Response(LibrarySettingsSerializer(LibrarySettings.load()).data)

    def patch(self, request):
        instance = LibrarySettings.load()
        serializer = LibrarySettingsSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
