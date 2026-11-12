from django.db import migrations

ARABIAN_BUILD = "arabian build cabinetry"


def backfill(apps, schema_editor):
    Company = apps.get_model("tenants", "Company")
    CompanySettings = apps.get_model("tenants", "CompanySettings")
    for company in Company.objects.filter(settings__isnull=True):
        CompanySettings.objects.create(company=company)
    CompanySettings.objects.filter(company__name__iexact=ARABIAN_BUILD).update(delivery_method="third_party_link")


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0006_field_roles_delivery_method"),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
