"""Stable numbers that end up in a work order's piece IDs
(<WO number>-R<room number>-<cabinet badge>-<part code>, e.g. WO125-R2-03-SL):

- room_number: a room's number within its project, given once when the room is
  created. A revision keeps its parent's number (it's the same kitchen); a
  duplicate is a new room and gets the next one.
- cabinet badge: the number on a cabinet's position badge on the plan. Until a
  room is confirmed it's simply the cabinet's place in the list (1, 2, ...);
  confirming writes it onto each cabinet as `badge`, so deleting or adding a
  cabinet in a later revision can't renumber the others. Cabinets without one
  (added since) take the next numbers after the highest, in list order --
  formulaEngine.js cabinetBadges() does the same for the plan.
"""


def next_room_number(project_id, rooms):
    numbers = rooms.filter(project_id=project_id).exclude(room_number=None).values_list('room_number', flat=True)
    return max(numbers, default=0) + 1


def badge_numbers(cabinets):
    """Badge number for each cabinet, in list order."""
    taken = [c.get('badge') for c in cabinets if isinstance(c, dict) and isinstance(c.get('badge'), int)]
    nxt = max(taken, default=0) + 1
    out = []
    for c in cabinets:
        if isinstance(c, dict) and isinstance(c.get('badge'), int):
            out.append(c['badge'])
        else:
            out.append(nxt)
            nxt += 1
    return out


def freeze_badges(planner_data):
    """planner_data with every cabinet carrying its badge number; True if it changed."""
    cabinets = (planner_data or {}).get('cabinets')
    if not isinstance(cabinets, list) or not cabinets:
        return planner_data, False
    numbers = badge_numbers(cabinets)
    changed = False
    frozen = []
    for cab, n in zip(cabinets, numbers):
        if isinstance(cab, dict) and cab.get('badge') != n:
            cab = {**cab, 'badge': n}
            changed = True
        frozen.append(cab)
    return {**planner_data, 'cabinets': frozen}, changed
