from rest_framework import serializers
from .models import PurchaseOrder, PurchaseOrderLineItem


class PurchaseOrderLineItemSerializer(serializers.ModelSerializer):
    material_sku = serializers.CharField(source='material.sku', read_only=True)
    material_name = serializers.CharField(source='material.name', read_only=True)
    is_fully_received = serializers.BooleanField(read_only=True)

    class Meta:
        model = PurchaseOrderLineItem
        fields = '__all__'
        read_only_fields = ['quantity_received']


class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    line_items = PurchaseOrderLineItemSerializer(many=True, read_only=True)
    is_late = serializers.BooleanField(read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = '__all__'
        read_only_fields = ['po_number']
