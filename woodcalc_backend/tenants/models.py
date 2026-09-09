import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone
from datetime import timedelta


class Company(models.Model):
    class Plan(models.TextChoices):
        TRIAL = "trial", "Trial"
        STARTER = "starter", "Starter"
        PRO = "pro", "Pro"
        ENTERPRISE = "enterprise", "Enterprise"

    class Status(models.TextChoices):
        TRIALING = "trialing", "Trialing"
        ACTIVE = "active", "Active"
        PAST_DUE = "past_due", "Past due"
        CANCELED = "canceled", "Canceled"
        SUSPENDED = "suspended", "Suspended"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    plan = models.CharField(max_length=20, choices=Plan.choices, default=Plan.TRIAL)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.TRIALING)
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    subscription_ends_at = models.DateTimeField(null=True, blank=True)
    max_users = models.PositiveIntegerField(default=5)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    def start_trial(self, days=30):
        self.status = self.Status.TRIALING
        self.trial_ends_at = timezone.now() + timedelta(days=days)
        self.save(update_fields=["status", "trial_ends_at"])

    @property
    def is_in_good_standing(self):
        if self.status == self.Status.ACTIVE:
            return True
        if self.status == self.Status.TRIALING:
            return self.trial_ends_at is None or timezone.now() <= self.trial_ends_at
        return False


class CompanyMembership(models.Model):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        ADMIN = "admin", "Admin"
        STAFF = "staff", "Staff"

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="memberships")
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="company_membership")
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STAFF)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("company", "user")

    def __str__(self):
        return f"{self.user} @ {self.company} ({self.role})"


class CompanySettings(models.Model):
    company = models.OneToOneField(Company, on_delete=models.CASCADE, related_name="settings")
    flags = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Settings for {self.company}"
