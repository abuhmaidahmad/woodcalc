from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import MaterialViewSet, SupplierViewSet, StockMovementViewSet, StockAlertViewSet, DrawerSystemViewSet, SinkViewSet, CabinetTemplateViewSet
from .ai_views import DesignerAgentChatView
router = DefaultRouter()
router.register(r'materials', MaterialViewSet, basename='material')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'movements', StockMovementViewSet, basename='stockmovement')
router.register(r'alerts', StockAlertViewSet, basename='stockalert')
router.register(r'drawer-systems', DrawerSystemViewSet, basename='drawersystem')
router.register(r'sinks', SinkViewSet, basename='sink')
router.register(r'cabinet-templates', CabinetTemplateViewSet, basename='cabinettemplate')
urlpatterns = router.urls + [
    path('designer-agent/chat/', DesignerAgentChatView.as_view(), name='designer-agent-chat'),
]
