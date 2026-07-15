from django.db import models
from django.utils import timezone
from inventory.models import Supplier, Material, StockMovement


class PurchaseOrder(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('confirmed', 'Confirmed'),
        ('partially_received', 'Partially Received'),
        ('received', 'Received'),
        ('closed', 'Closed'),
        ('cancelled', 'Cancelled'),
    ]
    po_number = models.CharField(max_length=30, unique=True, blank=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='purchase_orders')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    order_date = models.DateField(default=timezone.now)
    expected_delivery_date = models.DateField(null=True, blank=True)
    actual_delivery_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.po_number:
            last = PurchaseOrder.objects.order_by('-id').first()
            next_id = (last.id + 1) if last else 1
            self.po_number = f'PO-{next_id:05d}'
        super().save(*args, **kwargs)

    @property
    def is_late(self):
        if self.status in ('received', 'closed', 'cancelled'):
            return False
        return bool(self.expected_delivery_date and self.expected_delivery_date < timezone.now().date())

    def __str__(self):
        return f'{self.po_number} - {self.supplier.name}'


class PurchaseOrderLineItem(models.Model):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='line_items')
    material = models.ForeignKey(Material, on_delete=models.PROTECT, related_name='po_line_items')
    quantity_ordered = models.DecimalField(max_digits=12, decimal_places=2)
    quantity_received = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.CharField(max_length=300, blank=True)

    @property
    def is_fully_received(self):
        return self.quantity_received >= self.quantity_ordered

    def receive(self, quantity):
        """Receive a quantity against this line item: bumps Material stock,
        logs a StockMovement, and updates the parent PO status."""
        if quantity <= 0:
            raise ValueError('Received quantity must be positive')
        remaining = self.quantity_ordered - self.quantity_received
        if quantity > remaining:
            raise ValueError(f'Cannot receive {quantity}; only {remaining} remaining on this line')

        self.quantity_received += quantity
        self.save(update_fields=['quantity_received'])

        self.material.quantity_on_hand += quantity
        self.material.save(update_fields=['quantity_on_hand'])

        StockMovement.objects.create(
            material=self.material,
            movement_type='IN',
            quantity=quantity,
            reference=self.purchase_order.po_number,
            note=f'Received against {self.purchase_order.po_number}',
        )

        po = self.purchase_order
        line_items = po.line_items.all()
        if all(li.is_fully_received for li in line_items):
            po.status = 'received'
            po.actual_delivery_date = timezone.now().date()
        else:
            po.status = 'partially_received'
        po.save(update_fields=['status', 'actual_delivery_date'])

    def __str__(self):
        return f'{self.purchase_order.po_number} - {self.material.sku}'
