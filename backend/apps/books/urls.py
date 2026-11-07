from rest_framework.routers import DefaultRouter

from apps.books import views

router = DefaultRouter()
router.register("categories", views.CategoryViewSet, basename="category")
router.register("authors", views.AuthorViewSet, basename="author")
router.register("books", views.BookViewSet, basename="book")
router.register("copies", views.CopyViewSet, basename="copy")

urlpatterns = router.urls
