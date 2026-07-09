from django.contrib import admin
from .models import Material, Supplier, StockMovement, StockAlert, MaterialTexture, Sink

admin.site.register(Material)
admin.site.register(Supplier)
admin.site.register(StockMovement)
admin.site.register(StockAlert)


@admin.register(MaterialTexture)
class MaterialTextureAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'material_type', 'finish', 'supplier',
                    'texture_physical_width_mm', 'texture_physical_height_mm', 'created_at')
    list_filter = ('material_type', 'finish', 'supplier')
    search_fields = ('name', 'code')
    fieldsets = (
        (None, {
            'fields': ('name', 'code', 'material_type', 'finish', 'supplier', 'texture_image', 'fallback_hex'),
        }),
        ('3D Render — Physical Texture Scale', {
            'description': (
                'Set the real-world dimensions the uploaded texture image represents. '
                'The 3D view divides the panel size by these values to calculate how many '
                'times the texture tiles across the surface. '
                'Use 600×600 for a square tile sample; 2440×1220 for a full-board photo.'
            ),
            'fields': ('texture_physical_width_mm', 'texture_physical_height_mm'),
        }),
        ('Board / Stock Info', {
            'fields': ('board_width', 'board_height', 'thickness', 'price_per_board',
                       'roughness', 'metalness'),
        }),
    )


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
