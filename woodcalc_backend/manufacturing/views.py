from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from tenants.mixins import TenantScopedMixin
from tenants.permissions import HasActiveCompany
from crm.locking import RoomNotLocked, ensure_room_unlocked, room_for_ref
from crm.models import Room
from crm.revisions import revision_chain
from .models import ProductionStation, WorkOrder, WorkOrderItem, StationLog, MaterialConsumption
from .models import StockSheet, CuttingJob
from .serializers import (
    ProductionStationSerializer, WorkOrderSerializer, WorkOrderItemSerializer, WorkOrderItemBulkSerializer,
    StationLogSerializer, MaterialConsumptionSerializer,
)
from .serializers import StockSheetSerializer, CuttingJobSerializer
from .cutting_service import optimize_job, release_job_stock, job_stock_reference, booked_by_job
from .cutting_export import export_csv, export_pdf, export_xlsx
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
        chain_ref = self.request.query_params.get('room_chain')
        if chain_ref:
            chain_room = room_for_ref(chain_ref, self.request.company)
            if chain_room is None:
                return qs.none()
            qs = qs.filter(room_id_ref__in=[r.id for r in revision_chain(chain_room)])
        return qs

    def perform_create(self, serializer):
        room = room_for_ref(serializer.validated_data.get('room_id_ref'), self.request.company)
        if room is None or not room.is_locked or room.revision_status != Room.RevisionStatus.APPROVED:
            raise ValidationError({'room_id_ref': 'Only a confirmed (locked) room can be sent to manufacturing.'})
        if room.is_variant and self.request.membership.role != 'owner':
            raise ValidationError({'room_id_ref': 'Only the owner can send a design variant to manufacturing.'})
        serializer.save(tenant=self.request.company)

    @action(detail=True, methods=['post'], url_path='items')
    def add_items(self, request, pk=None):
        """Create a work order's whole cut list in one request. The planner used to
        POST one work-order-item per distinct part (100+ sequential round trips on a
        full kitchen); get_object() scopes the order to the caller's tenant."""
        work_order = self.get_object()
        if work_order.items.exists():
            ensure_room_unlocked(room_for_ref(work_order.room_id_ref, request.company))
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
    permission_classes = [IsAuthenticated, HasActiveCompany, RoomNotLocked]

    def get_lock_room(self, obj):
        return room_for_ref(obj.work_order.room_id_ref, self.request.company)

    # The mixin only scopes reads; without this a caller could attach items to (or
    # move items onto) another company's work order just by passing its id.
    def _check_work_order(self, serializer):
        work_order = serializer.validated_data.get('work_order')
        if work_order is not None and work_order.tenant_id != self.request.company.id:
            raise ValidationError({'work_order': 'Work order not found.'})

    def perform_create(self, serializer):
        self._check_work_order(serializer)
        work_order = serializer.validated_data.get('work_order')
        ensure_room_unlocked(room_for_ref(work_order.room_id_ref, self.request.company))
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

    # As with work-order items: the mixin only scopes reads, so check the job's
    # work order and material belong to the caller's company before saving.
    def _check_tenant(self, serializer):
        work_order = serializer.validated_data.get('work_order')
        if work_order is not None and work_order.tenant_id != self.request.company.id:
            raise ValidationError({'work_order': 'Work order not found.'})
        material = serializer.validated_data.get('material')
        if material is not None and material.tenant_id != self.request.company.id:
            raise ValidationError({'material': 'Material not found.'})

    def perform_create(self, serializer):
        self._check_tenant(serializer)
        super().perform_create(serializer)

    def perform_update(self, serializer):
        self._check_tenant(serializer)
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        release_job_stock(instance)
        super().perform_destroy(instance)

    @action(detail=True, methods=['post'])
    def optimize(self, request, pk=None):
        job = self.get_object()
        try:
            optimize_job(job.id)
        except ValueError as e:
            return Response({'detail': str(e)}, status=400)
        job.refresh_from_db()
        data = self.get_serializer(job).data
        # What this job has taken out of stock so far, so the optimizer can show it.
        mat = job.material
        mat.refresh_from_db()
        data['stock'] = {
            'material_sku': mat.sku,
            'unit': mat.unit,
            'used_by_job': str(booked_by_job(job_stock_reference(job)).get(mat.id, 0)),
            'quantity_on_hand': str(mat.quantity_on_hand),
            'reorder_level': str(mat.reorder_level),
            'below_reorder_level': mat.quantity_on_hand < mat.reorder_level,
        }
        return Response(data)

    @action(detail=True, methods=['get'], url_path='export-csv')
    def export_csv_action(self, request, pk=None):
        job = self.get_object()
        csv_text = export_csv(job.id)
        response = HttpResponse(csv_text, content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="cutting_job_{job.id}.csv"'
        return response

    # One workbook for several jobs, e.g. every material of a work order:
    # ?ids=1,2,3 (in that order).
    @action(detail=False, methods=['get'], url_path='export-xlsx')
    def export_xlsx_action(self, request):
        try:
            ids = [int(i) for i in request.query_params.get('ids', '').split(',') if i.strip()]
        except ValueError:
            return Response({'detail': 'ids must be a comma-separated list of job ids.'}, status=400)
        jobs = {j.id: j for j in self.get_queryset().filter(id__in=ids).select_related('material', 'work_order')
                .prefetch_related('layouts__sheet', 'layouts__placements__part')}
        if not jobs:
            return Response({'detail': 'No cutting jobs found.'}, status=404)
        ordered = [jobs[i] for i in ids if i in jobs]
        order_number = ordered[0].work_order.order_number
        response = HttpResponse(export_xlsx(ordered),
                                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename="cutting_list_{order_number}.xlsx"'
        return response

    @action(detail=True, methods=['get'], url_path='export-pdf')
    def export_pdf_action(self, request, pk=None):
        job = self.get_object()
        pdf_bytes = export_pdf(job.id)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="cutting_job_{job.id}.pdf"'
        return response
