from rest_framework.routers import DefaultRouter
from .views import ProductionStationViewSet, WorkOrderViewSet, WorkOrderItemViewSet, StationLogViewSet, MaterialConsumptionViewSet
router = DefaultRouter()
router.register(r'stations', ProductionStationViewSet, basename='productionstation')
router.register(r'work-orders', WorkOrderViewSet, basename='workorder')
router.register(r'work-order-items', WorkOrderItemViewSet, basename='workorderitem')
router.register(r'station-logs', StationLogViewSet, basename='stationlog')
router.register(r'material-consumption', MaterialConsumptionViewSet, basename='materialconsumption')
urlpatterns = router.urls
