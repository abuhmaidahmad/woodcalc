from rest_framework import serializers
from .models import ProductionStation, WorkOrder, WorkOrderItem, StationLog, MaterialConsumption


class ProductionStationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionStation
        fields = '__all__'


class WorkOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkOrderItem
        fields = '__all__'


class WorkOrderSerializer(serializers.ModelSerializer):
    items = WorkOrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = WorkOrder
        fields = '__all__'


class StationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = StationLog
        fields = '__all__'


class MaterialConsumptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialConsumption
        fields = '__all__'
