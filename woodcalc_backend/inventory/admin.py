from django.contrib import admin
from .models import Material, Supplier, StockMovement, StockAlert, Sink

admin.site.register(Material)
admin.site.register(Supplier)
admin.site.register(StockMovement)
admin.site.register(StockAlert)



@admin.register(Sink)
class SinkAdmin(admin.ModelAdmin):
    list_display = ('brand', 'model_name', 'material', 'color', 'cavity_count',
                     'mount_type', 'width_mm', 'depth_mm', 'price', 'is_active', 'sort_order')
    list_filter = ('material', 'cavity_count', 'mount_type', 'shape', 'is_active')
    search_fields = ('brand', 'model_name', 'color')
    list_editable = ('is_active', 'sort_order')
    fieldsets = (
        (None, {
            'fields': ('brand', 'model_name', 'image', 'price', 'is_active', 'sort_order'),
        }),
        ('Appearance', {
            'fields': ('material', 'color', 'color_hex', 'roughness', 'metalness'),
        }),
        ('Configuration', {
            'fields': ('cavity_count', 'mount_type', 'shape'),
        }),
        ('Dimensions', {
            'description': 'Cutout dimensions are optional — if left blank, the fabricator '
                            'spec falls back to the overall sink width/depth.',
            'fields': ('width_mm', 'depth_mm', 'bowl_depth_mm', 'cutout_width_mm', 'cutout_depth_mm'),
        }),
    )
