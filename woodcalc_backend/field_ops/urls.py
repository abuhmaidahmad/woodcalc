from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("installations", views.InstallationViewSet, basename="installation")
router.register("assignments", views.AssignmentViewSet, basename="installation-assignment")
router.register("locked-rooms", views.LockedRoomViewSet, basename="locked-room")
router.register("crew", views.CrewViewSet, basename="crew")
router.register("my-jobs", views.MyJobsViewSet, basename="my-job")

urlpatterns = [
    path("", include(router.urls)),
]
