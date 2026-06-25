from django.urls import path
from . import views

urlpatterns = [
    path('register/customer/', views.register_customer, name='register_customer'),
    path('register/architect/', views.register_architect, name='register_architect'),
    path('register/manufacturer/', views.register_manufacturer, name='register_manufacturer'),
    path('register/supplier/', views.register_supplier, name='register_supplier'),
    path('me/', views.me, name='me'),
    path('upload-document/', views.upload_verification_document, name='upload_document'),
]
