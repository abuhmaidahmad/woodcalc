from django.contrib import admin
from .models import PurchaseOrder, PurchaseOrderLine, GoodsReceipt, GoodsReceiptLine

admin.site.register(PurchaseOrder)
admin.site.register(PurchaseOrderLine)
admin.site.register(GoodsReceipt)
admin.site.register(GoodsReceiptLine)
