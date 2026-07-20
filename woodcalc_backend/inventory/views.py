from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Material, Supplier, StockMovement, StockAlert, MaterialTexture, DrawerSystem, Sink
from .serializers import MaterialSerializer, SupplierSerializer, StockMovementSerializer, StockAlertSerializer, MaterialTextureSerializer, DrawerSystemSerializer, SinkSerializer


class MaterialViewSet(ModelViewSet):
    queryset = Material.objects.all().order_by('sku')
    serializer_class = MaterialSerializer
    permission_classes = [IsAuthenticated]


class SupplierViewSet(ModelViewSet):
    queryset = Supplier.objects.all().order_by('name')
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['get'])
    def statement(self, request, pk=None):
        """Account statement: every PO for this supplier with totals, plus
        aggregate totals across all of them."""
        from srm.models import PurchaseOrder
        from srm.serializers import PurchaseOrderSerializer

        supplier = self.get_object()
        pos = list(
            PurchaseOrder.objects.filter(supplier=supplier)
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


class StockMovementViewSet(ModelViewSet):
    queryset = StockMovement.objects.all().order_by('-created_at')
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]


class StockAlertViewSet(ModelViewSet):
    queryset = StockAlert.objects.all().order_by('-created_at')
    serializer_class = StockAlertSerializer
    permission_classes = [IsAuthenticated]


class MaterialTextureViewSet(ModelViewSet):
    # Read access (GET) is public so the Kitchen Planner can load material swatches
    # without requiring a logged-in session. Create/update/delete still require auth.
    serializer_class = MaterialTextureSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = MaterialTexture.objects.all().order_by('material_type', 'name')
        material_type = self.request.query_params.get('material_type')
        if material_type:
            qs = qs.filter(material_type=material_type)
        return qs


from rest_framework.permissions import IsAuthenticatedOrReadOnly

class DrawerSystemViewSet(ModelViewSet):
    serializer_class = DrawerSystemSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return DrawerSystem.objects.filter(is_active=True)


class SinkViewSet(ModelViewSet):
    # Read access (GET) is public so the Kitchen Planner can load the sink catalog
    # without requiring a logged-in session. Create/update/delete still require auth.
    serializer_class = SinkSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return Sink.objects.filter(is_active=True)
