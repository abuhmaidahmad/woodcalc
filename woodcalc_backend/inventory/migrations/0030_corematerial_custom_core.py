import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0029_drawer_system_runner_hole_pattern"),
        ("tenants", "0007_backfill_company_settings"),
    ]

    operations = [
        migrations.CreateModel(
            name="CoreMaterial",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=60)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="core_materials", to="tenants.company")),
            ],
            options={
                "ordering": ["name"],
                "unique_together": {("tenant", "name")},
            },
        ),
        migrations.AlterField(
            model_name="material",
            name="core_material",
            field=models.CharField(blank=True, default="particleboard", help_text="Board substrate/core: a BUILTIN_CORE_MATERIALS key or the name of one of the tenant's CoreMaterial rows", max_length=60, null=True),
        ),
    ]
