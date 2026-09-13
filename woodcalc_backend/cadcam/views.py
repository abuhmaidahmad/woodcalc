from decimal import Decimal
from collections import OrderedDict

from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status

from tenants.mixins import TenantScopedMixin
from tenants.permissions import HasActiveCompany
from tenants.utils import get_company_settings

from .models import CadCamImportJob, ImportedPart, RemnantOffcut
from .serializers import CadCamImportJobSerializer, ImportedPartSerializer, RemnantOffcutSerializer
from .parsers import PARSERS

DEFAULT_MIN_OFFCUT_WIDTH_MM = 100
DEFAULT_MIN_OFFCUT_HEIGHT_MM = 100
DEFAULT_MIN_OFFCUT_AREA_M2 = 0.1


def _is_usable_offcut(width_mm, height_mm, flags):
    min_w = flags.get('cadcam_min_offcut_width_mm', DEFAULT_MIN_OFFCUT_WIDTH_MM)
    min_h = flags.get('cadcam_min_offcut_height_mm', DEFAULT_MIN_OFFCUT_HEIGHT_MM)
    min_area_m2 = flags.get('cadcam_min_offcut_area_m2', DEFAULT_MIN_OFFCUT_AREA_M2)
    area_m2 = (float(width_mm) * float(height_mm)) / 1_000_000
    return float(width_mm) >= min_w and float(height_mm) >= min_h and area_m2 >= min_area_m2


class CadCamImportJobViewSet(TenantScopedMixin, ModelViewSet):
    queryset = CadCamImportJob.objects.all().order_by('-imported_at')
    serializer_class = CadCamImportJobSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]

    def create(self, request, *args, **kwargs):
        platform = request.data.get('platform')
        method = request.data.get('method')

        if method == 'api':
            return Response(
                {'detail': "API import isn't available yet for any platform — use CSV upload."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        job = CadCamImportJob.objects.create(
            tenant=request.company,
            platform=platform,
            method=method,
            source_file=request.FILES.get('source_file'),
            status='processing',
        )

        parser = PARSERS.get(platform)
        if parser is None:
            job.status = 'failed'
            job.error_message = f'Unknown platform "{platform}".'
            job.save(update_fields=['status', 'error_message'])
            return Response(self.get_serializer(job).data, status=status.HTTP_201_CREATED)

        try:
            parts_data, offcuts_data = parser(job.source_file)
        except Exception as e:
            job.status = 'failed'
            job.error_message = str(e)
            job.save(update_fields=['status', 'error_message'])
            return Response(self.get_serializer(job).data, status=status.HTTP_201_CREATED)

        flags = get_company_settings(request.company)
        ImportedPart.objects.bulk_create([
            ImportedPart(job=job, **part_data) for part_data in parts_data
        ])
        RemnantOffcut.objects.bulk_create([
            RemnantOffcut(
                job=job, tenant=request.company,
                is_usable=_is_usable_offcut(offcut_data['width_mm'], offcut_data['height_mm'], flags),
                **offcut_data,
            ) for offcut_data in offcuts_data
        ])
        job.status = 'done'
        job.save(update_fields=['status'])
        return Response(self.get_serializer(job).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def parts(self, request, pk=None):
        job = self.get_object()
        return Response(ImportedPartSerializer(job.parts.all(), many=True).data)

    @action(detail=True, methods=['get'])
    def offcuts(self, request, pk=None):
        job = self.get_object()
        return Response(RemnantOffcutSerializer(job.offcuts.all(), many=True).data)

    @action(detail=True, methods=['post'], url_path='send-to-optimizer')
    def send_to_optimizer(self, request, pk=None):
        job = self.get_object()
        groups = OrderedDict()
        for part in job.parts.select_related('material').all():
            if part.material is None:
                continue
            key = (part.material_id, part.material.board_thickness)
            if key not in groups:
                # Match StockSheet.thickness's DecimalField(decimal_places=2) serialization
                # (e.g. "18.00"), since the frontend selects a <option> by this exact string.
                thickness_decimal = Decimal(part.material.board_thickness or 18).quantize(Decimal('0.01'))
                groups[key] = {
                    'material': part.material_id,
                    'material_sku': part.material.sku,
                    'thickness': str(thickness_decimal),
                    'parts': [],
                }
            groups[key]['parts'].append({
                'label': part.part_code or 'Imported part',
                'width': str(part.width_mm),
                'height': str(part.height_mm),
                'quantity': 1,
                'grain_locked': bool(part.grain),
            })

        unresolved = job.parts.filter(material__isnull=True).count()
        return Response({
            'groups': list(groups.values()),
            'unresolved_parts': unresolved,
        })


class RemnantOffcutViewSet(TenantScopedMixin, ModelViewSet):
    queryset = RemnantOffcut.objects.all().order_by('-id')
    serializer_class = RemnantOffcutSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]

    def get_queryset(self):
        qs = super().get_queryset()
        job_id = self.request.query_params.get('job')
        if job_id:
            qs = qs.filter(job_id=job_id)
        added_to_stock = self.request.query_params.get('added_to_stock')
        if added_to_stock is not None:
            qs = qs.filter(added_to_stock=added_to_stock.lower() == 'true')
        return qs

    @action(detail=True, methods=['post'], url_path='add-to-stock')
    def add_to_stock(self, request, pk=None):
        offcut = self.get_object()
        offcut.added_to_stock = True
        offcut.save(update_fields=['added_to_stock'])
        return Response(self.get_serializer(offcut).data)
