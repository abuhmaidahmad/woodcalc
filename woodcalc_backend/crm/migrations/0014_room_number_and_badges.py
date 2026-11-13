from django.db import migrations, models


def number_rooms_and_freeze_badges(apps, schema_editor):
    """Gives every existing room its number within its project (oldest first;
    a revision takes its original room's number) and writes the badge numbers
    already showing on locked rooms' plans (their place in the cabinet list)
    onto their cabinets. Nothing else on any room changes, updated_at included.
    Kept inline (see crm/numbering.py for the live rules) so this migration
    doesn't change if that code does."""
    Room = apps.get_model('crm', 'Room')
    rooms = list(Room.objects.order_by('project_id', 'created_at', 'id'))
    by_id = {r.id: r for r in rooms}

    def root(r):
        seen = set()
        while r.parent_revision_id in by_id and r.id not in seen:
            seen.add(r.id)
            r = by_id[r.parent_revision_id]
        return r

    numbers, next_by_project = {}, {}
    for r in rooms:
        if r.parent_revision_id not in by_id:
            next_by_project[r.project_id] = next_by_project.get(r.project_id, 0) + 1
            numbers[r.id] = next_by_project[r.project_id]
    for r in rooms:
        fields = {'room_number': numbers.get(root(r).id)}
        cabinets = (r.planner_data or {}).get('cabinets') if isinstance(r.planner_data, dict) else None
        if r.is_locked and isinstance(cabinets, list) and cabinets:
            taken = [c.get('badge') for c in cabinets if isinstance(c, dict) and isinstance(c.get('badge'), int)]
            nxt = max(taken, default=0) + 1
            frozen = []
            for c in cabinets:
                if isinstance(c, dict) and not isinstance(c.get('badge'), int):
                    c = {**c, 'badge': nxt}
                    nxt += 1
                frozen.append(c)
            fields['planner_data'] = {**r.planner_data, 'cabinets': frozen}
        Room.objects.filter(pk=r.pk).update(**fields)


class Migration(migrations.Migration):

    dependencies = [
        ("crm", "0013_room_construction_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="room",
            name="room_number",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.RunPython(number_rooms_and_freeze_badges, migrations.RunPython.noop),
    ]
