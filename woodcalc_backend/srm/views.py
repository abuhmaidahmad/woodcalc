from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from decimal import Decimal, InvalidOperation
from .models import PurchaseOrder, PurchaseOrderLineItem
from .serializers import PurchaseOrderSerializer, PurchaseOrderLineItemSerializer


class PurchaseOrderViewSet(ModelViewSet):
    queryset = PurchaseOrder.objects.all().order_by('-order_date')
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated]


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
