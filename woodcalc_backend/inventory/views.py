from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.decorators import action
from rest_framework.response import Response
from tenants.mixins import TenantScopedMixin, PublicOrTenantScopedMixin
from tenants.permissions import HasActiveCompany
from .models import Material, Supplier, StockMovement, StockAlert, DrawerSystem, Sink, CabinetTemplate
from .serializers import MaterialSerializer, SupplierSerializer, StockMovementSerializer, StockAlertSerializer, DrawerSystemSerializer, SinkSerializer, CabinetTemplateSerializer


class MaterialViewSet(PublicOrTenantScopedMixin, ModelViewSet):
    # GET is public (no login needed) so customers can browse a manufacturer's
    # material catalog via ?company=<slug>, same as Sink/DrawerSystem below.
    tenant_filter_field = 'tenant'
    queryset = Material.objects.all().order_by('sku')
    serializer_class = MaterialSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        material_type = self.request.query_params.get('material_type')
        if material_type:
            qs = qs.filter(material_type=material_type)
        return qs


class SupplierViewSet(TenantScopedMixin, ModelViewSet):
    queryset = Supplier.objects.all().order_by('name')
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]

    @action(detail=True, methods=['get'])
    def statement(self, request, pk=None):
        """Account statement: every PO for this supplier with totals, plus
        aggregate totals across all of them."""
        from srm.models import PurchaseOrder
        from srm.serializers import PurchaseOrderSerializer

        supplier = self.get_object()
        pos = list(
            PurchaseOrder.objects.filter(supplier=supplier, tenant=request.company)
            .order_by('-order_date')
            .prefetch_related('line_items__material', 'payments')
        )
        po_data = PurchaseOrderSerializer(pos, many=True).data

        total_ordered = total_paid = total_balance = 0
        overdue_count = 0
        for po in pos:
            total_ordered += po.total_amount
            total_paid += po.amount_paid
            total_balance += po.balance_due
            if po.is_payment_overdue:
                overdue_count += 1

        return Response({
            'supplier_id': supplier.id,
            'supplier_name': supplier.name,
            'total_ordered': total_ordered,
            'total_paid': total_paid,
            'total_balance': total_balance,
            'overdue_count': overdue_count,
            'purchase_orders': po_data,
        })


class StockMovementViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'material__tenant'
    queryset = StockMovement.objects.all().order_by('-created_at')
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]


class StockAlertViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'material__tenant'
    queryset = StockAlert.objects.all().order_by('-created_at')
    serializer_class = StockAlertSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]


class DrawerSystemViewSet(PublicOrTenantScopedMixin, ModelViewSet):
    serializer_class = DrawerSystemSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    queryset = DrawerSystem.objects.filter(is_active=True)


class SinkViewSet(PublicOrTenantScopedMixin, ModelViewSet):
    # GET is public (no login needed) so customers can browse a manufacturer's
    # sink catalog via ?company=<slug>. Create/update/delete require an
    # authenticated, active-subscription company (see PublicOrTenantScopedMixin).
    serializer_class = SinkSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    queryset = Sink.objects.filter(is_active=True)


def _membership_role(request):
    """Best-effort lookup of the requesting user's CompanyMembership.role.
    Returns None if there is no membership (treated as no elevated access)."""
    membership = getattr(request.user, 'company_membership', None)
    return membership.role if membership else None


class CabinetTemplateViewSet(TenantScopedMixin, ModelViewSet):
    """AI Designer Agent proposals saved for reuse. A STAFF-role user only ever
    sees company-approved templates plus their own (pending/rejected) submissions;
    OWNER/ADMIN see everything in the tenant, and are the only ones who can
    approve/reject via the two custom actions below."""
    serializer_class = CabinetTemplateSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]
    queryset = CabinetTemplate.objects.all().order_by('-created_at')

    def get_queryset(self):
        qs = super().get_queryset()
        role = _membership_role(self.request)
        if role in ('owner', 'admin'):
            return qs
        return qs.filter(Q(status='approved') | Q(created_by=self.request.user))

    def perform_create(self, serializer):
        company = getattr(self.request, 'company', None)
        serializer.save(tenant=company, created_by=self.request.user, status='pending')

    def _require_admin(self, request):
        return _membership_role(request) in ('owner', 'admin')

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        if not self._require_admin(request):
            return Response({'detail': 'Only owners/admins can approve cabinet templates.'}, status=status.HTTP_403_FORBIDDEN)
        template = self.get_object()
        template.status = 'approved'
        template.reviewed_by = request.user
        template.reviewed_at = timezone.now()
        template.save(update_fields=['status', 'reviewed_by', 'reviewed_at'])
        return Response(CabinetTemplateSerializer(template).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        if not self._require_admin(request):
            return Response({'detail': 'Only owners/admins can reject cabinet templates.'}, status=status.HTTP_403_FORBIDDEN)
        template = self.get_object()
        template.status = 'rejected'
        template.reviewed_by = request.user
        template.reviewed_at = timezone.now()
        template.admin_notes = request.data.get('notes', '') or ''
        template.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'admin_notes'])
        return Response(CabinetTemplateSerializer(template).data)
