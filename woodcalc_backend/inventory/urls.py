from rest_framework.routers import DefaultRouter
from .views import MaterialViewSet, SupplierViewSet, StockMovementViewSet, StockAlertViewSet, MaterialTextureViewSet, DrawerSystemViewSet
router = DefaultRouter()
router.register(r'materials', MaterialViewSet, basename='material')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'movements', StockMovementViewSet, basename='stockmovement')
router.register(r'alerts', StockAlertViewSet, basename='stockalert')
router.register(r'textures', MaterialTextureViewSet, basename='materialtexture')
router.register(r'drawer-systems', DrawerSystemViewSet, basename='drawersystem')
urlpatterns = router.urls
