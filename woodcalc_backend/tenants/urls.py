from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('members', views.MembershipViewSet, basename='member')

urlpatterns = [
    path('settings/', views.company_settings, name='company_settings'),
    path('permissions/', views.permissions_registry, name='permissions_registry'),
    path('', include(router.urls)),
]
