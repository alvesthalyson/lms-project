from django.urls import path

from .views import LibrarySettingsView

urlpatterns = [path("settings/", LibrarySettingsView.as_view(), name="library-settings")]
