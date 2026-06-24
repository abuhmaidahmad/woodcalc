from django.contrib import admin
from .models import ProductionStation, WorkOrder, WorkOrderItem, StationLog, MaterialConsumption

admin.site.register(ProductionStation)
admin.site.register(WorkOrder)
admin.site.register(WorkOrderItem)
admin.site.register(StationLog)
admin.site.register(MaterialConsumption)
