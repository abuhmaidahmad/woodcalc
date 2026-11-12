import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("crm", "0012_recompute_project_totals"),
        ("tenants", "0007_backfill_company_settings"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Installation",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("design_snapshot", models.JSONField(blank=True, default=dict)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("scheduled", "Scheduled"),
                            ("in_progress", "In progress"),
                            ("issue", "Issue"),
                            ("completed", "Completed"),
                        ],
                        default="scheduled",
                        max_length=20,
                    ),
                ),
                ("scheduled_date", models.DateField(blank=True, null=True)),
                ("area", models.CharField(blank=True, max_length=120)),
                ("address", models.CharField(blank=True, max_length=300)),
                ("lat", models.FloatField(blank=True, null=True)),
                ("lng", models.FloatField(blank=True, null=True)),
                ("site_contact_name", models.CharField(blank=True, max_length=200)),
                ("site_contact_phone", models.CharField(blank=True, max_length=50)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="installations",
                        to="crm.project",
                    ),
                ),
                (
                    "room",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="installations",
                        to="crm.room",
                    ),
                ),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="installations",
                        to="tenants.company",
                    ),
                ),
            ],
            options={
                "ordering": ["scheduled_date", "id"],
            },
        ),
        migrations.CreateModel(
            name="InstallationAssignment",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("is_lead", models.BooleanField(default=False)),
                (
                    "installation",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="assignments",
                        to="field_ops.installation",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="installation_assignments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "unique_together": {("installation", "user")},
            },
        ),
    ]
