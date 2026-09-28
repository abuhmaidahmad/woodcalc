import math

from django.core.management.base import BaseCommand, CommandError

from crm.models import Room
from tenants.models import Company

# Must match SCALE in woodcalc_frontend/src/features/kitchen_planner/KitchenPlannerModule.jsx --
# every saved wall's x1/y1/x2/y2 is stored in mm * SCALE.
SCALE = 0.16

# The exact value RoomCanvas/wallGeometry used for loop-tracing before this
# fix (DEFAULT_JOIN_THRESHOLD = 60, compared directly against scaled-px
# coordinates without ever being multiplied by scale).
OLD_THRESHOLD_PX = 60

# The new mm-based join tolerance (DEFAULT_JOIN_THRESHOLD_MM in
# wallGeometry.js), converted into the same scaled-px space the stored
# coordinates live in.
NEW_THRESHOLD_MM = 5
NEW_THRESHOLD_PX = NEW_THRESHOLD_MM * SCALE


def _normalize(dx, dy):
    length = math.hypot(dx, dy) or 1
    return dx / length, dy / length


def _wall_dir(wall):
    return _normalize(wall['x2'] - wall['x1'], wall['y2'] - wall['y1'])


def _polygon_signed_area(vertices):
    total = 0.0
    n = len(vertices)
    for i in range(n):
        ax, ay = vertices[i]
        bx, by = vertices[(i + 1) % n]
        total += ax * by - bx * ay
    return total / 2


def _find_endpoint_match(walls, wall_index, end, threshold):
    wall = walls[wall_index]
    vx = wall['x1'] if end == 0 else wall['x2']
    vy = wall['y1'] if end == 0 else wall['y2']
    best, best_dist = None, threshold
    for i, w in enumerate(walls):
        if i == wall_index:
            continue
        for x, y, e in ((w['x1'], w['y1'], 0), (w['x2'], w['y2'], 1)):
            d = math.hypot(vx - x, vy - y)
            if d < best_dist:
                best_dist = d
                best = (i, e)
    return best


def trace_closed_polygon(walls, threshold):
    n = len(walls)
    if n < 3:
        return None
    steps = [(0, False)]
    visited = {0}
    current_index, current_end = 0, 1
    for _ in range(1, n):
        match = _find_endpoint_match(walls, current_index, current_end, threshold)
        if match is None or match[0] in visited:
            return None
        visited.add(match[0])
        reversed_ = match[1] == 1
        steps.append((match[0], reversed_))
        current_index = match[0]
        current_end = 0 if reversed_ else 1
    closing = _find_endpoint_match(walls, current_index, current_end, threshold)
    if closing is None or closing[0] != 0 or closing[1] != 0:
        return None
    return steps


def _step_start(walls, step):
    idx, reversed_ = step
    w = walls[idx]
    return (w['x2'], w['y2']) if reversed_ else (w['x1'], w['y1'])


def _outward_normal(dx, dy, sign):
    return (dy, -dx) if sign >= 0 else (-dy, dx)


def _old_normal_for_step(walls, loop, i, outward_sign):
    idx, reversed_ = loop[i]
    w = walls[idx]
    ux, uy = _wall_dir(w)
    dx, dy = (-ux, -uy) if reversed_ else (ux, uy)
    return _outward_normal(dx, dy, outward_sign)


def _classify_side(wall, normal):
    ux, uy = _wall_dir(wall)
    dot = normal[0] * uy + normal[1] * (-ux)
    return 'right' if dot > 0 else 'left'


def old_rendered_side_for_loop(walls, loop):
    vertex_loop = [_step_start(walls, step) for step in loop]
    outward_sign = 1 if _polygon_signed_area(vertex_loop) >= 0 else -1
    sides = {}
    for i, (idx, _reversed) in enumerate(loop):
        normal = _old_normal_for_step(walls, loop, i, outward_sign)
        sides[idx] = _classify_side(walls[idx], normal)
    return sides


