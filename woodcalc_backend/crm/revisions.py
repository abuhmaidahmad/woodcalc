from collections import defaultdict
from decimal import Decimal

from django.db.models import Q

from .models import Room

OPEN_STATUSES = (Room.RevisionStatus.DRAFT, Room.RevisionStatus.PENDING_APPROVAL, Room.RevisionStatus.REJECTED)


def revision_chain(room):
    rooms = {r.id: r for r in Room.objects.filter(project_id=room.project_id)}
    root = rooms[room.id]
    while root.parent_revision_id in rooms:
        root = rooms[root.parent_revision_id]
    children = defaultdict(list)
    for r in rooms.values():
        if r.parent_revision_id:
            children[r.parent_revision_id].append(r)
    chain, queue = [], [root]
    while queue:
        current = queue.pop(0)
        chain.append(current)
        queue.extend(children[current.id])
    return sorted(chain, key=lambda r: r.revision_number)


def active_revision(chain):
    approved = [r for r in chain if r.revision_status == Room.RevisionStatus.APPROVED]
    return approved[-1] if approved else chain[-1]


def started_work_orders(chain, tenant_id):
    from manufacturing.models import WorkOrder
    return WorkOrder.objects.filter(tenant_id=tenant_id, room_id_ref__in=[r.id for r in chain]).filter(
        Q(status__in=['IN_PROGRESS', 'COMPLETED']) | Q(station_logs__started_at__isnull=False)
    ).distinct()


def recompute_project_total(project):
    rooms = list(Room.objects.filter(project=project))
    roots = [r for r in rooms if r.parent_revision_id is None]
    total = sum((active_revision(revision_chain(root)).grand_total for root in roots), Decimal('0'))
    project.total_value = total
    project.save(update_fields=['total_value', 'updated_at'])


def retire_earlier_work_orders(room, chain, tenant_id, user, override_reason):
    from manufacturing.models import WorkOrder
    from .changelog import log_room_action
    from .models import RoomChangeLog
    rooms = {r.id: r for r in chain if r.id != room.id}
    started_ids = set(started_work_orders(chain, tenant_id).values_list('id', flat=True))
    cancelled, flagged = [], []
    for wo in WorkOrder.objects.filter(tenant_id=tenant_id, room_id_ref__in=list(rooms)).exclude(status='CANCELLED'):
        if wo.id in started_ids:
            wo.revision_changed_after_start = True
            wo.status_reason = f'Revision changed after start: Rev {room.revision_number} approved. {override_reason}'
            wo.save(update_fields=['revision_changed_after_start', 'status_reason'])
            flagged.append(wo.order_number)
            action = RoomChangeLog.Action.WORK_ORDER_FLAGGED
        elif wo.status == 'NEW':
            wo.status = 'CANCELLED'
            wo.status_reason = f'Superseded by Rev {room.revision_number}'
            wo.save(update_fields=['status', 'status_reason'])
            cancelled.append(wo.order_number)
            action = RoomChangeLog.Action.WORK_ORDER_CANCELLED
        else:
            continue
        log_room_action(rooms[wo.room_id_ref], user, action, reason=wo.status_reason,
                        new_value={'work_order': wo.order_number, 'status': wo.status})
    return cancelled, flagged
