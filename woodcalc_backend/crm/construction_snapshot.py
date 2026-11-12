"""The construction settings a confirmed room is cut with, and what to tell
whoever confirms it.

snapshot(company, planner_data): the company's settings as they stand now
(tenants.utils.frozen_construction_settings) plus the catalog sizes of every
drawer system the cabinets use (crm/drawer_sizes.py). Confirming a room --
including re-confirming one that was unlocked -- saves a fresh snapshot.

missing_size_warnings(): metal-sided drawer systems whose bottom/back sizes
aren't in the catalog (the room is then cut with the default bottom and no
back). snapshot_changes(): what a fresh snapshot changes versus the one the
room was confirmed with before. Both feed the confirm dialog (confirm_preview).
"""
from tenants.utils import (DEFAULT_DRAWER_BOTTOM_THICKNESS_MM, DEFAULT_DRAWER_BOX_THICKNESS_MM,
                           frozen_construction_settings)

from .drawer_sizes import DRAWER_SIZE_FIELDS, system_sizes, used_drawer_systems

DRAWER_CABINET_SUBTYPES = ('Drawers', '2Drw+Door')
BACK_FIELDS = ('back_width_deduction', 'back_height_m', 'back_height_c', 'back_thickness')
SETTING_KEYS = ('back_construction', 'back_panel_thickness_mm', 'back_panel_material_sku',
                'drawer_box_material_sku', 'drawer_box_thickness_mm',
                'drawer_bottom_material_sku', 'drawer_bottom_thickness_mm')
# What a room confirmed before a setting was saved was cut with.
LEGACY_DEFAULTS = {'drawer_box_thickness_mm': DEFAULT_DRAWER_BOX_THICKNESS_MM,
                   'drawer_bottom_thickness_mm': DEFAULT_DRAWER_BOTTOM_THICKNESS_MM}


def _catalog(company, names):
    from inventory.models import DrawerSystem
    return {s.name: s for s in DrawerSystem.objects.filter(tenant=company, name__in=names)}


def snapshot(company, planner_data):
    names = used_drawer_systems(planner_data)
    catalog = _catalog(company, names)
    return {
        **frozen_construction_settings(company),
        'drawer_systems': {n: (system_sizes(catalog[n]) if n in catalog else None) for n in names},
    }


def missing_size_warnings(company, planner_data):
    """[{system, missing: ['bottom', 'back'] or ['back']}] for metal-sided drawer cabinets."""
    cabinets = (planner_data or {}).get('cabinets') if isinstance(planner_data, dict) else None
    names = sorted({c.get('drawerSystem') for c in (cabinets or []) if isinstance(c, dict)
                    and c.get('subtype') in DRAWER_CABINET_SUBTYPES
                    and c.get('drawerBoxConstruction') == 'metal_sided'
                    and isinstance(c.get('drawerSystem'), str) and c.get('drawerSystem')})
    catalog = _catalog(company, names)
    warnings = []
    for name in names:
        sys = catalog.get(name)
        if sys is None:
            warnings.append({'system': name, 'missing': ['bottom', 'back']})
        elif any(getattr(sys, f) is None for f in BACK_FIELDS):
            warnings.append({'system': name, 'missing': ['back']})
    return warnings


def snapshot_changes(old, new):
    """[{setting, system, field, old, new}] -- system/field only for drawer
    systems. A whole-system entry (field None) also says which change it is:
    'added' / 'removed' (a cabinet started or stopped using it), 'catalog_added'
    (it now has a catalog entry, before the defaults were used) or
    'catalog_removed' (its catalog entry is gone: the defaults now)."""
    if not old:
        return []
    changes = []
    for key in SETTING_KEYS:
        before = old.get(key, LEGACY_DEFAULTS.get(key))
        if before != new.get(key):
            changes.append({'setting': key, 'system': None, 'field': None, 'old': before, 'new': new.get(key)})
    old_sys, new_sys = old.get('drawer_systems') or {}, new.get('drawer_systems') or {}
    for name in sorted(set(old_sys) | set(new_sys)):
        a, b = old_sys.get(name), new_sys.get(name)
        if name not in old_sys or name not in new_sys or (a is None) != (b is None):
            kind = ('added' if name not in old_sys else 'removed' if name not in new_sys
                    else 'catalog_added' if a is None else 'catalog_removed')
            changes.append({'setting': 'drawer_systems', 'system': name, 'field': None, 'old': a, 'new': b,
                            'change': kind})
            continue
        if a is None:
            continue
        for f in DRAWER_SIZE_FIELDS:
            if a.get(f) != b.get(f):
                changes.append({'setting': 'drawer_systems', 'system': name, 'field': f,
                                'old': a.get(f), 'new': b.get(f)})
    return changes