def find_drifted_walls(walls):
    """Returns a list of (wall_index, wall_id, stored_side, old_rendered_side)
    for every wall whose rendered side would change under the new code, plus
    whether the room's closed/open classification itself flips. Read-only:
    only inspects the wall list, never mutates it."""
    old_loop = trace_closed_polygon(walls, OLD_THRESHOLD_PX)
    if old_loop is None:
        # Old code already treated this room as an open chain -- open chains
        # always used per-wall thicknessSide already, so nothing changes.
        return [], False, False

    new_loop = trace_closed_polygon(walls, NEW_THRESHOLD_PX)
    loop_reclassified = new_loop is None  # tighter threshold broke the loop

    old_sides = old_rendered_side_for_loop(walls, old_loop)
    drifted = []
    for idx, _reversed in old_loop:
        wall = walls[idx]
        stored_side = wall.get('thicknessSide') or 'right'
        old_side = old_sides[idx]
        if old_side != stored_side:
            drifted.append((idx, wall.get('id', f'#{idx}'), stored_side, old_side))
    return drifted, True, loop_reclassified


class Command(BaseCommand):
    help = (
        'Read-only: for every Room with saved walls, reports which walls '
        'would visibly render on a different side once wall rendering '
        'stops inferring side from loop winding and uses each wall\'s own '
        'thicknessSide instead. Makes no database writes.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--tenant', help='Only check rooms belonging to this company slug')
        parser.add_argument('--room', type=int, help='Only check this one room id')

    def handle(self, *args, **opts):
        qs = Room.objects.select_related('project__client__tenant').order_by('project__client__tenant_id', 'project_id', 'id')
        if opts.get('tenant'):
            company = Company.objects.filter(slug=opts['tenant']).first()
            if company is None:
                raise CommandError(f'No company with slug "{opts["tenant"]}"')
            qs = qs.filter(project__client__tenant=company)
        if opts.get('room'):
            qs = qs.filter(pk=opts['room'])

        rooms_checked = 0
        rooms_affected = 0
        rooms_reclassified_only = 0
        total_walls_drifted = 0

        for room in qs.iterator():
            walls = (room.planner_data or {}).get('walls') or []
            if len(walls) < 3:
                continue
            rooms_checked += 1
            try:
                drifted, was_closed, loop_reclassified = find_drifted_walls(walls)
            except (KeyError, TypeError, ZeroDivisionError) as e:
                self.stderr.write(f'Room {room.pk} ({room.project.client.tenant.slug}): could not evaluate walls -- {e}')
                continue
            if not was_closed:
                continue
            if not drifted and not loop_reclassified:
                continue

            rooms_affected += 1 if drifted else 0
            if not drifted and loop_reclassified:
                rooms_reclassified_only += 1
            total_walls_drifted += len(drifted)

            tenant_slug = room.project.client.tenant.slug
            self.stdout.write(f'\nRoom {room.pk} "{room.name}" (tenant={tenant_slug}, project={room.project_id}):')
            if loop_reclassified:
                self.stdout.write(self.style.WARNING(
                    '  loop closure itself changes under the new 5mm join threshold -- '
                    'this room\'s walls have a gap wider than 5mm (but under the old ~375mm '
                    'tolerance) somewhere, so the corner there goes from mitered to a flat cap.'
                ))
            for idx, wall_id, stored_side, old_side in drifted:
                self.stdout.write(
                    f'  wall[{idx}] id={wall_id}: stored thicknessSide={stored_side!r}, '
                    f'currently RENDERS as {old_side!r} -- will visibly flip to {stored_side!r} '
                    f'after the fix (a {stored_side != old_side and "full-thickness" or "no"} shift).'
                )

        self.stdout.write(self.style.SUCCESS(
            f'\nChecked {rooms_checked} room(s) with 3+ walls. '
            f'{rooms_affected} room(s) have at least one wall whose rendered side will change '
            f'({total_walls_drifted} wall(s) total). '
            f'{rooms_reclassified_only} additional room(s) only have a corner-mitering change '
            '(no wall side actually moves). No data was modified.'
        ))
