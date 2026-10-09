from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from tenants.mixins import TenantScopedMixin
from tenants.permissions import HasActiveCompany
from .models import ProductionStation, WorkOrder, WorkOrderItem, StationLog, MaterialConsumption
from .models import StockSheet, CuttingJob
from .serializers import (
    ProductionStationSerializer, WorkOrderSerializer, WorkOrderItemSerializer, WorkOrderItemBulkSerializer,
    StationLogSerializer, MaterialConsumptionSerializer,
)
from .serializers import StockSheetSerializer, CuttingJobSerializer
from .cutting_service import optimize_job
from .cutting_export import export_csv, export_pdf
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.http import HttpResponse


class ProductionStationViewSet(TenantScopedMixin, ModelViewSet):
    queryset = ProductionStation.objects.all().order_by('name')
    serializer_class = ProductionStationSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]


class WorkOrderViewSet(TenantScopedMixin, ModelViewSet):
    queryset = WorkOrder.objects.all().order_by('-created_at')
    serializer_class = WorkOrderSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]

    def get_queryset(self):
        qs = super().get_queryset()
        room_id = self.request.query_params.get('room_id_ref')
        if room_id:
            qs = qs.filter(room_id_ref=room_id)
        return qs

    @action(detail=True, methods=['post'], url_path='items')
    def add_items(self, request, pk=None):
        """Create a work order's whole cut list in one request. The planner used to
        POST one work-order-item per distinct part (100+ sequential round trips on a
        full kitchen); get_object() scopes the order to the caller's tenant."""
        work_order = self.get_object()
        serializer = WorkOrderItemBulkSerializer(data=request.data.get('items', []), many=True)
        serializer.is_valid(raise_exception=True)
        WorkOrderItem.objects.bulk_create([
            WorkOrderItem(work_order=work_order, **item)
            for item in serializer.validated_data
        ])
        return Response({'created': len(serializer.validated_data)}, status=201)


class WorkOrderItemViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'work_order__tenant'
    queryset = WorkOrderItem.objects.all()
    serializer_class = WorkOrderItemSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]

    # The mixin only scopes reads; without this a caller could attach items to (or
    # move items onto) another company's work order just by passing its id.
    def _check_work_order(self, serializer):
        work_order = serializer.validated_data.get('work_order')
        if work_order is not None and work_order.tenant_id != self.request.company.id:
            raise ValidationError({'work_order': 'Work order not found.'})

    def perform_create(self, serializer):
        self._check_work_order(serializer)
        super().perform_create(serializer)

    def perform_update(self, serializer):
        self._check_work_order(serializer)
        super().perform_update(serializer)

    def get_queryset(self):
        qs = super().get_queryset()
        work_order_id = self.request.query_params.get('work_order')
        if work_order_id:
            qs = qs.filter(work_order_id=work_order_id)
        return qs


class StationLogViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'work_order__tenant'
    queryset = StationLog.objects.all()
    serializer_class = StationLogSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]

    def get_queryset(self):
        qs = super().get_queryset()
        work_order_id = self.request.query_params.get('work_order')
        if work_order_id:
            qs = qs.filter(work_order_id=work_order_id)
        return qs


class MaterialConsumptionViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'work_order__tenant'
    queryset = MaterialConsumption.objects.all().order_by('-recorded_at')
    serializer_class = MaterialConsumptionSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]


class StockSheetViewSet(TenantScopedMixin, ModelViewSet):
    queryset = StockSheet.objects.all().order_by('material__sku', 'thickness')
    serializer_class = StockSheetSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]

    def get_queryset(self):
        qs = super().get_queryset()
        material_id = self.request.query_params.get('material')
        if material_id:
            qs = qs.filter(material_id=material_id)
        return qs


class CuttingJobViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'work_order__tenant'
    queryset = CuttingJob.objects.all().order_by('-created_at')
    serializer_class = CuttingJobSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]

    def get_queryset(self):
        qs = super().get_queryset()
        work_order_id = self.request.query_params.get('work_order')
        if work_order_id:
            qs = qs.filter(work_order_id=work_order_id)
        return qs

    @action(detail=True, methods=['post'])
    def optimize(self, request, pk=None):
        job = self.get_object()
        try:
            optimize_job(job.id)
        except ValueError as e:
            return Response({'detail': str(e)}, status=400)
        job.refresh_from_db()
        return Response(self.get_serializer(job).data)

    @action(detail=True, methods=['get'], url_path='export-csv')
    def export_csv_action(self, request, pk=None):
        job = self.get_object()
        csv_text = export_csv(job.id)
        response = HttpResponse(csv_text, content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="cutting_job_{job.id}.csv"'
        return response

    @action(detail=True, methods=['get'], url_path='export-pdf')
    def export_pdf_action(self, request, pk=None):
        job = self.get_object()
        pdf_bytes = export_pdf(job.id)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="cutting_job_{job.id}.pdf"'
        return response
