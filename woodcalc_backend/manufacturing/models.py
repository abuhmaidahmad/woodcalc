from django.db import models, transaction
from inventory.models import Material
from tenants.models import Company


class ProductionStation(models.Model):
    tenant = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='production_stations')
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    description = models.CharField(max_length=300, blank=True)
    active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class WorkOrder(models.Model):
    STATUS_CHOICES = [
        ('NEW', 'New'), ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'), ('CANCELLED', 'Cancelled'),
    ]
    tenant = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='work_orders')
    # WO1, WO2, ... per company, given when the work order is created (it starts
    # every piece ID: WO125-R2-03-SL). sequence is the number on its own.
    order_number = models.CharField(max_length=50)
    sequence = models.PositiveIntegerField(null=True, blank=True)
    product_name = models.CharField(max_length=200)
    customer_name = models.CharField(max_length=200, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='NEW')
    due_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    room_id_ref = models.PositiveIntegerField(null=True, blank=True, help_text='CRM Room ID this work order was generated from')
    is_back_order = models.BooleanField(default=False)
    revision_changed_after_start = models.BooleanField(default=False)
    status_reason = models.TextField(blank=True)
    sent_cabinet_ids = models.JSONField(default=list, blank=True, help_text='List of cabinet ids from the room already included in this or prior work orders')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['tenant', 'order_number'], name='unique_order_number_per_company'),
            models.UniqueConstraint(fields=['tenant', 'sequence'], name='unique_order_sequence_per_company'),
        ]

    def save(self, *args, **kwargs):
        # A new work order takes its company's next number. The company row is
        # locked meanwhile so two orders created at once can't take the same one.
        if self.sequence is None and self.tenant_id:
            with transaction.atomic():
                Company.objects.select_for_update().filter(pk=self.tenant_id).first()
                last = (WorkOrder.objects.filter(tenant_id=self.tenant_id)
                        .aggregate(m=models.Max('sequence'))['m'] or 0)
                self.sequence = last + 1
                if not self.order_number:
                    self.order_number = f'WO{self.sequence}'
                super().save(*args, **kwargs)
            return
        super().save(*args, **kwargs)

    def __str__(self):
        return self.order_number


class WorkOrderItem(models.Model):
    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name='items')
    description = models.CharField(max_length=300)
    quantity = models.PositiveIntegerField(default=1)
    unit = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return f'{self.work_order.order_number} - {self.description}'


class StationLog(models.Model):
    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name='station_logs')
    station = models.ForeignKey(ProductionStation, on_delete=models.CASCADE, related_name='logs')
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f'{self.work_order.order_number} @ {self.station.name}'


class MaterialConsumption(models.Model):
    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name='consumptions')
    material = models.ForeignKey(Material, on_delete=models.CASCADE, related_name='consumptions')
    quantity_used = models.DecimalField(max_digits=12, decimal_places=2)
    recorded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.work_order.order_number} used {self.quantity_used} of {self.material.sku}'


class StockSheet(models.Model):
    tenant = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='stock_sheets_tenant')
    material = models.ForeignKey(Material, on_delete=models.PROTECT, related_name='stock_sheets')
    thickness = models.DecimalField(max_digits=6, decimal_places=2)
    width = models.DecimalField(max_digits=8, decimal_places=2, help_text='mm')
    height = models.DecimalField(max_digits=8, decimal_places=2, help_text='mm')
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    grain_direction = models.CharField(
        max_length=10,
        choices=[('length', 'Length'), ('width', 'Width'), ('none', 'None')],
        default='length',
    )

    def __str__(self):
        return f'{self.material.sku} {self.width}x{self.height}x{self.thickness}'


class CuttingJob(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'), ('OPTIMIZED', 'Optimized'), ('EXPORTED', 'Exported'),
    ]
    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name='cutting_jobs')
    material = models.ForeignKey(Material, on_delete=models.PROTECT, related_name='cutting_jobs')
    thickness = models.DecimalField(max_digits=6, decimal_places=2)
    kerf = models.DecimalField(max_digits=4, decimal_places=2, default=4.0, help_text='blade width mm')
    trim_top = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    trim_left = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'CuttingJob {self.id} - {self.work_order.order_number}'


class CuttingPart(models.Model):
    job = models.ForeignKey(CuttingJob, on_delete=models.CASCADE, related_name='parts')
    label = models.CharField(max_length=200, blank=True)
    width = models.DecimalField(max_digits=8, decimal_places=2)
    height = models.DecimalField(max_digits=8, decimal_places=2)
    quantity = models.PositiveIntegerField(default=1)
    grain_locked = models.BooleanField(default=True)
    # A part loaded from a work order's room is one physical piece (quantity 1)
    # with its own ID, <WO>-R<room #>-<badge>-<code> (machining/pieces.js), so
    # the layout, labels and CNC files can all say which piece goes where.
    # Parts typed in by hand have none.
    piece_id = models.CharField(max_length=80, blank=True, db_index=True)
    cabinet = models.CharField(max_length=200, blank=True)
    edge_banding = models.JSONField(default=dict, blank=True)  # {T, B, L, R}: band material or 'None'

    def __str__(self):
        return f'{self.piece_id or self.label or "part"} {self.width}x{self.height} x{self.quantity}'


class CuttingLayout(models.Model):
    job = models.ForeignKey(CuttingJob, on_delete=models.CASCADE, related_name='layouts')
    sheet = models.ForeignKey(StockSheet, on_delete=models.PROTECT, related_name='layouts')
    sheet_index = models.PositiveIntegerField()
    waste_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    def __str__(self):
        return f'{self.job} sheet #{self.sheet_index}'


class PartPlacement(models.Model):
    layout = models.ForeignKey(CuttingLayout, on_delete=models.CASCADE, related_name='placements')
    part = models.ForeignKey(CuttingPart, on_delete=models.CASCADE, related_name='placements')
    x = models.DecimalField(max_digits=8, decimal_places=2)
    y = models.DecimalField(max_digits=8, decimal_places=2)
    width = models.DecimalField(max_digits=8, decimal_places=2)
    height = models.DecimalField(max_digits=8, decimal_places=2)
    rotated = models.BooleanField(default=False)

    def __str__(self):
        return f'{self.part.label} @ ({self.x},{self.y})'

