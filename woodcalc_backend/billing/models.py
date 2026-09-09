from django.db import models
from tenants.models import Company


class PaymentMethod(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="payment_methods")
    encrypted_token = models.BinaryField()
    card_last4 = models.CharField(max_length=4, blank=True)
    card_brand = models.CharField(max_length=30, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.company} · {self.card_brand} ···{self.card_last4}"


class Invoice(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        FAILED = "failed", "Failed"

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="invoices")
    plan = models.CharField(max_length=20)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="JOD")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    paytabs_tran_ref = models.CharField(max_length=255, blank=True)
    billing_period_start = models.DateTimeField(null=True, blank=True)
    billing_period_end = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.company} · {self.amount} {self.currency} · {self.status}"
