from rest_framework import serializers
from .models import ProductionStation, WorkOrder, WorkOrderItem, StationLog, MaterialConsumption
from .models import StockSheet, CuttingJob, CuttingPart, CuttingLayout, PartPlacement


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


class StockSheetSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockSheet
        fields = '__all__'


class CuttingPartSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuttingPart
        fields = ['id', 'label', 'width', 'height', 'quantity', 'grain_locked']


class PartPlacementSerializer(serializers.ModelSerializer):
    part = CuttingPartSerializer(read_only=True)

    class Meta:
        model = PartPlacement
        fields = ['id', 'part', 'x', 'y', 'width', 'height', 'rotated']


class CuttingLayoutSerializer(serializers.ModelSerializer):
    placements = PartPlacementSerializer(many=True, read_only=True)

    class Meta:
        model = CuttingLayout
        fields = ['id', 'sheet', 'sheet_index', 'waste_percent', 'placements']


class CuttingJobSerializer(serializers.ModelSerializer):
    parts = CuttingPartSerializer(many=True)
    layouts = CuttingLayoutSerializer(many=True, read_only=True)

    class Meta:
        model = CuttingJob
        fields = [
            'id', 'work_order', 'material', 'thickness', 'kerf',
            'trim_top', 'trim_left', 'status', 'created_at', 'parts', 'layouts',
        ]
        read_only_fields = ['status', 'created_at']

    def create(self, validated_data):
        parts_data = validated_data.pop('parts', [])
        job = CuttingJob.objects.create(**validated_data)
        for part_data in parts_data:
            CuttingPart.objects.create(job=job, **part_data)
        return job
