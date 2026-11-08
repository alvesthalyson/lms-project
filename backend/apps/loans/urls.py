from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("loans", views.LoanViewSet, basename="loan")
router.register("fines", views.FineViewSet, basename="fine")

urlpatterns = router.urls
