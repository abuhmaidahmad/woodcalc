from rest_framework import serializers
from .models import PurchaseOrder, PurchaseOrderLineItem, SupplierPayment


class PurchaseOrderLineItemSerializer(serializers.ModelSerializer):
    material_sku = serializers.CharField(source='material.sku', read_only=True)
    material_name = serializers.CharField(source='material.name', read_only=True)
    is_fully_received = serializers.BooleanField(read_only=True)

    class Meta:
        model = PurchaseOrderLineItem
        fields = '__all__'
        read_only_fields = ['quantity_received']


class SupplierPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierPayment
        fields = '__all__'
        read_only_fields = ['purchase_order']


class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    line_items = PurchaseOrderLineItemSerializer(many=True, read_only=True)
    payments = SupplierPaymentSerializer(many=True, read_only=True)
    is_late = serializers.BooleanField(read_only=True)
    total_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    amount_paid = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    balance_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    payment_due_date = serializers.DateField(read_only=True)
    is_payment_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = '__all__'
        read_only_fields = ['po_number']
