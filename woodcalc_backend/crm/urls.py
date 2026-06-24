from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, LeadViewSet, QuotationViewSet, QuotationItemViewSet
router = DefaultRouter()
router.register(r'clients', ClientViewSet, basename='client')
router.register(r'leads', LeadViewSet, basename='lead')
router.register(r'quotations', QuotationViewSet, basename='quotation')
router.register(r'quotation-items', QuotationItemViewSet, basename='quotationitem')
urlpatterns = router.urls
