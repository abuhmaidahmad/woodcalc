import math
import re

SCALE = 0.16
WALL_THICKNESS = 120
ENDPOINT_SNAP_PX = 60
MARGIN = 500
BASE_HEIGHT = 720
LEG_HEIGHT = 150
COUNTERTOP_THICKNESS = 30
FRONT_THICKNESS = 18
BLIND_PANEL_WIDTH = 650
COUNTERTOP_COLOR = '#F0EEE9'

PROJECT_DEFAULTS = {
    'doorStyle': 'Push',
    'golaColor': 'black',
    'handlePos': 'bottom',
    'carcassColor': '#F5F0E8',
    'frontColor': '#FFFFFF',
    'frontFinish': 'matt',
    'frontMaterialCode': None,
    'frontMaterialThickness': FRONT_THICKNESS,
    'drawerSystem': 'Local Bearing',
    'drawerBoxConstruction': 'wood_box',
    'skirtingMaterial': 'match_countertop',
}

ROOM_ELEMENTS = {
    'window': {'label': 'Window', 'icon': '🪟', 'color': '#87CEEB', 'w': 900, 'h': 1200},
    'door': {'label': 'Door', 'icon': '🚪', 'color': '#DEB887', 'w': 900, 'h': 2300},
    'electric': {'label': 'Electric Point', 'icon': '⚡', 'color': '#FFD700', 'w': 100, 'h': 100},
    'water': {'label': 'Water Supply', 'icon': '💧', 'color': '#4FC3F7', 'w': 100, 'h': 100},
    'drain': {'label': 'Drain Point', 'icon': '🕳', 'color': '#90A4AE', 'w': 100, 'h': 100},
    'gas': {'label': 'Gas Point', 'icon': '🔥', 'color': '#FF7043', 'w': 100, 'h': 100},
}

ICONS = {
    ('base', 'Standard'): 'base_standard',
    ('base', 'Sink'): 'base_sink',
    ('base', 'Hob + Oven'): 'base_hob_oven',
    ('base', 'Drawers'): 'base_drawers',
    ('corner', 'Blind'): 'corner_blind',
    ('wall', 'Standard'): 'wall_standard',
    ('wall', 'Appliance'): 'wall_appliance',
    ('accessories', 'Filler'): 'accessory_filler',
    ('accessories', 'Side Panel'): 'accessory_filler',
    ('accessories', 'Shelf'): 'accessory_shelf',
    ('accessories', 'Freestanding Dishwasher'): 'accessory_gap_dish',
    ('accessories', 'Freestanding Fridge'): 'accessory_gap_fridge',
}

FACING = {'+x': (1, 0), '-x': (-1, 0), '+y': (0, 1), '-y': (0, -1)}


class LayoutError(ValueError):
    pass


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def _add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def _mul(a, k):
    return (a[0] * k, a[1] * k)


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1]


def _unit(v):
    n = math.hypot(v[0], v[1])
    if n == 0:
        raise LayoutError('zero-length vector')
    return (v[0] / n, v[1] / n)


def _line_intersection(p, u, q, v):
    den = u[0] * v[1] - u[1] * v[0]
    if abs(den) < 1e-9:
        return None
    t = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / den
    return _add(p, _mul(u, t))


def _r(v):
    return round(v, 2)


