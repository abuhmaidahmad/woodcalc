from rest_framework.routers import DefaultRouter
from .views import MaterialViewSet, SupplierViewSet, StockMovementViewSet, StockAlertViewSet
router = DefaultRouter()
router.register(r'materials', MaterialViewSet, basename='material')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'movements', StockMovementViewSet, basename='stockmovement')
router.register(r'alerts', StockAlertViewSet, basename='stockalert')
urlpatterns = router.urls
