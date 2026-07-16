from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    USER_TYPE_CHOICES = [
        ('customer', 'Customer'),
        ('architect', 'Architect / Interior Designer'),
        ('manufacturer', 'Manufacturer'),
        ('supplier', 'Supplier'),
    ]

    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20)
    city = models.CharField(max_length=100)
    user_type = models.CharField(max_length=20, choices=USER_TYPE_CHOICES)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'phone', 'city', 'user_type']

    def __str__(self):
        return f"{self.email} ({self.user_type})"


class ArchitectProfile(models.Model):
    SPECIALIZATION_CHOICES = [
        ('residential', 'Residential'),
        ('commercial', 'Commercial'),
        ('both', 'Both'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='architect_profile')
    company_studio_name = models.CharField(max_length=200, blank=True)
    license_number = models.CharField(max_length=100, blank=True)
    portfolio_url = models.URLField(blank=True)
    specialization = models.CharField(max_length=20, choices=SPECIALIZATION_CHOICES, default='both')
    years_of_experience = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"Architect: {self.user.email}"


class ManufacturerProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='manufacturer_profile')
    factory_company_name = models.CharField(max_length=200)
    commercial_registration_number = models.CharField(max_length=100, blank=True)
    production_capacity = models.CharField(max_length=200, blank=True)
    governorate_region = models.CharField(max_length=100, blank=True)
    trade_license_document = models.FileField(upload_to='documents/manufacturer/', blank=True, null=True)
    verification_status = models.CharField(
        max_length=20,
        choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')],
        default='pending'
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    admin_notes = models.TextField(blank=True)

    def __str__(self):
        return f"Manufacturer: {self.factory_company_name}"


class SupplierProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='supplier_profile')
    company_name = models.CharField(max_length=200)
    commercial_registration_number = models.CharField(max_length=100, blank=True)
    materials_supplied = models.JSONField(default=list)
    delivery_coverage_area = models.CharField(max_length=300, blank=True)
    trade_license_document = models.FileField(upload_to='documents/supplier/', blank=True, null=True)
    verification_status = models.CharField(
        max_length=20,
        choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')],
        default='pending'
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    admin_notes = models.TextField(blank=True)

    def __str__(self):
        return f"Supplier: {self.company_name}"

class EmailAccount(models.Model):
    """Stores a user's connected email account (e.g. purchasing officer's Gmail)
    used to send Purchase Order emails directly to suppliers from within the app.
    App password is encrypted at rest using Fernet symmetric encryption."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='email_account')
    email_address = models.EmailField()
    encrypted_app_password = models.BinaryField()
    smtp_host = models.CharField(max_length=100, default='smtp.gmail.com')
    smtp_port = models.PositiveIntegerField(default=587)
    is_active = models.BooleanField(default=True)
    connected_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email} -> {self.email_address}"