class Converter:
    def __init__(self, layout, sink=None):
        self.layout = layout
        self.sink = sink
        self.report = {'mapped': [], 'warnings': [], 'skipped': [], 'checks': {}}
        self.cabinets = []
        self.elements = []
        self.next_id = 1
        self.half_t = WALL_THICKNESS / 2
        self.defaults = layout.get('wall_unit_defaults', {})
        self.base_depth = layout.get('base_unit_defaults', {}).get('depth', 580)
        self._build_walls()

    def warn(self, msg):
        self.report['warnings'].append(msg)

    def to_planner(self, p):
        return (self.ox + p[0], self.oy + p[1])

    def rotation_for(self, facing):
        fx, fy = facing
        return round(math.degrees(math.atan2(-fx, fy))) % 360

    def _build_walls(self):
        raw = self.layout.get('walls') or []
        if not raw:
            raise LayoutError('layout has no walls')
        pts = [tuple(w['from']) for w in raw] + [tuple(w['to']) for w in raw]
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        self.walls = {}
        self.wall_order = []
        for w in raw:
            a, b = tuple(w['from']), tuple(w['to'])
            u = _unit(_sub(b, a))
            n = (-u[1], u[0])
            if 'inside' in w:
                n = FACING[w['inside']]
            elif _dot(_sub((cx, cy), a), n) < 0:
                n = (-n[0], -n[1])
            self.walls[w['id']] = {'id': w['id'], 'from': a, 'to': b, 'u': u, 'n': n, 'spec': w}
            self.wall_order.append(w['id'])

        def shared(wid, pt):
            for other in self.wall_order:
                if other == wid:
                    continue
                ow = self.walls[other]
                for q in (ow['from'], ow['to']):
                    if math.hypot(q[0] - pt[0], q[1] - pt[1]) < 1:
                        return ow
            return None

        for wid in self.wall_order:
            w = self.walls[wid]
            off = _mul(w['n'], -self.half_t)
            ends = []
            for pt in (w['from'], w['to']):
                other = shared(wid, pt)
                c = None
                if other is not None:
                    c = _line_intersection(_add(w['from'], off), w['u'], _add(other['from'], _mul(other['n'], -self.half_t)), other['u'])
                ends.append(c if c is not None else _add(pt, off))
            w['center'] = ends

        allc = [p for wid in self.wall_order for p in self.walls[wid]['center']]
        self.ox = MARGIN - min(p[0] for p in allc)
        self.oy = MARGIN - min(p[1] for p in allc)

        self.planner_walls = []
        for wid in self.wall_order:
            w = self.walls[wid]
            p1, p2 = (self.to_planner(p) for p in w['center'])
            entry = {'x1': _r(p1[0] * SCALE), 'y1': _r(p1[1] * SCALE), 'x2': _r(p2[0] * SCALE), 'y2': _r(p2[1] * SCALE), 'lengthMode': 'inner'}
            w['angle'] = math.degrees(math.atan2(p2[1] - p1[1], p2[0] - p1[0]))
            w['index'] = len(self.planner_walls)
            self.planner_walls.append(entry)

    def wall(self, wid):
        if wid not in self.walls:
            raise LayoutError(f'unknown wall "{wid}"')
        return self.walls[wid]

    def face_point(self, w, along):
        return _add(w['from'], _mul(w['u'], along))

    def along_of(self, w, spec):
        if 'at_x' in spec and abs(w['u'][0]) > 1e-9:
            return (spec['at_x'] - w['from'][0]) / w['u'][0]
        if 'at_y' in spec and abs(w['u'][1]) > 1e-9:
            return (spec['at_y'] - w['from'][1]) / w['u'][1]
        raise LayoutError(f'cannot locate {spec} on wall {w["id"]}')

    def base_fields(self, category, subtype):
        pd = PROJECT_DEFAULTS
        return {
            'category': category,
            'subtype': subtype,
            'icon': ICONS.get((category, subtype), 'specialty_custom'),
            'material': 'Particleboard',
            'doorStyle': pd['doorStyle'],
            'golaColor': pd['golaColor'],
            'handlePos': pd['handlePos'],
            'carcassColor': pd['carcassColor'],
            'frontColor': pd['frontColor'],
            'frontMaterial': pd['frontFinish'],
            'frontMaterialCode': None,
            'frontMaterialName': None,
            'frontTextureUrl': None,
            'frontMaterialThickness': pd['frontMaterialThickness'],
            'drawerSystem': pd['drawerSystem'],
            'drawerBoxConstruction': pd['drawerBoxConstruction'],
            'zonePreset': None,
            'skirtingSides': ['front'],
            'skirtingMaterial': pd['skirtingMaterial'],
            'baseHeight': BASE_HEIGHT,
            'elevation': 0,
        }

    def add_cabinet(self, code, center, width, depth, rotation, category, subtype, height, elevation=0, **extra):
        c = self.to_planner(center)
        cab = {'id': self.next_id, 'label': f'{code} {subtype} {round(width)}'}
        cab.update(self.base_fields(category, subtype))
        cab.update({
            'width': _r(width), 'depth': _r(depth), 'height': _r(height),
            'x': _r(c[0] - width / 2), 'y': _r(c[1] - depth / 2),
            'rotation': rotation, 'elevation': _r(elevation),
        })
        if category == 'wall':
            cab['wallHeight'] = _r(height)
        if subtype == 'Side Panel':
            cab['panelThickness'] = _r(width)
        if category == 'wall' or elevation > 0:
            cab['skirtingSides'] = []
        cab['importCode'] = code
        cab.update(extra)
        self.next_id += 1
        self.cabinets.append(cab)
        self.report['mapped'].append(f'{code} -> {category}/{subtype} {round(width)}x{round(height)}x{round(depth)} @elev {round(elevation)} rot {rotation}')
        return cab

    def on_wall(self, code, w, along_from, width, depth, facing, category, subtype, height, elevation=0, **extra):
        n = w['n']
        if facing is not None and FACING[facing] != n:
            self.warn(f'{code}: facing {facing} does not point into the room from {w["id"]}; using the wall normal')
        start = self.face_point(w, along_from)
        center = _add(_add(start, _mul(w['u'], width / 2)), _mul(n, depth / 2))
        return self.add_cabinet(code, center, width, depth, self.rotation_for(n), category, subtype, height, elevation, **extra)

    def blind_side(self, cab, center, blind_range):
        r = math.radians(cab['rotation'])
        local_x = (math.cos(r), math.sin(r))
        bc = self.to_planner(blind_range)
        cc = self.to_planner(center)
        return 'left' if _dot(_sub(bc, cc), local_x) < 0 else 'right'

    def convert_openings(self):
        for o in self.layout.get('openings', []):
            w = self.wall(o['wall'])
            along = o['offset'] + o['width'] / 2
            pt = _add(self.face_point(w, along), _mul(w['n'], -self.half_t))
            self.add_element(o['type'], pt, w, width=o['width'], height=o.get('height'), elevation=o.get('sill', 0) if o['type'] == 'window' else 0)
            if o.get('verify'):
                self.warn(f'{o["type"]} on {o["wall"]}: verify {", ".join(o["verify"])} on site')
        for s in self.layout.get('services', []):
            w = self.wall(s['wall'])
            pt = _add(self.face_point(w, s['offset']), _mul(w['n'], -self.half_t))
            self.add_element(s['type'], pt, w, elevation=s.get('elevation', 0))

    def add_element(self, etype, pt, w, width=None, height=None, elevation=0):
        if etype not in ROOM_ELEMENTS:
            self.report['skipped'].append(f'element type "{etype}" not supported')
            return
        base = ROOM_ELEMENTS[etype]
        p = self.to_planner(pt)
        el = {
            'id': 100000 + len(self.elements) + 1,
            'type': etype, 'label': base['label'], 'icon': base['icon'], 'color': base['color'],
            'w': width or base['w'], 'h': height or base['h'],
            'x': _r(p[0]), 'y': _r(p[1]), 'elevation': elevation,
            'wallAngle': _r(w['angle']), 'wallThickness': WALL_THICKNESS,
            'embeddedInWall': True, 'wallIndex': w['index'],
        }
        self.elements.append(el)

    def base_unit(self, u):
        t = u['type']
        code = u.get('code', t)
        if u.get('peninsula'):
            return self.peninsula_unit(u)
        w = self.wall(u['wall'])
        width, facing, frm = u['width'], u.get('facing'), u['from']
        d = self.base_depth
        if t == 'filler':
            return self.on_wall(code, w, frm, width, d, facing, 'accessories', 'Filler', BASE_HEIGHT)
        if t == 'base_drawers_3':
            fronts = u.get('drawer_fronts') or []
            self.warn(f'{code}: drawer fronts {fronts} not representable; 3D/BOM use 4 equal drawers, zonePreset set to nearest 3-drawer preset')
            return self.on_wall(code, w, frm, width, d, facing, 'base', 'Drawers', BASE_HEIGHT, zonePreset='2_small_1_big_drawer')
        if t == 'sink_base_2door':
            cab = self.on_wall(code, w, frm, width, d, facing, 'base', 'Sink', BASE_HEIGHT, doorCount=2)
            self.apply_sink(cab)
            spec = u.get('sink') or {}
            centre = frm + width / 2
            self.report['checks']['sink_centre'] = centre
            if 'centre_y' in spec and abs(spec['centre_y'] - centre) > 1:
                self.warn(f'{code}: sink centre {centre} != declared {spec["centre_y"]}')
            return cab
        if t == 'dishwasher_integrated':
            self.warn(f'{code}: no integrated dishwasher subtype; mapped to Freestanding Dishwasher (no matching door front)')
            return self.on_wall(code, w, frm, width, d, facing, 'accessories', 'Freestanding Dishwasher', BASE_HEIGHT)
        if t == 'base_pullout':
            self.warn(f'{code}: no pull-out subtype; mapped to Standard {width} with 1 hinged door')
            return self.on_wall(code, w, frm, width, d, facing, 'base', 'Standard', BASE_HEIGHT, doorCount=1)
        if t == 'base_hob_oven':
            cab = self.on_wall(code, w, frm, width, d, facing, 'base', 'Hob + Oven', BASE_HEIGHT)
            self.report['checks']['hob_centre'] = frm + width / 2
            return cab
        if t == 'base_blind_corner':
            cab = self.on_wall(code, w, frm, width, d, facing, 'corner', 'Blind', BASE_HEIGHT)
            self.check_blind(code, u)
            m = re.search(r'([xy])\s*=\s*(-?\d+)\.\.(-?\d+)', u.get('blind_side', ''))
            axis = 0 if m and m.group(1) == 'x' else 1
            if m and abs(w['u'][axis]) > 1e-9:
                mid = (int(m.group(2)) + int(m.group(3))) / 2
                along = (mid - w['from'][axis]) / w['u'][axis]
                bp = _add(self.face_point(w, along), _mul(w['n'], d / 2))
                cab['blindSide'] = self.blind_side(cab, self.cab_center_design(cab), bp)
            else:
                cab['blindSide'] = 'right' if 'right' in u.get('blind_side', '') else 'left'
            return cab
        self.report['skipped'].append(f'{code}: base type "{t}" has no catalog mapping')

    def cab_center_design(self, cab):
        px = cab['x'] + cab['width'] / 2
        py = cab['y'] + cab['depth'] / 2
        return (px - self.ox, py - self.oy)

    def check_blind(self, code, u):
        blind = None
        m = re.search(r'([xy])\s*=\s*(-?\d+)\.\.(-?\d+)', u.get('blind_side', ''))
        if m:
            blind = abs(int(m.group(3)) - int(m.group(2)))
        if 'blind_y' in u:
            blind = abs(u['blind_y'][1] - u['blind_y'][0])
        if 'blind_x' in u:
            blind = abs(u['blind_x'][1] - u['blind_x'][0])
        filler = u.get('filler', 0)
        if 'filler_y' in u:
            filler = abs(u['filler_y'][1] - u['filler_y'][0])
        if blind is not None and blind + filler != BLIND_PANEL_WIDTH:
            self.warn(f'{code}: blind {blind} + filler {filler} != planner BLIND_PANEL_WIDTH {BLIND_PANEL_WIDTH}')

    def rect_center(self, u):
        if 'x' in u and 'y' in u:
            return ((u['x'][0] + u['x'][1]) / 2, (u['y'][0] + u['y'][1]) / 2), abs(u['x'][1] - u['x'][0]), abs(u['y'][1] - u['y'][0])
        raise LayoutError(f'{u.get("code")}: peninsula unit needs x and y ranges')

    def peninsula_unit(self, u):
        t = u['type']
        code = u.get('code', t)
        if t == 'finished_back_panel':
            th = u.get('thickness', FRONT_THICKNESS)
            f = FACING[u.get('face', '+x')]
            if 'at_x' in u:
                x0 = u['at_x'] if f[0] > 0 else u['at_x'] - th
                u = dict(u, x=[x0, x0 + th])
            else:
                y0 = u['at_y'] if f[1] > 0 else u['at_y'] - th
                u = dict(u, y=[y0, y0 + th])
        c, sx, sy = self.rect_center(u)
        if t in ('end_panel', 'finished_back_panel'):
            thick_along_x = sx <= sy
            width, depth = (sx, sy) if thick_along_x else (sy, sx)
            rot = 0 if thick_along_x else 90
            height = LEG_HEIGHT + BASE_HEIGHT if u.get('full_height_to_floor', True) else BASE_HEIGHT
            return self.add_cabinet(code, c, width, depth, rot, 'accessories', 'Side Panel', height)
        facing = FACING[u['facing']]
        rot = self.rotation_for(facing)
        along_x = facing[0] == 0
        width = sx if along_x else sy
        span = sy if along_x else sx
        depth = min(span, self.base_depth)
        c = _add(c, _mul(facing, -(span - depth) / 2))
        if t == 'base_blind_corner':
            cab = self.add_cabinet(code, c, width, depth, rot, 'corner', 'Blind', BASE_HEIGHT)
            self.check_blind(code, u)
            if 'blind_y' in u:
                bp = (c[0], sum(u['blind_y']) / 2)
            elif 'blind_x' in u:
                bp = (sum(u['blind_x']) / 2, c[1])
            else:
                bp = None
            cab['blindSide'] = self.blind_side(cab, c, bp) if bp else 'left'
            return cab
        self.report['skipped'].append(f'{code}: peninsula type "{t}" has no catalog mapping')

    def wall_unit(self, u):
        t = u['type']
        code = u.get('code', t)
        w = self.wall(u['wall'])
        d = u.get('depth', self.defaults.get('depth', 350))
        bottom = u.get('bottom', self.defaults.get('bottom', 1500))
        body = u.get('body', self.defaults.get('body', 900))
        top = u.get('top_box', self.defaults.get('top_box', 0))
        frm, width, facing = u['from'], u['width'], u.get('facing')
        if t == 'wall_unit':
            self.on_wall(code, w, frm, width, d, facing, 'wall', 'Standard', body, bottom)
            if top:
                self.on_wall(f'{code}-TOP', w, frm, width, d, facing, 'wall', 'Standard', top, bottom + body)
            ep = u.get('end_panel')
            if ep:
                th = ep.get('thickness', FRONT_THICKNESS)
                at = self.along_of(w, ep)
                start = at if at >= frm + width - 1 else at - th
                self.on_wall(f'{code}-EP', w, start, th, d + FRONT_THICKNESS + 3, None, 'accessories', 'Side Panel', body + top, bottom)
            return
        if t == 'wall_blind_corner':
            blind, filler = u.get('blind', 350), u.get('filler', 50)
            doors = u.get('doors') or [width - blind - filler]
            dw = sum(doors)
            if blind + filler + dw != width:
                self.warn(f'{code}: blind {blind} + filler {filler} + doors {doors} != width {width}')
            self.warn(f'{code}: no wall blind corner; built as Filler {filler} + Standard {dw} ({len(doors)} doors), {blind} corner left empty')
            self.on_wall(f'{code}-F', w, frm + blind, filler, d, facing, 'accessories', 'Filler', body + top, bottom)
            self.on_wall(code, w, frm + blind + filler, dw, d, facing, 'wall', 'Standard', body, bottom, doorCount=len(doors))
            if top:
                self.on_wall(f'{code}-TOP', w, frm + blind + filler, dw, d, facing, 'wall', 'Standard', top, bottom + body)
            return
        if t == 'hood_housing':
            under = u.get('underside', bottom)
            self.warn(f'{code}: no hood housing; mapped to wall Appliance (hood render, excluded from BOM)')
            self.on_wall(code, w, frm, width, d, facing, 'wall', 'Appliance', bottom + body - under, under)
            if top:
                self.on_wall(f'{code}-TOP', w, frm, width, d, facing, 'wall', 'Standard', top, bottom + body)
            return
        self.report['skipped'].append(f'{code}: wall type "{t}" has no catalog mapping')

    def tall_unit(self, u):
        t = u['type']
        code = u.get('code', t)
        if t != 'fridge_housing_tall':
            self.report['skipped'].append(f'{code}: tall type "{t}" has no catalog mapping')
            return
        w = self.wall(u['wall'])
        frm, width, d, facing = u['from'], u['width'], u.get('depth', 600), u.get('facing')
        top_h = u.get('height_to', 2220)
        niche_w, niche_h = u.get('niche', [width - 40, top_h - 850])
        side = (width - niche_w) / 2
        box_h = u.get('top_box_height', top_h - niche_h)
        self.warn(f'{code}: no tall fridge housing; built as 2 tall Side Panels + Freestanding Fridge + wall Standard top box')
        self.on_wall(f'{code}-SL', w, frm, side, d, facing, 'accessories', 'Side Panel', top_h)
        self.on_wall(f'{code}-SR', w, frm + width - side, side, d, facing, 'accessories', 'Side Panel', top_h)
        self.on_wall(f'{code}-TOP', w, frm + side, niche_w, d, facing, 'wall', 'Standard', box_h, top_h - box_h)
        app = u.get('appliance') or {}
        aw, ad, ah = app.get('max', [niche_w - 40, d - 50, niche_h - 150])
        self.on_wall(f'{code}-FR', w, frm + side + (niche_w - aw) / 2, aw, ad, facing, 'accessories', 'Freestanding Fridge', ah)

    def worktops(self):
        for wt in self.layout.get('worktops', []):
            oh = wt.get('overhang')
            if not oh:
                continue
            xs = [p[0] for p in wt['polygon']]
            ys = [p[1] for p in wt['polygon']]
            f = FACING[oh['side']]
            dep = oh['depth']
            if f[0]:
                x0 = max(xs) - dep if f[0] > 0 else min(xs)
                c = (x0 + dep / 2, (min(ys) + max(ys)) / 2)
                width, depth, rot = max(ys) - min(ys), dep, self.rotation_for(f)
            else:
                y0 = max(ys) - dep if f[1] > 0 else min(ys)
                c = ((min(xs) + max(xs)) / 2, y0 + dep / 2)
                width, depth, rot = max(xs) - min(xs), dep, self.rotation_for(f)
            elev = LEG_HEIGHT + BASE_HEIGHT
            self.add_cabinet(f'{wt["id"]}-OH', c, width, depth, rot, 'accessories', 'Shelf', COUNTERTOP_THICKNESS, elev, carcassColor=COUNTERTOP_COLOR)
            self.warn(f'{wt["id"]}: {dep} overhang faked with a Shelf at {elev} (carcass colour set to worktop colour, not worktop material)')
        self.report['warnings'].append('worktop polygons ignored: planner draws one countertop per base cabinet (W+40, D+40 front overhang)')

    def apply_sink(self, cab):
        s = self.sink
        if not s:
            self.warn(f'{cab["importCode"]}: no catalog sink linked; pass --sink-id to attach one')
            return
        cab.update({
            'sinkId': s['id'], 'sinkBrand': s['brand'], 'sinkModel': s['model_name'],
            'sinkMaterial': s['material'], 'sinkColor': s['color'], 'sinkColorHex': s['color_hex'],
            'sinkCavityCount': s['cavity_count'], 'sinkWidthMm': s['width_mm'], 'sinkDepthMm': s['depth_mm'],
            'sinkBowlDepthMm': s['bowl_depth_mm'], 'sinkCutoutWidthMm': s['cutout_width_mm'],
            'sinkCutoutDepthMm': s['cutout_depth_mm'], 'sinkPrice': s['price'],
            'sinkRoughness': s['roughness'], 'sinkMetalness': s['metalness'],
        })

    def run_checks(self):
        checks = self.report['checks']
        for wid in self.wall_order:
            w = self.walls[wid]
            got = planner_inner_length(self.planner_walls, w['index'])
            want = w['spec'].get('inner_length')
            checks[f'wall_{wid}_inner'] = got
            if want is not None and got != want:
                self.warn(f'{wid}: planner inner length {got} != {want}')
        for o in self.layout.get('openings', []):
            if o['type'] == 'window':
                checks['window_centre'] = o['offset'] + o['width'] / 2
        for s in self.layout.get('services', []):
            if s['type'] == 'gas':
                checks['gas_offset'] = s['offset']
        if 'sink_centre' in checks and 'window_centre' in checks and checks['sink_centre'] != checks['window_centre']:
            self.warn(f'sink centre {checks["sink_centre"]} != window centre {checks["window_centre"]}')
        if 'hob_centre' in checks and 'gas_offset' in checks and checks['hob_centre'] != checks['gas_offset']:
            self.warn(f'hob centre {checks["hob_centre"]} != gas {checks["gas_offset"]}')
        collisions = find_collisions(self.cabinets, self.planner_walls)
        checks['collisions'] = collisions
        for a, b in collisions:
            self.warn(f'collision: {a} x {b}')
        for k, v in (self.layout.get('checks') or {}).items():
            checks.setdefault(f'declared_{k}', v)

    def convert(self):
        self.convert_openings()
        for u in self.layout.get('base_units', []):
            self.base_unit(u)
        for u in self.layout.get('tall_units', []):
            self.tall_unit(u)
        for u in self.layout.get('wall_units', []):
            self.wall_unit(u)
        self.worktops()
        for item in self.layout.get('loose_items', []):
            self.report['skipped'].append(f'loose item "{item.get("type")}" not in catalog')
        self.run_checks()
        xs = [p for w in self.planner_walls for p in (w['x1'], w['x2'])]
        ys = [p for w in self.planner_walls for p in (w['y1'], w['y2'])]
        room = {
            'width': round((max(xs) - min(xs)) / SCALE),
            'depth': round((max(ys) - min(ys)) / SCALE),
            'ceilingHeight': (self.layout.get('room') or {}).get('ceiling', 2800),
        }
        return {
            'room': room,
            'walls': self.planner_walls,
            'elements': self.elements,
            'cabinets': self.cabinets,
            'projectName': self.layout.get('name', 'Imported layout'),
            'baseHeight': BASE_HEIGHT,
            'projectDefaults': dict(PROJECT_DEFAULTS),
            'grandTotal': 0,
            'countertopThickness': COUNTERTOP_THICKNESS,
            'backsplashSegments': [],
            'backsplashHeight': 50,
            'backsplashThickness': 20,
        }


