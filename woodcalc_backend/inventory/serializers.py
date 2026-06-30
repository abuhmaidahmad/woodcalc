from rest_framework import serializers
from .models import Material, Supplier, StockMovement, StockAlert, MaterialTexture


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'


class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        fields = '__all__'


class StockMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockMovement
        fields = '__all__'


class StockAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockAlert
        fields = '__all__'


class MaterialTextureSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = MaterialTexture
        fields = '__all__'
