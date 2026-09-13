from django.db import models
from inventory.models import Material
from tenants.models import Company


class CadCamImportJob(models.Model):
    PLATFORM_CHOICES = [
        ('bsolid', 'bSolid'),
        ('cabinetvision', 'Cabinet Vision'),
        ('alphacam', 'Alphacam'),
        ('microvellum', 'Microvellum'),
        ('woodwop', 'WoodWOP'),
    ]
    METHOD_CHOICES = [('api', 'API'), ('csv', 'CSV')]
    STATUS_CHOICES = [
        ('pending', 'Pending'), ('processing', 'Processing'),
        ('done', 'Done'), ('failed', 'Failed'),
    ]

    tenant = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='cadcam_import_jobs')
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    method = models.CharField(max_length=10, choices=METHOD_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    source_file = models.FileField(upload_to='cadcam_imports/', blank=True, null=True)
    error_message = models.CharField(max_length=500, blank=True)
    imported_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.get_platform_display()} import #{self.id} ({self.status})'


class ImportedPart(models.Model):
    GRAIN_CHOICES = [('H', 'Horizontal'), ('V', 'Vertical')]

    job = models.ForeignKey(CadCamImportJob, on_delete=models.CASCADE, related_name='parts')
    part_code = models.CharField(max_length=100, blank=True)
    sheet_ref = models.CharField(max_length=100, blank=True)
    material = models.ForeignKey(Material, on_delete=models.PROTECT, related_name='cadcam_parts', null=True, blank=True)
    width_mm = models.DecimalField(max_digits=8, decimal_places=2)
    height_mm = models.DecimalField(max_digits=8, decimal_places=2)
    grain = models.CharField(max_length=1, choices=GRAIN_CHOICES, blank=True)
    edgeband_top = models.BooleanField(default=False)
    edgeband_bottom = models.BooleanField(default=False)
    edgeband_left = models.BooleanField(default=False)
    edgeband_right = models.BooleanField(default=False)
    edgeband_tape = models.CharField(max_length=100, blank=True)
    machining_ops = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f'{self.part_code or "part"} {self.width_mm}x{self.height_mm}'


class RemnantOffcut(models.Model):
    job = models.ForeignKey(CadCamImportJob, on_delete=models.CASCADE, related_name='offcuts')
    tenant = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='cadcam_offcuts')
    sheet_ref = models.CharField(max_length=100, blank=True)
    material = models.ForeignKey(Material, on_delete=models.PROTECT, related_name='cadcam_offcuts', null=True, blank=True)
    width_mm = models.DecimalField(max_digits=8, decimal_places=2)
    height_mm = models.DecimalField(max_digits=8, decimal_places=2)
    is_usable = models.BooleanField(default=False)
    added_to_stock = models.BooleanField(default=False)

    def __str__(self):
        return f'Offcut {self.width_mm}x{self.height_mm} ({"usable" if self.is_usable else "scrap"})'
