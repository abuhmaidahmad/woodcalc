from django.conf import settings
from django.db import models

from tenants.models import Company


class InstallationQuerySet(models.QuerySet):
    def for_manager(self, user):
        return self

    def for_assignee(self, user):
        return self.filter(assignments__user=user).distinct()


class Installation(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        IN_PROGRESS = "in_progress", "In progress"
        ISSUE = "issue", "Issue"
        COMPLETED = "completed", "Completed"

    tenant = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="installations")
    project = models.ForeignKey("crm.Project", on_delete=models.CASCADE, related_name="installations")
    room = models.ForeignKey("crm.Room", null=True, on_delete=models.SET_NULL, related_name="installations")
    design_snapshot = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    scheduled_date = models.DateField(null=True, blank=True)
    area = models.CharField(max_length=120, blank=True)
    address = models.CharField(max_length=300, blank=True)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    site_contact_name = models.CharField(max_length=200, blank=True)
    site_contact_phone = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = InstallationQuerySet.as_manager()

    class Meta:
        ordering = ["scheduled_date", "id"]

    def __str__(self):
        return f"{self.project} ({self.get_status_display()})"


class InstallationAssignment(models.Model):
    installation = models.ForeignKey(Installation, on_delete=models.CASCADE, related_name="assignments")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="installation_assignments")
    is_lead = models.BooleanField(default=False)

    class Meta:
        unique_together = ("installation", "user")

    def __str__(self):
        return f"{self.user} on {self.installation_id}"
