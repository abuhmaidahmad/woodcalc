from django.db import migrations

FIELDS = (
    'bottom_width_deduction', 'bottom_depth_deduction', 'bottom_thickness',
    'back_width_deduction', 'back_height_m', 'back_height_c', 'back_thickness',
)


def _num(v):
    if v is None:
        return None
    f = float(v)
    return int(f) if f.is_integer() else f


def freeze(apps, schema_editor):
    """Locked rooms keep today's catalog sizes of the drawer systems their
    cabinets use (construction_settings['drawer_systems']; a system missing from
    the catalog is saved as None = default sizes). Nothing else on any room
    changes, updated_at included. Mirrors crm/drawer_sizes.py, kept inline so
    this migration doesn't change if that code does."""
    Room = apps.get_model('crm', 'Room')
    DrawerSystem = apps.get_model('inventory', 'DrawerSystem')
    for room in Room.objects.filter(is_locked=True).select_related('project__client'):
        settings = dict(room.construction_settings or {})
        saved = dict(settings.get('drawer_systems') or {})
        cabinets = (room.planner_data or {}).get('cabinets') if isinstance(room.planner_data, dict) else None
        names = sorted({c['drawerSystem'] for c in (cabinets or [])
                        if isinstance(c, dict) and isinstance(c.get('drawerSystem'), str) and c['drawerSystem']})
        missing = [n for n in names if n not in saved]
        if not missing and 'drawer_systems' in settings:
            continue
        tenant_id = room.project.client.tenant_id
        catalog = {s.name: s for s in DrawerSystem.objects.filter(tenant_id=tenant_id, name__in=missing)}
        for name in missing:
            saved[name] = {f: _num(getattr(catalog[name], f)) for f in FIELDS} if name in catalog else None
        settings['drawer_systems'] = saved
        Room.objects.filter(pk=room.pk).update(construction_settings=settings)


class Migration(migrations.Migration):

    dependencies = [
        ("crm", "0014_room_number_and_badges"),
        ("inventory", "0027_drawersystem_bottom_sizes"),
    ]

    operations = [migrations.RunPython(freeze, migrations.RunPython.noop)]
