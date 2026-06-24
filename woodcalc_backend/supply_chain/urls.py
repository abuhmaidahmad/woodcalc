from rest_framework.routers import DefaultRouter
from .views import PurchaseOrderViewSet, PurchaseOrderLineViewSet, GoodsReceiptViewSet, GoodsReceiptLineViewSet
router = DefaultRouter()
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchaseorder')
router.register(r'purchase-order-lines', PurchaseOrderLineViewSet, basename='purchaseorderline')
router.register(r'goods-receipts', GoodsReceiptViewSet, basename='goodsreceipt')
router.register(r'goods-receipt-lines', GoodsReceiptLineViewSet, basename='goodsreceiptline')
urlpatterns = router.urls
