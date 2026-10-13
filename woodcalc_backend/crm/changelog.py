import json

from .models import RoomChangeLog

Action = RoomChangeLog.Action

CABINET_FIELDS = (
    'width', 'height', 'depth', 'panelThickness', 'frontMaterialThickness', 'backPanelThickness', 'baseHeight',
    'category', 'subtype', 'name', 'doorCount', 'doorStyle', 'drawerType', 'zonePreset',
    'material', 'carcassMaterial', 'carcassMaterialCode', 'carcassMaterialName', 'carcassColor',
    'frontMaterial', 'frontMaterialCode', 'frontMaterialName', 'frontColor',
    'drawerSystem', 'drawerBoxConstruction', 'skirtingMaterial',
    'x', 'y', 'rotation',
)
CABINET_SUMMARY_FIELDS = ('category', 'subtype', 'width', 'height', 'depth', 'carcassMaterialName', 'frontMaterialName')
ROOM_FIELDS = ('name', 'room_type', 'notes', 'grand_total')
MAX_VALUE_CHARS = 2000


def compact(value):
    encoded = json.dumps(value, default=str)
    if len(encoded) <= MAX_VALUE_CHARS:
        return json.loads(encoded)
    size = len(value) if isinstance(value, (list, dict)) else len(encoded)
    return {'summary': f'{type(value).__name__} too large to store', 'size': size}


def cabinet_summary(cabinet):
    return {k: cabinet[k] for k in CABINET_SUMMARY_FIELDS if k in cabinet}


def cabinets_by_id(planner_data):
    cabinets = (planner_data or {}).get('cabinets') or []
    return {str(c.get('id')): c for c in cabinets if isinstance(c, dict)}


def diff_planner_data(old, new):
    entries = []
    old_cabs, new_cabs = cabinets_by_id(old), cabinets_by_id(new)
    for cab_id, cab in new_cabs.items():
        if cab_id not in old_cabs:
            entries.append((Action.CABINET_ADDED, f'cabinets[{cab_id}]', None, cabinet_summary(cab)))
    for cab_id, cab in old_cabs.items():
        if cab_id not in new_cabs:
            entries.append((Action.CABINET_REMOVED, f'cabinets[{cab_id}]', cabinet_summary(cab), None))
    for cab_id, cab in new_cabs.items():
        before = old_cabs.get(cab_id)
        if before is None:
            continue
        for field in CABINET_FIELDS:
            if before.get(field) != cab.get(field):
                entries.append((Action.CABINET_CHANGED, f'cabinets[{cab_id}].{field}',
                                compact(before.get(field)), compact(cab.get(field))))
    old, new = old or {}, new or {}
    for key in sorted((set(old) | set(new)) - {'cabinets'}):
        if old.get(key) != new.get(key):
            entries.append((Action.EDIT, f'planner_data.{key}', compact(old.get(key)), compact(new.get(key))))
    return entries


def snapshot(room):
    return {'planner_data': json.loads(json.dumps(room.planner_data or {})),
            **{f: str(getattr(room, f)) if f == 'grand_total' else getattr(room, f) for f in ROOM_FIELDS}}


def log_room_edit(room, user, before):
    entries = [(Action.EDIT, field, before[field], str(getattr(room, field)) if field == 'grand_total' else getattr(room, field))
               for field in ROOM_FIELDS]
    entries = [e for e in entries if e[2] != e[3]]
    entries += diff_planner_data(before['planner_data'], room.planner_data)
    RoomChangeLog.objects.bulk_create([
        RoomChangeLog(room=room, user=user, action=action, field_path=path, old_value=old, new_value=new)
        for action, path, old, new in entries
    ])


def log_room_action(room, user, action, reason='', old_value=None, new_value=None):
    RoomChangeLog.objects.create(room=room, user=user, action=action, reason=reason,
                                 old_value=old_value, new_value=new_value)
