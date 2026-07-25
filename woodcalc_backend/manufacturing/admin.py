from django.contrib import admin
from .models import ProductionStation, WorkOrder, WorkOrderItem, StationLog, MaterialConsumption
from .models import StockSheet, CuttingJob, CuttingPart, CuttingLayout, PartPlacement

admin.site.register(ProductionStation)
admin.site.register(WorkOrder)
admin.site.register(WorkOrderItem)
admin.site.register(StationLog)
admin.site.register(MaterialConsumption)
admin.site.register(StockSheet)
admin.site.register(CuttingJob)
admin.site.register(CuttingPart)
admin.site.register(CuttingLayout)
admin.site.register(PartPlacement)
