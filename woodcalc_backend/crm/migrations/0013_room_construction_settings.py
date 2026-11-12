from django.db import migrations, models


def freeze_locked_rooms(apps, schema_editor):
    # Rooms already confirmed/locked get the construction settings their company
    # has today, so their cut sizes stay put if the company changes them later.
    # Nothing else on any room changes; unlocked rooms stay null (they follow
    # the company). Mirrors tenants.utils.frozen_construction_settings, kept
    # inline so this migration doesn't change if that code does.
    Room = apps.get_model('crm', 'Room')
    CompanySettings = apps.get_model('tenants', 'CompanySettings')
    Material = apps.get_model('inventory', 'Material')
    cache = {}

    def settings_for(company_id):
        if company_id not in cache:
            row = CompanySettings.objects.filter(company_id=company_id).first()
            flags = dict(row.flags) if row else {}
            sku = flags.get('back_panel_material_sku') or None
            thickness = flags.get('back_panel_thickness_mm')
            if sku:
                mat = Material.objects.filter(tenant_id=company_id, sku=sku).first()
                if mat is None:
                    sku = None
                elif mat.board_thickness:
                    thickness = mat.board_thickness
            cache[company_id] = {
                'back_construction': flags.get('back_construction') or 'surface',
                'back_panel_thickness_mm': thickness or 8,
                'back_panel_material_sku': sku,
            }
        return cache[company_id]

    rooms = Room.objects.filter(is_locked=True, construction_settings__isnull=True).select_related('project__client')
    for room in rooms:
        Room.objects.filter(pk=room.pk).update(construction_settings=settings_for(room.project.client.tenant_id))


class Migration(migrations.Migration):

    dependencies = [
        ("crm", "0012_recompute_project_totals"),
        ("tenants", "0005_membership_auditor_role"),
        ("inventory", "0025_material_types_back_glass"),
    ]

    operations = [
        migrations.AddField(
            model_name="room",
            name="construction_settings",
            field=models.JSONField(blank=True, default=None, null=True),
        ),
        migrations.RunPython(freeze_locked_rooms, migrations.RunPython.noop),
    ]
