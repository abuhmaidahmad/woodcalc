from rest_framework import serializers
from .models import Material, Supplier, StockMovement, StockAlert, DrawerSystem, Sink


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
