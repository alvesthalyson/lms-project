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
