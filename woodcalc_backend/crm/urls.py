from rest_framework.routers import DefaultRouter
from .views import (
    ClientViewSet, LeadViewSet, QuotationViewSet, QuotationItemViewSet,
    ProjectViewSet, RoomViewSet, PaymentViewSet
)

router = DefaultRouter()
router.register(r'clients', ClientViewSet, basename='client')
router.register(r'leads', LeadViewSet, basename='lead')
router.register(r'quotations', QuotationViewSet, basename='quotation')
router.register(r'quotation-items', QuotationItemViewSet, basename='quotationitem')
router.register(r'projects', ProjectViewSet, basename='project')
router.register(r'rooms', RoomViewSet, basename='room')
router.register(r'payments', PaymentViewSet, basename='payment')

urlpatterns = router.urls
