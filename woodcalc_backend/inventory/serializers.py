from rest_framework import serializers
from .models import Material, Supplier, StockMovement, StockAlert, DrawerSystem, Sink, CabinetTemplate


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'
        extra_kwargs = {'tenant': {'read_only': True}}


class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        fields = '__all__'
        extra_kwargs = {'tenant': {'read_only': True}}


class StockMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockMovement
        fields = '__all__'


class StockAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockAlert
        fields = '__all__'



class DrawerSystemSerializer(serializers.ModelSerializer):
    class Meta:
        model = DrawerSystem
        fields = '__all__'
        extra_kwargs = {'tenant': {'read_only': True}}


class SinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sink
        fields = '__all__'
        extra_kwargs = {'tenant': {'read_only': True}}


class CabinetTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CabinetTemplate
        fields = '__all__'
        extra_kwargs = {
            'tenant': {'read_only': True},
            'created_by': {'read_only': True},
            'status': {'read_only': True},
            'reviewed_by': {'read_only': True},
            'reviewed_at': {'read_only': True},
        }
