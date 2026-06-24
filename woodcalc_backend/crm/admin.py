from django.contrib import admin
from .models import Client, Lead, Quotation, QuotationItem

admin.site.register(Client)
admin.site.register(Lead)
admin.site.register(Quotation)
admin.site.register(QuotationItem)