def planner_inner_length(walls, i):
    w = walls[i]
    half = WALL_THICKNESS * SCALE / 2
    raw = math.hypot(w['x2'] - w['x1'], w['y2'] - w['y1'])

    def offset(end):
        vx, vy = (w['x1'], w['y1']) if end == 'start' else (w['x2'], w['y2'])
        own_far = (w['x2'], w['y2']) if end == 'start' else (w['x1'], w['y1'])
        best, best_d = None, ENDPOINT_SNAP_PX
        for j, o in enumerate(walls):
            if j == i:
                continue
            for q in ((o['x1'], o['y1']), (o['x2'], o['y2'])):
                dd = math.hypot(vx - q[0], vy - q[1])
                if dd < best_d:
                    best_d, best = dd, o
        if best is None:
            return 0
        d1 = math.hypot(best['x1'] - vx, best['y1'] - vy)
        d2 = math.hypot(best['x2'] - vx, best['y2'] - vy)
        far = (best['x2'], best['y2']) if d1 <= d2 else (best['x1'], best['y1'])
        v1 = (own_far[0] - vx, own_far[1] - vy)
        v2 = (far[0] - vx, far[1] - vy)
        l1, l2 = math.hypot(*v1), math.hypot(*v2)
        cos = max(-1, min(1, _dot(v1, v2) / (l1 * l2)))
        tan_half = math.tan(math.acos(cos) / 2)
        return min(half * 20, l1 * 0.9) if tan_half < 0.01 else min(half / tan_half, l1 * 0.9)

    return max(0, round((raw - offset('start') - offset('end')) / SCALE))


