from django.contrib import admin
from .models import CadCamImportJob, ImportedPart, RemnantOffcut

admin.site.register(CadCamImportJob)
admin.site.register(ImportedPart)
admin.site.register(RemnantOffcut)
