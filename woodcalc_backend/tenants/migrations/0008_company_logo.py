from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0007_backfill_company_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="company",
            name="logo",
            field=models.ImageField(blank=True, null=True, upload_to="company_logos/"),
        ),
    ]
