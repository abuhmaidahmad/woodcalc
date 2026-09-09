from django.conf import settings
from django.db import models
from tenants.models import Company


class Feedback(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New"
        REVIEWING = "reviewing", "Reviewing"
        PLANNED = "planned", "Planned"
        DECLINED = "declined", "Declined"
        DONE = "done", "Done"

    tenant = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="feedback_items")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="feedback_items")
    message = models.TextField()
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.NEW)
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.tenant} — {self.message[:50]}"
