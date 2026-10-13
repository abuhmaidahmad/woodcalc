from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from decimal import Decimal, InvalidOperation
from django.db import transaction
from django.utils import timezone
from tenants.mixins import TenantScopedMixin
from tenants.permissions import HasActiveCompany
from .models import PurchaseOrder, PurchaseOrderLineItem, SupplierPayment
from .email_service import send_purchase_order_email, EmailAccountNotConnected
from .serializers import PurchaseOrderSerializer, PurchaseOrderLineItemSerializer, SupplierPaymentSerializer


def _price_per_m2(mat):
    """A material's catalog price per m² (price_per_board is quoted per board,
    per m² or per running meter -- see Material.price_unit), else its unit cost."""
    price = mat.price_per_board
    if price:
        if mat.price_unit == 'm2':
            return price
        if mat.price_unit == 'board' and mat.board_width and mat.board_height:
            return (price / (Decimal(mat.board_width * mat.board_height) / Decimal(1_000_000))).quantize(Decimal('0.01'))
    return mat.unit_cost or Decimal(0)


def _price_per_piece(mat, w, h):
    if mat.price_per_board and mat.price_unit == 'm2':
        return (mat.price_per_board * w * h / Decimal(1_000_000)).quantize(Decimal('0.01'))
    return mat.unit_cost or mat.price_per_board or Decimal(0)


class PurchaseOrderViewSet(TenantScopedMixin, ModelViewSet):
    queryset = PurchaseOrder.objects.all().order_by('-order_date').prefetch_related('line_items__material', 'payments')
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]

    @action(detail=False, methods=['post'], url_path='from-cut-list')
    def from_cut_list(self, request):
        """Drafts purchase orders for made-to-size items (glass shelves, aluminium
        glass doors) from a room's cut list: one draft PO per supplier, one line
        per size. Body: {"source_ref": "room:22:glass", "notes": "...", "force": false,
        "items": [{"material_sku", "description", "width", "height", "quantity"}]}
        -- width/height in mm, quantity in pieces. A line is ordered in the
        material's own unit (m² or pieces) at its catalog price. Refuses (409) if
        source_ref already has an open PO, unless force."""
        from inventory.models import Material

        items = request.data.get('items') or []
        source_ref = (request.data.get('source_ref') or '')[:100]
        if not items:
            return Response({'error': 'No items to order.'}, status=400)
        if source_ref and not request.data.get('force'):
            existing = PurchaseOrder.objects.filter(tenant=request.company, source_ref=source_ref) \
                .exclude(status='cancelled')
            if existing.exists():
                return Response({
                    'error': 'already_ordered',
                    'purchase_orders': [{'id': po.id, 'po_number': po.po_number, 'status': po.status} for po in existing],
                }, status=409)

        lines_by_supplier = {}
        for item in items:
            sku = item.get('material_sku')
            mat = Material.objects.filter(tenant=request.company, sku=sku).select_related('supplier').first() if sku else None
            if mat is None:
                return Response({'error': f'Material {sku or "(none)"} not found -- pick a stock material for it in Settings.'}, status=400)
            if mat.supplier is None:
                return Response({'error': f'{mat.sku} has no supplier -- set one in the Materials Catalog.'}, status=400)
            try:
                w, h, qty = Decimal(str(item['width'])), Decimal(str(item['height'])), int(item['quantity'])
            except (KeyError, InvalidOperation, ValueError, TypeError):
                return Response({'error': f'Invalid size or quantity for {mat.sku}.'}, status=400)
            if w <= 0 or h <= 0 or qty <= 0:
                return Response({'error': f'Invalid size or quantity for {mat.sku}.'}, status=400)
            m2 = (w * h / Decimal(1_000_000) * qty).quantize(Decimal('0.01'))
            quantity, unit_price = (m2, _price_per_m2(mat)) if mat.unit != 'PCS' else (Decimal(qty), _price_per_piece(mat, w, h))
            desc = (item.get('description') or '').strip()
            notes = f'{desc} {w.normalize():f} x {h.normalize():f} mm x {qty} pcs ({m2} m²)'.strip()
            lines_by_supplier.setdefault(mat.supplier, []).append((mat, quantity, unit_price, notes[:300]))

        created = []
        with transaction.atomic():
            for supplier, lines in lines_by_supplier.items():
                po = PurchaseOrder.objects.create(
                    tenant=request.company, supplier=supplier, source_ref=source_ref,
                    notes=request.data.get('notes', ''),
                )
                for mat, quantity, unit_price, notes in lines:
                    PurchaseOrderLineItem.objects.create(
                        purchase_order=po, material=mat, quantity_ordered=quantity,
                        unit_price=unit_price, notes=notes, made_to_order=True,
                    )
                created.append(po)
        return Response(PurchaseOrderSerializer(created, many=True).data, status=201)

    @action(detail=True, methods=['post'])
    def send_email(self, request, pk=None):
        """Send this PO to its supplier's email using the requesting user's connected
        email account. Body is not required."""
        po = self.get_object()
        try:
            send_purchase_order_email(po, request.user)
        except EmailAccountNotConnected as e:
            return Response({'error': str(e)}, status=400)
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            return Response({'error': f'Failed to send email: {e}'}, status=500)

        if po.status == 'draft':
            po.status = 'sent'
            po.save(update_fields=['status'])
        return Response({'message': f'Purchase order {po.po_number} sent to {po.supplier.email}'})

    @action(detail=True, methods=['post'])
    def record_payment(self, request, pk=None):
        """Record a payment against this PO. Body: {"amount": <number>, "method": "cash"|"bank_transfer"|"cheque",
        "payment_date": "YYYY-MM-DD" (optional), "reference": "" (optional), "notes": "" (optional)}."""
        po = self.get_object()
        try:
            amount = Decimal(str(request.data.get('amount', 0)))
        except InvalidOperation:
            return Response({'error': 'Invalid amount'}, status=400)
        if amount <= 0:
            return Response({'error': 'Amount must be positive'}, status=400)
        if amount > po.balance_due:
            return Response({'error': f'Amount exceeds balance due ({po.balance_due})'}, status=400)

        method = request.data.get('method')
        if method not in dict(SupplierPayment.METHOD_CHOICES):
            return Response({'error': 'Invalid or missing payment method'}, status=400)

        payment = SupplierPayment.objects.create(
            purchase_order=po,
            amount=amount,
            method=method,
            payment_date=request.data.get('payment_date') or timezone.localdate(),
            reference=request.data.get('reference', ''),
            notes=request.data.get('notes', ''),
        )
        return Response(SupplierPaymentSerializer(payment).data, status=201)


class PurchaseOrderLineItemViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'purchase_order__tenant'
    queryset = PurchaseOrderLineItem.objects.all()
    serializer_class = PurchaseOrderLineItemSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        """Receive a quantity against this line item. Body: {"quantity": <number>}.
        Updates Material.quantity_on_hand, logs a StockMovement, and updates PO status."""
        line_item = self.get_object()
        try:
            quantity = Decimal(str(request.data.get('quantity', 0)))
            line_item.receive(quantity)
        except (ValueError, InvalidOperation) as e:
            return Response({'error': str(e)}, status=400)
        return Response(PurchaseOrderLineItemSerializer(line_item).data)