def _cab_corners(c):
    x, y, w, h = c['x'], c['y'], c['width'], c['depth']
    cx, cy = x + w / 2, y + h / 2
    r = math.radians(c.get('rotation') or 0)
    cs, sn = math.cos(r), math.sin(r)
    return [(cx + (px - cx) * cs - (py - cy) * sn, cy + (px - cx) * sn + (py - cy) * cs) for px, py in ((x, y), (x + w, y), (x + w, y + h), (x, y + h))]


def _elev_range(c):
    if c.get('category') == 'wall' or (c.get('elevation') or 0) > 0:
        b = c.get('elevation') or 0
        return (b, b + (c.get('height') or 0))
    return (0, c.get('height') or 0)


def _wall_corners(w):
    x1, y1, x2, y2 = w['x1'] / SCALE, w['y1'] / SCALE, w['x2'] / SCALE, w['y2'] / SCALE
    ux, uy = _unit((x2 - x1, y2 - y1))
    nx, ny = -uy, ux
    h = WALL_THICKNESS / 2
    ex1, ey1, ex2, ey2 = x1 - ux * h, y1 - uy * h, x2 + ux * h, y2 + uy * h
    return [(ex1 + nx * h, ey1 + ny * h), (ex2 + nx * h, ey2 + ny * h), (ex2 - nx * h, ey2 - ny * h), (ex1 - nx * h, ey1 - ny * h)]


