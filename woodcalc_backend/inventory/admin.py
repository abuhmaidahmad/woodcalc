from django.contrib import admin
from .models import Material, Supplier, StockMovement, StockAlert, MaterialTexture

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
