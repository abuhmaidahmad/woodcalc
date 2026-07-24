from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from .models import ProductionStation, WorkOrder, WorkOrderItem, StationLog, MaterialConsumption
from .models import StockSheet, CuttingJob
from .serializers import (
    ProductionStationSerializer, WorkOrderSerializer, WorkOrderItemSerializer,
    StationLogSerializer, MaterialConsumptionSerializer,
)
from .serializers import StockSheetSerializer, CuttingJobSerializer
from .cutting_service import optimize_job
from .cutting_export import export_csv, export_pdf
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse


class ProductionStationViewSet(ModelViewSet):
    queryset = ProductionStation.objects.all().order_by('name')
    serializer_class = ProductionStationSerializer
    permission_classes = [IsAuthenticated]


class WorkOrderViewSet(ModelViewSet):
    queryset = WorkOrder.objects.all().order_by('-created_at')
    serializer_class = WorkOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = WorkOrder.objects.all().order_by('-created_at')
        room_id = self.request.query_params.get('room_id_ref')
        if room_id:
            qs = qs.filter(room_id_ref=room_id)
        return qs


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


class StockSheetViewSet(ModelViewSet):
    queryset = StockSheet.objects.all().order_by('material__sku', 'thickness')
    serializer_class = StockSheetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = StockSheet.objects.all().order_by('material__sku', 'thickness')
        material_id = self.request.query_params.get('material')
        if material_id:
            qs = qs.filter(material_id=material_id)
        return qs


class CuttingJobViewSet(ModelViewSet):
    queryset = CuttingJob.objects.all().order_by('-created_at')
    serializer_class = CuttingJobSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = CuttingJob.objects.all().order_by('-created_at')
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
