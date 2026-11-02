from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Company, CompanySettings


@receiver(post_save, sender=Company)
def create_company_settings(sender, instance, created, raw=False, **kwargs):
    if created and not raw:
        CompanySettings.objects.get_or_create(company=instance)
