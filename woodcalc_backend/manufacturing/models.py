from django.db import models
from inventory.models import Material


class ProductionStation(models.Model):
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
    order_number = models.CharField(max_length=50, unique=True)
    product_name = models.CharField(max_length=200)
    customer_name = models.CharField(max_length=200, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='NEW')
    due_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

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
