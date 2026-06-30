from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from .models import ProductionStation, WorkOrder, WorkOrderItem, StationLog, MaterialConsumption
from .serializers import (
    ProductionStationSerializer, WorkOrderSerializer, WorkOrderItemSerializer,
    StationLogSerializer, MaterialConsumptionSerializer,
)


class ProductionStationViewSet(ModelViewSet):
    queryset = ProductionStation.objects.all().order_by('name')
    serializer_class = ProductionStationSerializer
    permission_classes = [IsAuthenticated]


class WorkOrderViewSet(ModelViewSet):
    queryset = WorkOrder.objects.all().order_by('-created_at')
    serializer_class = WorkOrderSerializer
    permission_classes = [IsAuthenticated]


class WorkOrderItemViewSet(ModelViewSet):
    queryset = WorkOrderItem.objects.all()
    serializer_class = WorkOrderItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = WorkOrderItem.objects.all()
        work_order_id = self.request.query_params.get('work_order')
        if work_order_id:
            qs = qs.filter(work_order_id=work_order_id)
        return qs


class StationLogViewSet(ModelViewSet):
    queryset = StationLog.objects.all()
    serializer_class = StationLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = StationLog.objects.all()
        work_order_id = self.request.query_params.get('work_order')
        if work_order_id:
            qs = qs.filter(work_order_id=work_order_id)
        return qs


class MaterialConsumptionViewSet(ModelViewSet):
    queryset = MaterialConsumption.objects.all().order_by('-recorded_at')
    serializer_class = MaterialConsumptionSerializer
    permission_classes = [IsAuthenticated]
