from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from decimal import Decimal, InvalidOperation
from django.utils import timezone
from .models import PurchaseOrder, PurchaseOrderLineItem, SupplierPayment
from .email_service import send_purchase_order_email, EmailAccountNotConnected
from .serializers import PurchaseOrderSerializer, PurchaseOrderLineItemSerializer, SupplierPaymentSerializer


class PurchaseOrderViewSet(ModelViewSet):
    queryset = PurchaseOrder.objects.all().order_by('-order_date').prefetch_related('line_items__material', 'payments')
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated]

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


class PurchaseOrderLineItemViewSet(ModelViewSet):
    queryset = PurchaseOrderLineItem.objects.all()
    serializer_class = PurchaseOrderLineItemSerializer
    permission_classes = [IsAuthenticated]

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
