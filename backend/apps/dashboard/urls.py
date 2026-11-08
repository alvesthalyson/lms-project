from django.urls import path

from . import views

urlpatterns = [
    path("dashboard/summary/", views.SummaryView.as_view(), name="dashboard-summary"),
    path("dashboard/most-borrowed/", views.MostBorrowedView.as_view(), name="dashboard-most-borrowed"),
    path("dashboard/activity/", views.ActivityView.as_view(), name="dashboard-activity"),
]
