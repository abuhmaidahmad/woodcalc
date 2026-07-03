from django.db import models


class Client(models.Model):
    name = models.CharField(max_length=200)
    company = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    address = models.CharField(max_length=300, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Lead(models.Model):
    STATUS_CHOICES = [
        ('NEW', 'New'), ('CONTACTED', 'Contacted'), ('QUALIFIED', 'Qualified'),
        ('LOST', 'Lost'), ('WON', 'Won'),
    ]
    name = models.CharField(max_length=200)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    source = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='NEW')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Quotation(models.Model):
    STATUS_CHOICES = [('DRAFT', 'Draft'), ('SENT', 'Sent'), ('ACCEPTED', 'Accepted'), ('REJECTED', 'Rejected')]
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='quotations')
    lead = models.ForeignKey(Lead, on_delete=models.SET_NULL, null=True, blank=True, related_name='quotations')
    quote_number = models.CharField(max_length=50, unique=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='DRAFT')
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.quote_number


class QuotationItem(models.Model):
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name='items')
    description = models.CharField(max_length=300)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def __str__(self):
        return f'{self.quotation.quote_number} - {self.description}'
class Project(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('ACTIVE', 'Active'),
        ('ON_HOLD', 'On Hold'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    ]
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='projects')
    name = models.CharField(max_length=200)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='DRAFT')
    address = models.CharField(max_length=300, blank=True)
    notes = models.TextField(blank=True)
    total_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.client.name} — {self.name}'


class Room(models.Model):
    ROOM_TYPES = [
        ('kitchen', 'Kitchen'),
        ('bathroom', 'Bathroom'),
        ('bedroom', 'Bedroom'),
        ('living', 'Living Room'),
        ('office', 'Office'),
        ('laundry', 'Laundry'),
        ('other', 'Other'),
    ]
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='rooms')
    name = models.CharField(max_length=200)
    room_type = models.CharField(max_length=20, choices=ROOM_TYPES, default='kitchen')
    planner_data = models.JSONField(default=dict, blank=True)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.project} — {self.name}'


class Payment(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PAID', 'Paid'),
        ('OVERDUE', 'Overdue'),
        ('CANCELLED', 'Cancelled'),
    ]
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='payments')
    label = models.CharField(max_length=200)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    due_date = models.DateField(null=True, blank=True)
    paid_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.project} — {self.label}'


class PaymentTransaction(models.Model):
    """Actual money received against a project, optionally settling a schedule installment.
    Cheques (common in Jordan, often post-dated) have their own lifecycle; they only
    count toward collected totals once CLEARED."""
    METHOD_CHOICES = [
        ('CASH', 'Cash'),
        ('TRANSFER', 'Bank Transfer'),
        ('CHEQUE', 'Cheque'),
    ]
    CURRENCY_CHOICES = [('JOD', 'JOD'), ('USD', 'USD')]
    CHEQUE_STATUS_CHOICES = [
        ('RECEIVED', 'Received'),
        ('DEPOSITED', 'Deposited'),
        ('CLEARED', 'Cleared'),
        ('BOUNCED', 'Bounced'),
    ]
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='transactions')
    installment = models.ForeignKey(Payment, on_delete=models.SET_NULL, null=True, blank=True, related_name='transactions')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='JOD')
    method = models.CharField(max_length=10, choices=METHOD_CHOICES, default='CASH')
    date_received = models.DateField()
    reference = models.CharField(max_length=100, blank=True)
    # Cheque-specific
    cheque_number = models.CharField(max_length=50, blank=True)
    cheque_bank = models.CharField(max_length=100, blank=True)
    cheque_due_date = models.DateField(null=True, blank=True)
    cheque_status = models.CharField(max_length=10, choices=CHEQUE_STATUS_CHOICES, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_received', '-created_at']

    def __str__(self):
        return f'{self.project} — {self.amount} {self.currency} ({self.method})'

    @property
    def is_collected(self):
        """Cash/transfer count immediately; cheques only when cleared."""
        if self.method == 'CHEQUE':
            return self.cheque_status == 'CLEARED'
        return True

    def save(self, *args, **kwargs):
        if self.method == 'CHEQUE' and not self.cheque_status:
            self.cheque_status = 'RECEIVED'
        if self.method != 'CHEQUE':
            self.cheque_status = ''
        super().save(*args, **kwargs)
        self.sync_installment()

    def sync_installment(self):
        """Auto-update the linked installment's status from its cleared transactions."""
        inst = self.installment
        if not inst:
            return
        collected = sum(
            t.amount for t in inst.transactions.all() if t.is_collected
        )
        if collected >= inst.amount and inst.amount > 0:
            if inst.status != 'PAID':
                inst.status = 'PAID'
                inst.paid_date = self.date_received
                inst.save(update_fields=['status', 'paid_date'])
        elif inst.status == 'PAID':
            inst.status = 'PENDING'
            inst.paid_date = None
            inst.save(update_fields=['status', 'paid_date'])
