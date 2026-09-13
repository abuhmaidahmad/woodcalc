from rest_framework import serializers
from .models import CadCamImportJob, ImportedPart, RemnantOffcut


class ImportedPartSerializer(serializers.ModelSerializer):
    material_sku = serializers.CharField(source='material.sku', read_only=True)
    material_name = serializers.CharField(source='material.name', read_only=True)

    class Meta:
        model = ImportedPart
        fields = [
            'id', 'job', 'part_code', 'sheet_ref', 'material', 'material_sku', 'material_name',
            'width_mm', 'height_mm', 'grain',
            'edgeband_top', 'edgeband_bottom', 'edgeband_left', 'edgeband_right', 'edgeband_tape',
            'machining_ops',
        ]
        extra_kwargs = {'job': {'read_only': True}}


class RemnantOffcutSerializer(serializers.ModelSerializer):
    material_sku = serializers.CharField(source='material.sku', read_only=True)
    material_name = serializers.CharField(source='material.name', read_only=True)

    class Meta:
        model = RemnantOffcut
        fields = [
            'id', 'job', 'sheet_ref', 'material', 'material_sku', 'material_name',
            'width_mm', 'height_mm', 'is_usable', 'added_to_stock',
        ]
        extra_kwargs = {'job': {'read_only': True}, 'tenant': {'read_only': True}}


class CadCamImportJobSerializer(serializers.ModelSerializer):
    platform_label = serializers.CharField(source='get_platform_display', read_only=True)
    parts_count = serializers.IntegerField(source='parts.count', read_only=True)
    offcuts_count = serializers.IntegerField(source='offcuts.count', read_only=True)

    class Meta:
        model = CadCamImportJob
        fields = [
            'id', 'platform', 'platform_label', 'method', 'status', 'source_file',
            'error_message', 'imported_at', 'parts_count', 'offcuts_count',
        ]
        extra_kwargs = {
            'tenant': {'read_only': True},
            'status': {'read_only': True},
            'error_message': {'read_only': True},
        }
