from django.contrib import admin
from .models import Material, Supplier, StockMovement, StockAlert, MaterialTexture

admin.site.register(Material)
admin.site.register(Supplier)
admin.site.register(StockMovement)
admin.site.register(StockAlert)
admin.site.register(MaterialTexture)