def _polys_intersect(a, b, eps=2):
    axes = []
    for poly in (a, b):
        for i in range(2):
            (x1, y1), (x2, y2) = poly[i], poly[i + 1]
            axes.append((-(y2 - y1), x2 - x1))
    for ax in axes:
        ln = math.hypot(*ax) or 1
        pa = [_dot(p, ax) for p in a]
        pb = [_dot(p, ax) for p in b]
        if not (min(pa) < max(pb) - eps * ln and min(pb) < max(pa) - eps * ln):
            return False
    return True


def find_collisions(cabinets, walls):
    out = []
    corners = [_cab_corners(c) for c in cabinets]
    elev = [_elev_range(c) for c in cabinets]
    for i in range(len(cabinets)):
        for j in range(i + 1, len(cabinets)):
            if not (elev[i][0] < elev[j][1] and elev[j][0] < elev[i][1]):
                continue
            if _polys_intersect(corners[i], corners[j]):
                out.append((cabinets[i].get('label'), cabinets[j].get('label')))
    for wi, w in enumerate(walls):
        wc = _wall_corners(w)
        for i, c in enumerate(cabinets):
            if _polys_intersect(corners[i], wc):
                out.append((c.get('label'), f'wall {wi}'))
    return out


def layout_to_planner_data(layout, sink=None):
    conv = Converter(layout, sink=sink)
    data = conv.convert()
    return data, conv.report
