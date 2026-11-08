from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("reservations", views.ReservationViewSet, basename="reservation")

urlpatterns = router.urls
