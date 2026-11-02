import math

CABINET_FIELDS = (
    "id", "label", "category", "subtype", "width", "height", "depth", "x", "y", "rotation", "elevation",
    "baseHeight", "wallHeight", "material", "doorStyle", "doorCount", "hingeSide", "handlePosition",
    "golaColor", "shelves", "drawerType", "drawerSystem", "drawerBoxConstruction", "openBoxMaterialSource",
    "nicheLowerDoorH", "nicheUpperDoorH", "panelThickness", "frontMaterial", "frontMaterialCode",
    "frontMaterialName", "frontColor", "frontMaterialThickness", "carcassMaterial", "carcassMaterialCode",
    "carcassMaterialName", "carcassColor", "glassType", "frameColor", "applianceFinish", "hoodMount",
    "ledStripInterior", "ledStripUnder", "skirtingSides", "skirtingMaterial", "isCustom",
)
SINK_FIELDS = {
    "sinkBrand": "brand", "sinkModel": "model", "sinkMaterial": "material", "sinkColor": "color",
    "sinkColorHex": "color_hex", "sinkCavityCount": "bowls", "sinkWidthMm": "width_mm",
    "sinkDepthMm": "depth_mm", "sinkBowlDepthMm": "bowl_depth_mm", "sinkCutoutWidthMm": "cutout_width_mm",
    "sinkCutoutDepthMm": "cutout_depth_mm",
}
ZONE_FIELDS = ("type", "h")
ZONE_PRESET_FIELDS = ("id", "label")
WALL_FIELDS = ("id", "x1", "y1", "x2", "y2", "thickness", "thicknessSide")
ELEMENT_FIELDS = ("id", "type", "label", "x", "y", "w", "h", "rotation", "elevation", "embeddedInWall",
                  "wallIndex", "surface")
COUNTERTOP_FIELDS = ("id", "code", "name", "brand", "color")
ROOM_FIELDS = {"width": "width_mm", "depth": "depth_mm", "ceilingHeight": "ceiling_height_mm"}
APPLIANCE_SUBTYPES = (
    "Fridge", "Oven Tower", "Double Oven", "Appliance", "Appliance Niche", "Hob + Oven", "Freestanding Oven",
    "Freestanding Fridge", "Freestanding Dishwasher", "Freestanding Hood",
)
SINK_SUBTYPES = ("Sink", "Single Sink", "Double Sink")
WALL_SNAP_MARGIN_MM = 200
SCALARS = (str, int, float, bool, type(None))


def _scalar(value):
    if isinstance(value, SCALARS):
        return value
    if isinstance(value, (list, tuple)) and all(isinstance(v, SCALARS) for v in value):
        return list(value)
    return None


def pick(source, fields):
    if not isinstance(source, dict):
        return {}
    out = {}
    for key in fields:
        if key in source:
            out[key] = _scalar(source[key])
    return out


def pick_renamed(source, mapping):
    if not isinstance(source, dict):
        return {}
    return {new: _scalar(source[old]) for old, new in mapping.items() if old in source}


def _number(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _zone_preset(value):
    if isinstance(value, str):
        return value
    if not isinstance(value, dict):
        return None
    preset = pick(value, ZONE_PRESET_FIELDS)
    zones = value.get("zones")
    if isinstance(zones, list):
        preset["zones"] = [pick(z, ZONE_FIELDS) for z in zones if isinstance(z, dict)]
    return preset


def _distance_to_segment(px, py, wall):
    x1, y1, x2, y2 = (_number(wall.get(k)) for k in ("x1", "y1", "x2", "y2"))
    dx, dy = x2 - x1, y2 - y1
    length_sq = dx * dx + dy * dy
    t = 0.0 if length_sq == 0 else max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / length_sq))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def nearest_wall(walls, px, py, reach):
    best, best_distance = None, None
    for index, wall in enumerate(walls):
        distance = _distance_to_segment(px, py, wall)
        if best_distance is None or distance < best_distance:
            best, best_distance = index, distance
    if best is None or best_distance > reach:
        return None
    return best


def _walls(raw_walls):
    walls = []
    for index, wall in enumerate(raw_walls):
        clean = pick(wall, WALL_FIELDS)
        clean["index"] = index
        clean["label"] = f"Wall {index + 1}"
        clean["length_mm"] = round(math.hypot(_number(wall.get("x2")) - _number(wall.get("x1")),
                                              _number(wall.get("y2")) - _number(wall.get("y1"))))
        walls.append(clean)
    return walls


