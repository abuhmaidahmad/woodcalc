from decimal import Decimal

from django.db import migrations


def recompute(apps, schema_editor):
    # Project totals could include deleted or unconfirmed draft rooms. Reset each
    # one to the sum of the latest approved revision of every room.
    Project = apps.get_model('crm', 'Project')
    Room = apps.get_model('crm', 'Room')
    for project in Project.objects.all():
        rooms = {r.id: r for r in Room.objects.filter(project=project)}
        children = {}
        for r in rooms.values():
            if r.parent_revision_id in rooms:
                children.setdefault(r.parent_revision_id, []).append(r)
        total = Decimal('0')
        for root in (r for r in rooms.values() if r.parent_revision_id not in rooms):
            chain, queue = [], [root]
            while queue:
                current = queue.pop(0)
                chain.append(current)
                queue.extend(children.get(current.id, []))
            approved = sorted((r for r in chain if r.revision_status == 'approved'), key=lambda r: r.revision_number)
            if approved:
                total += approved[-1].grand_total
        if project.total_value != total:
            project.total_value = total
            project.save(update_fields=['total_value'])


class Migration(migrations.Migration):
    dependencies = [('crm', '0011_room_variants')]
    operations = [migrations.RunPython(recompute, migrations.RunPython.noop)]
