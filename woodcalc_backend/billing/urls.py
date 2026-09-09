from django.urls import path
from . import views

urlpatterns = [
    path('checkout/', views.checkout, name='billing_checkout'),
    path('webhook/', views.webhook, name='billing_webhook'),
]