def _cabinet(raw, raw_walls):
    cabinet = pick(raw, CABINET_FIELDS)
    cabinet["zonePreset"] = _zone_preset(raw.get("zonePreset"))
    width, depth = _number(raw.get("width")), _number(raw.get("depth"))
    cx, cy = _number(raw.get("x")) + width / 2, _number(raw.get("y")) + depth / 2
    thickness = max((_number(w.get("thickness"), 120) for w in raw_walls), default=120)
    cabinet["wall"] = nearest_wall(raw_walls, cx, cy, depth / 2 + thickness + WALL_SNAP_MARGIN_MM)
    if raw.get("subtype") in SINK_SUBTYPES or "sinkModel" in raw:
        sink = pick_renamed(raw, SINK_FIELDS)
        if sink:
            cabinet["sink"] = sink
    return cabinet


def _element(raw, raw_walls):
    element = pick(raw, ELEMENT_FIELDS)
    if isinstance(raw.get("wallIndex"), int):
        element["wall"] = raw["wallIndex"]
    else:
        element["wall"] = nearest_wall(raw_walls, _number(raw.get("x")), _number(raw.get("y")), WALL_SNAP_MARGIN_MM)
    return element


def _finishes(cabinets, countertop):
    seen, finishes = set(), []

    def add(role, code, name, color):
        if not (code or name or color):
            return
        key = (role, code, name, color)
        if key in seen:
            return
        seen.add(key)
        finishes.append({"role": role, "code": code, "name": name, "color": color})

    for cab in cabinets:
        add("front", cab.get("frontMaterialCode"), cab.get("frontMaterialName"), cab.get("frontColor"))
        add("carcass", cab.get("carcassMaterialCode"), cab.get("carcassMaterialName"), cab.get("carcassColor"))
        if cab.get("doorStyle") == "Gola":
            add("gola", None, "Gola profile", cab.get("golaColor"))
        if cab.get("applianceFinish"):
            add("appliance", None, cab.get("applianceFinish"), None)
    material = countertop.get("material") or {}
    add("countertop", material.get("code"), material.get("name"), material.get("color"))
    return finishes


def _appliances(cabinets):
    return [
        {
            "cabinet_id": c.get("id"), "label": c.get("label"), "subtype": c.get("subtype"),
            "width": c.get("width"), "height": c.get("height"), "depth": c.get("depth"),
            "finish": c.get("applianceFinish"), "hood_mount": c.get("hoodMount"), "wall": c.get("wall"),
        }
        for c in cabinets if c.get("subtype") in APPLIANCE_SUBTYPES
    ]


def _countertop(data, cabinets):
    cutouts = [
        {"cabinet_id": c.get("id"), "cabinet_label": c.get("label"), "wall": c.get("wall"), **c["sink"]}
        for c in cabinets if c.get("sink")
    ]
    hob_cabinets = [
        {"cabinet_id": c.get("id"), "cabinet_label": c.get("label"), "width": c.get("width"), "wall": c.get("wall")}
        for c in cabinets if c.get("subtype") == "Hob + Oven"
    ]
    return {
        "material": pick(data.get("countertopMat"), COUNTERTOP_FIELDS) or None,
        "thickness_mm": _scalar(data.get("countertopThickness")),
        "backsplash_height_mm": _scalar(data.get("backsplashHeight")),
        "backsplash_thickness_mm": _scalar(data.get("backsplashThickness")),
        "sink_cutouts": cutouts,
        "hob_cabinets": hob_cabinets,
    }


def build_design_snapshot(room):
    data = room.planner_data if isinstance(room.planner_data, dict) else {}
    raw_walls = [w for w in data.get("walls") or [] if isinstance(w, dict)]
    cabinets = [_cabinet(c, raw_walls) for c in data.get("cabinets") or [] if isinstance(c, dict)]
    countertop = _countertop(data, cabinets)
    return {
        "room_id": room.id,
        "room_name": room.name,
        "room_type": room.room_type,
        "revision_number": room.revision_number,
        "room": pick_renamed(data.get("room"), ROOM_FIELDS),
        "base_height_mm": _scalar(data.get("baseHeight")),
        "wall_thickness_mm": _scalar(data.get("wallThickness")),
        "walls": _walls(raw_walls),
        "elements": [_element(e, raw_walls) for e in data.get("elements") or [] if isinstance(e, dict)],
        "cabinets": cabinets,
        "appliances": _appliances(cabinets),
        "countertop": countertop,
        "finishes": _finishes(cabinets, countertop),
    }
