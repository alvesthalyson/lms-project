from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from apps.core.views import healthz

api_v1 = [
    path("auth/", include("apps.users.auth_urls")),
    path("", include("apps.users.urls")),  # users/ (staff lookup)
    path("", include("apps.books.urls")),  # books/, copies/, categories/, authors/
    path("", include("apps.loans.urls")),  # loans/, fines/
    path("", include("apps.reservations.urls")),  # reservations/
    path("", include("apps.dashboard.urls")),  # dashboard/...
    path("", include("apps.core.urls")),  # settings/
]

urlpatterns = [
    path("healthz/", healthz, name="healthz"),
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
