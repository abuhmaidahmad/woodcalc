"""Drawer system sizes a confirmed room keeps.

A metal-sided drawer's shop-cut bottom and back are sized from its drawer
system's catalog entry (inventory.DrawerSystem). When a room is confirmed, the
entries of every drawer system its cabinets use are copied into the room's
construction_settings['drawer_systems'] ({name: sizes}), and the formula engine
uses those for the room instead of the live catalog -- so editing the catalog
later doesn't change a confirmed kitchen's cut sizes. A name with no catalog
entry is saved as None: the room keeps the default sizes it was confirmed with.
The snapshot itself is taken by crm/construction_snapshot.py.
"""

DRAWER_SIZE_FIELDS = (
    'bottom_width_deduction', 'bottom_depth_deduction', 'bottom_thickness',
    'back_width_deduction', 'back_height_m', 'back_height_c', 'back_thickness',
)


def _num(v):
    if v is None:
        return None
    f = float(v)
    return int(f) if f.is_integer() else f


def system_sizes(system):
    return {f: _num(getattr(system, f)) for f in DRAWER_SIZE_FIELDS}


def used_drawer_systems(planner_data):
    cabinets = (planner_data or {}).get('cabinets') if isinstance(planner_data, dict) else None
    return sorted({c['drawerSystem'] for c in (cabinets or [])
                   if isinstance(c, dict) and isinstance(c.get('drawerSystem'), str) and c['drawerSystem']})

