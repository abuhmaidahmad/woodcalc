from django.contrib import admin
from .models import Material, Supplier, StockMovement, StockAlert

admin.site.register(Material)
admin.site.register(Supplier)
admin.site.register(StockMovement)
admin.site.register(StockAlert)
