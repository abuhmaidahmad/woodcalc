from rest_framework.routers import DefaultRouter
from .views import PurchaseOrderViewSet, PurchaseOrderLineItemViewSet

router = DefaultRouter()
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchaseorder')
router.register(r'line-items', PurchaseOrderLineItemViewSet, basename='purchaseorderlineitem')
urlpatterns = router.urls
