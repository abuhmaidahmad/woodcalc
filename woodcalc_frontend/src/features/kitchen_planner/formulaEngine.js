// formulaEngine.js
// Cabinet formula engine for WoodCalc
// Units: mm

const T = 18; // panel thickness mm
// Standard HDF back panel thickness (mm). The company sets its back panel on
// the Settings page -- a stock material (back_panel_material_sku, whose board
// thickness is used) or a plain thickness -- and it applies to every room's cut
// list; the bottom, top and shelf depths shrink/grow with it since they stop at
// the back's front face.
const BACK_T = 8;
export const BACK_PANEL_THICKNESS_OPTIONS = [3, 4, 5, 6, 8];

const positiveOr = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

let companyBack = { thickness: BACK_T, materialCode: null };
export function getCompanyBackPanel() {
  return companyBack;
}
export function setCompanyBackPanel({ thickness, materialCode } = {}) {
  companyBack = { thickness: positiveOr(thickness, BACK_T), materialCode: materialCode || null };
}

// Glass shelves: the company's glass material (Settings page, glass_shelf_material_sku)
// sets their thickness and price; without one they're 8mm tempered at the generic rate.
const GLASS_T = 8;
let companyGlass = { thickness: GLASS_T, materialCode: null };
export function getCompanyGlass() {
  return companyGlass;
}
export function setCompanyGlass({ thickness, materialCode } = {}) {
  companyGlass = { thickness: positiveOr(thickness, GLASS_T), materialCode: materialCode || null };
}
export function isGlassMaterial(m) {
  return m?.material_type === 'glass';
}

// Aluminium-framed glass doors (Glass Door cabinets): the company's door material
// (Settings page, glass_door_material_sku) prices them per m² of outer size.
let companyGlassDoor = { materialCode: null };
export function getCompanyGlassDoor() {
  return companyGlassDoor;
}
export function setCompanyGlassDoor({ materialCode } = {}) {
  companyGlassDoor = { materialCode: materialCode || null };
}
export function isGlassDoorMaterial(m) {
  return m?.material_type === 'glass_door';
}
export const isGlassDoorCabinet = (c) => c?.subtype === 'Glass Door';

// Cabinets whose shelves are glass (open boxes and glass-door cabinets); every
// other shelf-eligible cabinet gets 18mm wood shelves cut by calculateCabinet.
export const hasGlassShelves = (c) => isOpenBox(c) || isGlassDoorCabinet(c);

// Shelf spacing standard: shelves start ~300mm apart and can't be added closer
// than 250mm (clear gap between 18mm shelves, inside the 36mm of top + bottom).
const SHELF_STD_GAP = 300;
const SHELF_MIN_GAP = 250;
const shelvesForGap = (c, gap) => Math.max(0, Math.floor((c.height - 36 - gap) / (gap + T)));
export const maxShelvesFor = (c) => (isShelfEligible(c) ? shelvesForGap(c, SHELF_MIN_GAP) : 0);

// Shelves a cabinet gets: its own count, else the standard (4 in a tall cabinet,
// otherwise as many as the 300mm gap allows), never more than fit at 250mm.
export function shelfCountFor(c) {
  if (!isShelfEligible(c)) return 0;
  const standard = c.category === 'tall' ? 4 : shelvesForGap(c, SHELF_STD_GAP);
  return Math.min(c.shelfCount ?? c.glassShelfCount ?? standard, maxShelvesFor(c));
}

// The glass shelves one cabinet needs (open boxes and glass-door cabinets), or null.
// Single source for the master cut list, the proposal and the cutting optimizer.
export function glassShelfSpec(c) {
  if (!hasGlassShelves(c)) return null;
  const qty = shelfCountFor(c);
  if (qty <= 0) return null;
  return {
    qty,
    width: Math.round(c.width - 40),
    // Shelves are 10mm shallower than the space in front of the back: an open
    // box's full-depth bottom less the gap and its 18mm board back, else the
    // glass-door cabinet's top/bottom depth.
    depth: Math.round(!isGlassDoorCabinet(c) ? c.depth - OPEN_BOX_BACK_GAP - T - 10
      : c.category === 'wall' ? c.depth - 20 - 10
      : c.depth - 30 - companyBack.thickness - 10),
    thickness: companyGlass.thickness,
    materialCode: companyGlass.materialCode,
  };
}

// Everything made to size by the glass suppliers for these cabinets: glass
// shelves and aluminium glass doors, merged by material + size + finish. Each
// item: { kind: 'shelf'|'door', materialCode, width, height, thickness?, qty,
// description }. Doors are sent at their outer size -- the supplier works out
// the glass inside the profile.
export function glassOrderItems(cabinets) {
  const merged = new Map();
  const add = (item) => {
    const key = [item.kind, item.materialCode, item.width, item.height, item.description].join('|');
    if (merged.has(key)) merged.get(key).qty += item.qty;
    else merged.set(key, { ...item });
  };
  cabinets.forEach(c => {
    if (!isCarcassCabinet(c)) return;
    const shelf = glassShelfSpec(c);
    if (shelf) {
      add({ kind: 'shelf', materialCode: shelf.materialCode, width: shelf.width, height: shelf.depth,
        thickness: shelf.thickness, qty: shelf.qty, description: `Glass shelf ${shelf.thickness}mm tempered` });
    }
    if (isGlassDoorCabinet(c)) {
      let result;
      try { result = calculateCabinet(cabinetConfig(c)); } catch { return; }
      const finish = `${c.frameColor || 'black'} frame, ${c.glassType || 'clear'} glass`;
      result.doors.filter(d => d.glassDoor).forEach(d => add({
        kind: 'door', materialCode: companyGlassDoor.materialCode, width: d.width, height: d.height,
        qty: 1, description: `Aluminium glass door, ${finish}`,
      }));
    }
  });
  return Array.from(merged.values());
}

// Materials that can be a back panel: the catalog's 'back' type, or any HDF board.
export function isBackPanelMaterial(m) {
  return m?.material_type === 'back' || m?.core_material === 'hdf';
}

// The back panel every cabinet is cut with: the company standard set on the
// Settings page -- there's no per-cabinet choice. materialCode is the stock SKU
// it's priced at and cut from (null = generic HDF rate). Open boxes (board back)
// and sink cabinets (no back) have their own fixed rules in calculateCabinet.
export function resolveBackPanel() {
  return { ...companyBack };
}

// The HDF back (main carcass back or a stepped filler's) -- tagged by kind, not
// matched by thickness, since the thickness is configurable. An open box's board
// back and the 'Back rail' are 18mm carcass board, so they don't match.
export function isBackPanel(p) {
  return p.kind === 'hdf_back';
}
const CONFIRMAT = '7x50mm';
const EDGE_BANDING = '1mm ABS';
// Gola milled channel/reveal height (mm) -- matches GOLA_CH in KitchenPlanner3D.jsx.
const GOLA_CHANNEL_MM = 25;
// A Gola front sitting under a channel is cut this much short in total (the 25mm
// channel plus clearance) -- same 30mm for doors and drawer fronts.
const GOLA_FRONT_REDUCTION_MM = 30;
export const BLIND_PANEL_WIDTH = 650; // mm — fixed hidden section behind adjoining cabinet
const BLIND_STILE_DEPTH = 75;

// Adjustable-shelf feature: base/wall/tall/corner cabinets get it, EXCEPT drawer-based fronts,
// sink cabinets, and anything in vanity/specialty/accessories (those aren't real shelf-and-door boxes).
export function isShelfEligible(cab) {
  if (['vanity', 'specialty', 'accessories'].includes(cab.category)) return false;
  if (['Drawers', '2Drw+Door', 'Sink', 'Double Sink', 'Hob + Oven'].includes(cab.subtype)) return false;
  if (['Filler', 'Panel', 'Toe Kick', 'Side Panel', 'Top Panel'].includes(cab.subtype)) return false;
  // The oven(s) occupy the cavity — no room for adjustable shelves.
  if (['Oven Tower', 'Double Oven'].includes(cab.subtype)) return false;
  return ['base', 'wall', 'tall', 'corner'].includes(cab.category);
}

// Subtypes with no manufactured carcass at all: simple flat pieces (Filler/Panel/Toe
// Kick/Shelf/Open Shelf, one board cut at its own dimensions) or purchased appliances
// (Fridge/.../Freestanding *) that WoodCalc doesn't manufacture or sell — they're
// placed for design/space-planning only. `isCarcassCabinet()` is the single gate for
// "does this cabinet get panels/doors run through calculateCabinet()", used by both
// the cut list and the cost proposal so they never disagree on what's real.
// Oven Tower / Double Oven are NOT purchased whole units — they're a fabricated
// carcass (sides/bottom/top/back, priced and cut like any tall cabinet) that just
// houses a purchased oven, so they're excluded from this list but stay in
// APPLIANCE_SUBTYPES below (the oven unit itself still isn't a manufactured part).
// 'Open Shelf' (the open box) is NOT here: it's a real box cut by
// calculateCabinet's open-box branch (see openBoxPanels).
export const NON_CARCASS_SUBTYPES = ['Filler', 'Panel', 'Toe Kick', 'Shelf', 'Fridge', 'Appliance'];
// A Double Oven's lower oven sits this far off the cabinet bottom (not at countertop
// height like a single Oven Tower) so the stacked pair stays within reach and leaves
// a usable door above. Shared with OvenTowerAppliance in KitchenPlanner3D.jsx.
export const DOUBLE_OVEN_BOTTOM = 450;
export const APPLIANCE_SUBTYPES = ['Fridge', 'Oven Tower', 'Double Oven', 'Appliance', 'Freestanding Oven', 'Freestanding Fridge', 'Freestanding Dishwasher', 'Freestanding Hood'];

export function isCarcassCabinet(c) {
  return !NON_CARCASS_SUBTYPES.includes(c.subtype) && c.category !== 'accessories';
}

// Dimensions for a non-carcass flat piece (Filler/Panel/Toe Kick/Shelf/Open Shelf) —
// one board cut at its own size, no box formula. Matches the master cut list's piece
// entry exactly, so the cost proposal never charges for a size it wouldn't actually cut.
// Side Panel is depth-oriented (a vertical infill against a wall); Top Panel is the
// same board laid flat (length x depth, its Height being the board thickness);
// everything else in this bucket is width-oriented (a horizontal strip/board).
export function nonCarcassPieceDims(c) {
  if (c.subtype === 'Top Panel') {
    return { width: c.width, depth: c.depth || 321, thickness: c.panelThickness || c.height || 18 };
  }
  const isPanel = c.subtype === 'Side Panel';
  return {
    width: c.height,
    depth: isPanel ? (c.depth || 581) : c.width,
    thickness: isPanel ? (c.panelThickness || c.frontMaterialThickness || 18) : 18,
  };
}

// A Filler is just an 18mm board with nothing solid behind it to screw into, so
// it's backed by an L-shaped cleat cut from carcass material: one leg screws to
// the adjoining cabinet's side, the filler face then screws to the other. 3mm
// short of the filler's own height so it never telegraphs past the filler's top
// or bottom edge. Shared by the master cut list and the cost proposal so they
// never disagree on what's actually cut.
export function fillerCleatDims(c) {
  return { width: Math.max(0, c.height - 3), depth: 100, thickness: 18 };
}

// Builds the calculateCabinet() input from a saved cabinet object — shared by the
// cut list and the cost proposal so a subtype's door/drawer rules (Blind's narrow
// door, Hob + Oven's no-wood-door front, drawer counts, etc.) price the same way
// they get cut.
export function cabinetConfig(c) {
  return {
    width: c.width, height: c.height, depth: c.depth,
    material: c.material, doorStyle: c.doorStyle,
    shelves: hasGlassShelves(c) ? 0 : shelfCountFor(c),
    cabinetType: c.category,
    doorCount: c.doorCount,
    subtype: c.subtype,
    zonePreset: resolveZonePreset(c),
    drawerType: c.drawerType,
    drawerSystem: c.drawerSystem,
    drawerBoxConstruction: c.drawerBoxConstruction,
    baseHeight: c.baseHeight,
    openBoxMaterialSource: c.openBoxMaterialSource,
  };
}

// Detects where two floor-standing cabinets meet at a 90°/270° outer corner (e.g. an L-shaped
// run turning after a blind corner cabinet). hasNeighbor()-style same-row checks in the 3D
// renderer only cover straight runs (same rotation); this covers the perpendicular case so both
// the BOM elbow count and the 3D skirting render agree on where corner joints actually are.
export function detectCornerJoins(cabinets) {
  const TOL = 15; // mm tolerance for "touching" corners
  const corners = (cab) => {
    const x = cab.x, y = cab.y, w = cab.width, h = cab.depth;
    const cx = x + w / 2, cy = y + h / 2;
    const rad = ((cab.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) => [
      cx + (px - cx) * cos - (py - cy) * sin,
      cy + (px - cx) * sin + (py - cy) * cos,
    ]);
  };
  const joins = [];
  for (let i = 0; i < cabinets.length; i++) {
    for (let j = i + 1; j < cabinets.length; j++) {
      const a = cabinets[i], b = cabinets[j];
      const rotDiff = (((a.rotation || 0) - (b.rotation || 0)) % 360 + 360) % 360;
      if (rotDiff !== 90 && rotDiff !== 270) continue;
      const cornersA = corners(a), cornersB = corners(b);
      let touch = null;
      outer: for (const pa of cornersA) {
        for (const pb of cornersB) {
          if (Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) <= TOL) { touch = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2]; break outer; }
        }
      }
      if (touch) joins.push({ aId: a.id, bId: b.id, x: touch[0], y: touch[1] });
    }
  }
  return joins;
}

function round2(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export function getDefaultDoorCount(width) {
  if (width < 600) return 1;
  if (width === 600) return 1;
  return 2;
}

export function getHingeCount(doorHeight) {
  if (doorHeight <= 900) return 2;
  if (doorHeight <= 1400) return 3;
  if (doorHeight <= 1800) return 4;
  return 4;
}

// Interior-layout presets for Drawers/2Drw+Door cabinets -- single source of truth
// shared by the picker UI, the 3D render, and the BOM/cost engine so they never
// disagree on what a given layout actually looks like. Zones are listed TOP-to-
// BOTTOM (zones[0] is the topmost front) -- e.g. '2_small_1_door' puts 2 drawers
// above 1 door, matching the "2Drw+Door" subtype's own name/real cabinet convention.
export function buildZonePresets(height) {
  const h = height >= 780 ? 800 : 720;
  const small = h === 800 ? 200 : 180;
  const big = h === 800 ? 400 : 360;
  const huge = h;
  const doorBig = h === 800 ? 600 : 540;
  const doorSmall = big;

  return [
    { id: '1_big_drawer', labelKey: 'zonePresetPicker.preset1BigDrawer', zones: [{ type: 'drawer', h: huge }] },
    { id: '2_drawers', labelKey: 'zonePresetPicker.preset2Drawers', zones: [{ type: 'drawer', h: big }, { type: 'drawer', h: big }] },
    { id: '4_drawers', labelKey: 'zonePresetPicker.preset4Drawers', zones: [{ type: 'drawer', h: small }, { type: 'drawer', h: small }, { type: 'drawer', h: small }, { type: 'drawer', h: small }] },
    { id: '2_small_1_big_drawer', labelKey: 'zonePresetPicker.preset2Small1BigDrawer', zones: [{ type: 'drawer', h: small }, { type: 'drawer', h: small }, { type: 'drawer', h: big }] },
    { id: '1_small_drawer_1_door', labelKey: 'zonePresetPicker.preset1SmallDrawer1Door', zones: [{ type: 'drawer', h: small }, { type: 'door', h: doorBig }], doorCount: 1 },
    { id: '1_small_drawer_2_doors', labelKey: 'zonePresetPicker.preset1SmallDrawer2Doors', zones: [{ type: 'drawer', h: small }, { type: 'door', h: doorBig }], doorCount: 2 },
    { id: '2_small_1_door', labelKey: 'zonePresetPicker.preset2Small1Door', zones: [{ type: 'drawer', h: small }, { type: 'drawer', h: small }, { type: 'door', h: doorSmall }], doorCount: 1 },
  ];
}

// A Gola C-channel sits between two adjacent zones so you can hook a finger under
// the front below it and pull it open (the topmost zone instead opens via the
// carcass's own shared L-channel, so index 0 never gets one here). Two small
// drawers stacked back-to-back are the one exception: the lower small drawer
// already opens fine from the channel below it (shared with the bigger drawer
// beneath, e.g. '2_small_1_big_drawer'), so a channel between the two smalls
// would just be a second, redundant pull point for the same front -- skip it.
export function golaNeedsChannelAbove(zones, i) {
  if (i <= 0) return false;
  const prev = zones[i - 1], cur = zones[i], next = zones[i + 1];
  const isRedundantSmallPair = prev?.type === 'drawer' && cur?.type === 'drawer'
    && next?.type === 'drawer' && cur.h === prev.h && next.h > cur.h;
  return !isRedundantSmallPair;
}

// mm eaten from the top of zone i's slot by whatever sits directly above it: the
// topmost zone always sits below the carcass's shared L-channel (25mm); every
// other zone gets the same 25mm C-channel gap only when golaNeedsChannelAbove
// says it needs its own pull point -- otherwise there's no milled channel there
// at all, so the fronts stack on a normal reveal instead (handled by the generic
// +3mm edge clearance applied at every call site, same as a non-Gola front).
export function golaChannelGapMm(zones, i) {
  if (i === 0) return GOLA_CHANNEL_MM;
  return golaNeedsChannelAbove(zones, i) ? GOLA_CHANNEL_MM : 0;
}

const DEFAULT_ZONE_PRESET_ID = { Drawers: '4_drawers', '2Drw+Door': '2_small_1_door' };

// Resolves a cabinet's actual interior layout: whatever the user picked, or a
// sensible per-subtype default for cabinets placed before this feature existed
// (or that were never touched in the picker). Returns null for non-drawer subtypes.
export function resolveZonePreset(c) {
  if (!['Drawers', '2Drw+Door'].includes(c.subtype)) return null;
  if (c.zonePreset && Array.isArray(c.zonePreset.zones) && c.zonePreset.zones.length > 0) return c.zonePreset;
  const presets = buildZonePresets(c.height);
  return presets.find(p => p.id === DEFAULT_ZONE_PRESET_ID[c.subtype]) || presets[0];
}

function chooseToeKickAndLegs(height) {
  let toeKickH, legH, preset;
  if (Math.abs(height - 720) <= Math.abs(height - 800)) {
    toeKickH = 150;
    legH = 150;
    preset = 'H720';
  } else {
    toeKickH = 80;
    legH = 80;
    preset = 'H800';
  }
  if (height === 720) { toeKickH = 150; legH = 150; preset = 'H720'; }
  if (height === 800) { toeKickH = 80; legH = 80; preset = 'H800'; }
  return { toeKickH, legH, preset };
}

// Tall cabinets stand on the same legs a base run does, sized off the
// project's base height setting -- matches the Cabinet component's own
// showLegs/legH logic in KitchenPlanner3D.jsx exactly, so a stair's
// floor-referenced clearance and the cabinet's own H field convert the same
// way in both the 3D view and the BOM.
export function getTallLegHeightMm(cab) {
  return cab.baseHeight === 720 ? 150 : 80;
}

// Turns a stair's absolute (floor-referenced) top_profile (stairGeometry.js's
// computeStairTopProfile) into an actual carcass height for this cabinet:
// effectiveH is the tallest uniform height that clears every constrained
// segment, and each segment's own availableH is how tall a stepped filler
// above that uniform body could go before it would hit the stair. Never
// exceeds the cabinet's own designed height -- a stepped top only gives back
// room the stair allows, it doesn't grow the unit beyond what was designed.
export function resolveSteppedCabinetProfile(cab, stairProfile, minHeightMm = 300) {
  const nominalH = cab.height;
  const legHmm = getTallLegHeightMm(cab);
  const segments = stairProfile.segments.map(seg => {
    const availableH = seg.capHeight == null
      ? nominalH
      : Math.min(nominalH, Math.max(0, seg.capHeight - legHmm));
    return { x0: seg.x0, x1: seg.x1, availableH };
  });
  const effectiveH = Math.max(minHeightMm, Math.min(nominalH, ...segments.map(s => s.availableH)));
  return { nominalH, effectiveH, legHmm, segments };
}

// Extra sheet-good pieces for one stepped-top filler block sitting on top of
// the (shorter, uniform) main carcass, filling the gap up to what that
// segment's own stair clearance allows. Closed box, no door -- the filler is
// bonus storage above the unit's normal front, not a redesigned zone.
export function stairFillerPanels(seg, effectiveH, depth, back = resolveBackPanel()) {
  const fillerH = round2(seg.availableH - effectiveH);
  if (fillerH <= 1) return [];
  const w = round2(seg.x1 - seg.x0);
  const innerDepth = round2(depth - 30 - back.thickness);
  return [
    { name: 'Stepped filler side panel', qty: 2, width: fillerH, depth, thickness: T, notes: 'Follows stair above' },
    { name: 'Stepped filler top panel', qty: 1, width: w, depth: innerDepth, thickness: T, notes: 'Follows stair above' },
    { name: 'Stepped filler bottom panel', qty: 1, width: w, depth: innerDepth, thickness: T, notes: 'Follows stair above' },
    { name: 'Stepped filler back panel', qty: 1, width: w, depth: fillerH, thickness: back.thickness, kind: 'hdf_back', materialCode: back.materialCode, notes: 'Follows stair above' },
  ];
}

export const isOpenBox = (c) => c?.subtype === 'Open Shelf';

// Which board a carcass panel is cut from: 'back' (the HDF back, its own stock
// material), 'front' (fixed front panels, or an open box whose Box Color is the
// front material) or 'carcass'.
export function panelFace(p) {
  if (isBackPanel(p)) return 'back';
  if (p.faceMaterial === 'front' || p.name.includes('Front panel')) return 'front';
  return 'carcass';
}

// An open box is on show inside and out, so every piece -- back included -- is
// the same board as the box (carcass, or the front material when the cabinet's
// Box Color is set to front). No grooves: the top and bottom run the full depth
// between the sides, and the back sits between the sides and between the top and
// bottom, set OPEN_BOX_BACK_GAP in from their rear edge. Front edges of
// sides/top/bottom are banded.
export const OPEN_BOX_BACK_GAP = 18;
export function openBoxPanels(W, H, D, faceMaterial) {
  const innerW = round2(W - 2 * T);
  const piece = (p) => ({ thickness: T, faceMaterial, ...p });
  return [
    piece({ name: 'Side panel', qty: 2, width: H, depth: D, edgeFront: true, notes: 'Open box side' }),
    piece({ name: 'Top panel', qty: 1, width: innerW, depth: D, edgeFront: true, notes: '(W - 2T) × D, between sides' }),
    piece({ name: 'Bottom panel', qty: 1, width: innerW, depth: D, edgeFront: true, notes: '(W - 2T) × D, between sides' }),
    piece({ name: 'Back panel (box board)', qty: 1, width: innerW, depth: round2(H - 2 * T), notes: `(W - 2T) × (H - 2T), between sides and top/bottom, ${OPEN_BOX_BACK_GAP}mm in from the rear, no groove` }),
  ];
}

// Edge banding per part side, R being the part's front edge. Any carcass edge
// that sits directly behind a door/drawer front when the cabinet is closed is
// banded in the front's own color, so opening the front shows a carcass edge
// that matches it. Push cabinets additionally band the sides' top/bottom
// edges in carcass color.
export function getEdgeBanding(partName, carcassColor, frontColor, carcassMat, frontMat, doorStyle) {
  const cc = carcassMat || carcassColor || 'Carcass'
  const fc = frontMat || frontColor || 'Front'
  const none = { T: 'None', B: 'None', L: 'None', R: 'None' }
  if (partName.includes('Back') || partName.includes('HDF')) return none
  if (partName.includes('Door') || partName.includes('Front panel') || partName.includes('Drawer front')) {
    return { T: fc, B: fc, L: fc, R: fc }
  }
  if (partName === 'Side panel') {
    return doorStyle === 'Push' ? { T: cc, B: cc, L: 'None', R: fc } : { ...none, R: fc }
  }
  if (['Top panel', 'Bottom panel', 'Front rail'].includes(partName)) return { ...none, R: fc }
  // A sink's bottom rail has its exposed long edge banded in carcass color.
  if (partName === 'Bottom rail') return { ...none, R: cc }
  // A blind stile's front edge shows beside the door; its back edge is carcass.
  if (partName === 'Blind stile') return { ...none, R: fc, L: cc }
  // Loose wood shelves are banded all round in carcass color.
  if (partName === 'Shelf (18mm)') return { T: cc, B: cc, L: cc, R: cc }
  if (partName.includes('Shelf') || partName.includes('Bottom')) {
    return { ...none, R: cc }
  }
  if (partName.includes('Toe')) return { ...none, T: cc }
  return none
}

// Edge banding for one calculateCabinet() panel. An open box has no fronts to
// match, so its sides/top/bottom (edgeFront) are banded in the box board itself.
export function panelEdgeBanding(p, carcassColor, frontColor, carcassMat, frontMat, doorStyle) {
  if (p.edgeFront) {
    const box = p.faceMaterial === 'front' ? (frontMat || frontColor || 'Front') : (carcassMat || carcassColor || 'Carcass')
    return { T: 'None', B: 'None', L: 'None', R: box }
  }
  return getEdgeBanding(p.name, carcassColor, frontColor, carcassMat, frontMat, doorStyle)
}

// Total banded length (mm) of a calculateCabinet() result. L/R run along a
// panel's width, T/B along its depth; doors/drawer fronts are banded all round
// (bought-in aluminium glass doors aren't banded).
export function edgeBandingLengthMm(result, doorStyle) {
  const panels = result.panels.reduce((sum, p) => {
    const eb = panelEdgeBanding(p, null, null, null, null, doorStyle)
    const len = ['L', 'R'].filter(k => eb[k] !== 'None').length * p.width
      + ['T', 'B'].filter(k => eb[k] !== 'None').length * p.depth
    return sum + len * p.qty
  }, 0)
  const fronts = [...result.doors.filter(d => !d.glassDoor), ...result.drawerFronts].reduce((s, d) => s + 2 * (d.width + d.height), 0)
  return panels + fronts
}

export function calculateCabinet(config) {
  const W = Number(config.width);
  const H = Number(config.height);
  const D = Number(config.depth);
  const material = (config.material || 'particleboard').toLowerCase();
  const doorStyle = (config.doorStyle || 'Handle');
  const requestedDoorCount = Number(config.doorCount || getDefaultDoorCount(W));
  const isOvenTower = config.subtype === 'Oven Tower' || config.subtype === 'Double Oven';
  // The oven(s) occupy the cavity — no adjustable shelves default for these.
  const openBox = isOpenBox(config);
  // Open boxes and glass-door cabinets get glass shelves instead (glassShelfSpec).
  const shelves = (openBox || isGlassDoorCabinet(config)) ? 0 : Number(config.shelves ?? (config.cabinetType === 'tall' && !isOvenTower ? 4 : 0));
  const drawerType = (config.drawerType || 'Wood Box');
  // Drawer runner system: 'LEGRABOX' (integrated box), 'Tandem' (runner + wood box),
  // 'Local Bearing' (runner + wood box), or any custom system name from the catalog.
  const drawerSystem = (config.drawerSystem || 'Local Bearing');
  // box_construction from DrawerSystem API drives the branch; regex only for legacy saved data
  const systemHasIntegratedBox = config.drawerBoxConstruction
    ? config.drawerBoxConstruction === 'metal_sided'
    : /legrabox|tandembox|integrated/i.test(drawerSystem);
  const isDrawerCab = config.subtype === 'Drawers' || config.subtype === '2Drw+Door';
  const cabinetType = config.cabinetType || config.category || 'base';
  const { thickness: backT, materialCode: backMaterialCode } = resolveBackPanel();

  // Wall and tall cabinets don't sit on the floor with a toe kick + legs
  const hasFloorBase = cabinetType === 'base';
  const { toeKickH, legH, preset } = hasFloorBase
    ? chooseToeKickAndLegs(H)
    : { toeKickH: 0, legH: 0, preset: cabinetType === 'wall' ? 'WALL' : 'TALL' };

  const bottomW = round2(W - 2 * T);
  // A Gola wall cabinet's finger pull is the door itself overhanging the carcass:
  // the door stays full height (H - 3) and the carcass is cut 25mm short instead.
  const isWallGola = cabinetType === 'wall' && doorStyle === 'Gola' && !openBox;
  const carcassH = isWallGola ? round2(H - GOLA_CHANNEL_MM) : H;
  const isSink = ['Sink', 'Single Sink', 'Double Sink'].includes(config.subtype);
  const hasBlindPanel = config.subtype === 'Blind' && cabinetType !== 'wall';
  // Wall cabinets (incl. glass-door ones): top and bottom are 20mm short of the
  // sides and the back sits right behind them, leaving (20 - back thickness) of
  // side free at the back. Other cabinets keep 30mm behind the back.
  const isWallCab = cabinetType === 'wall';
  const bottomD = isWallCab ? round2(D - 20) : round2(D - 30 - backT);
  const bottomFormula = isWallCab ? '(D - 20)' : `(D - 30 - ${backT})`;
  const panels = [];
  if (openBox) {
    panels.push(...openBoxPanels(W, H, D, config.openBoxMaterialSource === 'front' ? 'front' : 'carcass'));
  } else {
  panels.push({
    name: 'Side panel',
    qty: 2,
    width: carcassH,
    depth: D,
    thickness: T,
    notes: isWallGola ? `Vertical sides (H - ${GOLA_CHANNEL_MM}, Gola finger pull)` : 'Vertical sides',
  });

  panels.push({
    name: 'Bottom panel',
    qty: 1,
    width: bottomW,
    depth: bottomD,
    thickness: T,
    notes: `(W - 2T) × ${bottomFormula}`,
  });

  // Wall and tall cabinets (incl. pantry) don't get front/back rails —
  // they get a top panel matching the bottom panel instead. Base cabinets
  // keep rails (no top panel; countertop sits on top).
  const usesTopPanel = cabinetType === 'wall' || cabinetType === 'tall';
  if (usesTopPanel) {
    panels.push({
      name: 'Top panel',
      qty: 1,
      width: bottomW,
      depth: bottomD,
      thickness: T,
      notes: `(W - 2T) × ${bottomFormula}, same as bottom panel`,
    });
  } else {
    const railW = bottomW;
    panels.push({
      name: 'Front rail',
      qty: 1,
      width: railW,
      depth: 100,
      thickness: T,
      notes: 'Front rail',
    });
    panels.push({
      name: 'Back rail',
      qty: 1,
      width: railW,
      depth: 100,
      thickness: T,
      notes: 'Back rail',
    });
  }

  if (isSink) {
    // Sink cabinets are left open at the back for the plumbing -- no back at all,
    // just a rail standing at the back end of the bottom panel.
    panels.push({
      name: 'Bottom rail',
      qty: 1,
      width: bottomW,
      depth: 100,
      thickness: T,
      notes: 'Sink rail at back of bottom panel',
    });
  } else {
    const backW = round2(bottomW + 16);
    // The HDF back runs the carcass height less 2mm.
    const backH = round2(carcassH - 2);
    panels.push({
      name: 'Back panel (HDF)',
      qty: 1,
      width: backW,
      depth: backH,
      thickness: backT,
      kind: 'hdf_back',
      materialCode: backMaterialCode,
      notes: `${backT}mm HDF`,
    });
  }

  // A blind corner (base or tall) closes off its blind section with a board panel
  // across the front, backed at its door-side end by a doubled vertical stile the
  // door hinges mount on. The panel spans the blind section less the side and the
  // stile; both run H - 2T between the bottom and the rails/top panel, or H - 85
  // under a base unit's Gola channel (tall units have no top channel).
  if (hasBlindPanel) {
    const blindH = doorStyle === 'Gola' && cabinetType !== 'tall' ? round2(H - 85) : round2(H - 2 * T);
    panels.push({
      name: 'Blind panel',
      qty: 1,
      width: round2(BLIND_PANEL_WIDTH - 2 * T),
      depth: blindH,
      thickness: T,
      notes: 'Closes the blind section, no edge banding',
    });
    panels.push({
      name: 'Blind stile',
      qty: 2,
      width: blindH,
      depth: BLIND_STILE_DEPTH,
      thickness: T,
      notes: 'Doubled, at the door end of the blind panel; door hinges mount on it',
    });
  }

  }

  // 1mm narrower than the bottom panel so the shelf drops in between the sides.
  const shelfW = round2(bottomW - 1);
  // Shelves are 10mm shallower than the top/bottom panels; a blind corner's also
  // clear its 75mm blind stile.
  const shelfD = round2(bottomD - 10 - (hasBlindPanel ? BLIND_STILE_DEPTH : 0));
  if (shelves > 0) {
    panels.push({
      name: 'Shelf (18mm)',
      qty: shelves,
      width: shelfW,
      depth: shelfD,
      thickness: T,
      notes: 'Per shelf',
    });
  }

  // Gola doors sit under the 25mm milled channel plus clearance (30mm off the
  // height); Handle and Push doors cover the whole carcass front less a 3mm gap.
  // Wall Gola doors are full height too -- their carcass is the part cut short.
  const golaDoorHeight = isWallGola ? round2(H - 3) : round2(H - GOLA_FRONT_REDUCTION_MM);
  const fullDoorHeight = round2(H - 3);
  const isBlind = config.subtype === 'Blind';
  // The built-in oven's own fascia/door covers this cabinet's whole front —
  // there's no room left for a manufactured wood door.
  const isHobOven = config.subtype === 'Hob + Oven';
  const oneDoorWidth = isBlind ? round2(W - BLIND_PANEL_WIDTH - 3) : round2(W - 3);
  // Every door takes its own 3mm gap off its own slot (e.g. 800 wide x2 -> 397
  // each) instead of splitting a single 3mm gap between them.
  const splitDoorWidth = (n) => round2(W / n - 3);
  const twoDoorWidthEach = splitDoorWidth(2);

  const defaultDoorCount = getDefaultDoorCount(W);
  const doorCount = isBlind ? 1 : (isHobOven || openBox) ? 0 : (Number.isFinite(requestedDoorCount) ? requestedDoorCount : defaultDoorCount);

  const isTallSplit = !isOvenTower && config.cabinetType === 'tall' && doorCount > 1;
  const columnCount = isTallSplit ? Math.max(1, Math.round(doorCount / 2)) : doorCount;

  const doors = [];
  const doorWidths = [];
  if (columnCount === 1) {
    doorWidths.push(oneDoorWidth);
  } else if (columnCount === 2) {
    doorWidths.push(twoDoorWidthEach, twoDoorWidthEach);
  } else {
    const each = splitDoorWidth(columnCount);
    for (let i = 0; i < columnCount; i++) doorWidths.push(each);
  }

  if (isOvenTower) {
    // The oven(s) are a purchased appliance sitting in a cutout, flanked by a hinged
    // door below (storage under the oven) and a hinged door above. A single oven's
    // cavity bottom is anchored to the project's countertop height (baseHeight) so it
    // lines up with the worktop on neighboring base cabinets; a Double Oven's lower
    // oven drops to DOUBLE_OVEN_BOTTOM instead. Matches OvenTowerAppliance in
    // KitchenPlanner3D.jsx.
    const isDouble = config.subtype === 'Double Oven';
    const ovenCavityH = 595;
    const baseH = isDouble ? DOUBLE_OVEN_BOTTOM : (Number(config.baseHeight) || 800);
    const ovenTop = baseH + ovenCavityH * (isDouble ? 2 : 1);
    const label = isDouble ? 'ovens' : 'oven';
    const lowerH = round2(baseH - 3);
    const upperH = round2(H - ovenTop - 3);
    doors.push({
      width: round2(W - 3), height: lowerH, style: doorStyle,
      hinges: getHingeCount(lowerH), handle: doorStyle === 'Handle', tipOn: doorStyle === 'Push',
      notes: `Door below ${label}`,
    });
    doors.push({
      width: round2(W - 3), height: upperH, style: doorStyle,
      hinges: getHingeCount(upperH), handle: doorStyle === 'Handle', tipOn: doorStyle === 'Push',
      notes: `Door above ${label}`,
    });
  } else if (isDrawerCab) {
    // Handled entirely below via the zone-driven layout — no generic full-height
    // door here (a Drawers/2Drw+Door cabinet's fronts all come from its zones).
  } else if (isTallSplit) {
    // Tall Gola: C-channel at base-cabinet-top level splits into lower + upper door.
    // Lower door is cut-identical to a base cabinet Gola door so fronts align.
    const bh = config.baseHeight || 800;
    const lowerH = round2(bh - GOLA_FRONT_REDUCTION_MM); // 770 (H800) / 690 (H720) — aligns with base run
    const upperH = round2(H - bh - 3);    // e.g. 2220 tall H800 -> 1417; 2000 -> 1197
    doorWidths.forEach((dw) => {
      doors.push({
        width: round2(dw), height: lowerH, style: doorStyle,
        hinges: getHingeCount(lowerH), handle: doorStyle === 'Handle', tipOn: doorStyle === 'Push',
        notes: 'Tall lower door (aligns with base run)',
      });
      doors.push({
        width: round2(dw), height: upperH, style: doorStyle,
        hinges: getHingeCount(upperH), handle: doorStyle === 'Handle', tipOn: doorStyle === 'Push',
        notes: 'Tall upper door',
      });
    });
  } else {
  doorWidths.forEach((dw) => {
    const doorH = config.cabinetType === 'tall' ? round2(H - 3) : (doorStyle === 'Gola' ? golaDoorHeight : fullDoorHeight);
    const hinges = getHingeCount(doorH);
    doors.push({
      width: round2(dw),
      height: round2(doorH),
      style: doorStyle,
      hinges,
      handle: doorStyle === 'Handle',
      tipOn: doorStyle === 'Push',
      notes: doorStyle === 'Gola' ? 'Gola style' : '',
    });
  });
  }

  // ---- Interior layout (Drawers/2Drw+Door): one front per zone, top-to-bottom ----
  // Each zone becomes either a drawer front or a door, sized to the zone's own
  // height (matches the picker's chosen layout exactly, and the 3D render's
  // zone-driven CabinetDoors stacking). A door zone with doorCount:2 splits into
  // 2 side-by-side doors instead of 1 full-width door.
  const drawerFronts = [];
  if (isDrawerCab) {
    const zonePreset = config.zonePreset && Array.isArray(config.zonePreset.zones) && config.zonePreset.zones.length > 0
      ? config.zonePreset
      : { zones: [{ type: 'drawer', h: H }] }; // defensive fallback: a raw config with no zonePreset
    const zoneList = zonePreset.zones;
    const maxDrawerH = Math.max(0, ...zoneList.filter(z => z.type === 'drawer').map(z => z.h));
    // LEGRABOX-style height class is a fact of each drawer's own face height, not
    // of its position in the stack -- e.g. '2_drawers' (two equal-height "big"
    // drawers) needs 2x LEGRABOX C, not 1x C + 1x M just because only one of them
    // is picked for the Gola TIP-ON treatment below. 'small' is this cabinet's own
    // height-tier threshold (matches buildZonePresets' own small/big split).
    const smallZoneH = H >= 780 ? 200 : 180;
    let tipOnAssigned = false;
    zoneList.forEach((zone, zoneIdx) => {
      // Every front in a Gola stack sits behind whatever's milled above it (25mm
      // channel, or none at all when golaNeedsChannelAbove skips it) plus the
      // usual 3mm edge clearance every front gets — matching the 3D render's
      // computeGolaDrawerLayout, which shrinks each front by the same amount.
      const zoneReduction = (doorStyle === 'Gola' && golaChannelGapMm(zoneList, zoneIdx) > 0) ? GOLA_FRONT_REDUCTION_MM : 3;
      if (zone.type === 'door') {
        const widths = zonePreset.doorCount === 2 ? [twoDoorWidthEach, twoDoorWidthEach] : [oneDoorWidth];
        const dh = round2(zone.h - zoneReduction);
        widths.forEach((dw) => {
          doors.push({
            width: round2(dw), height: dh, style: doorStyle,
            hinges: getHingeCount(dh), handle: doorStyle === 'Handle', tipOn: doorStyle === 'Push',
            notes: 'Interior layout door',
          });
        });
      } else {
        // Gola TIP-ON (push-to-open) is still assigned to only one drawer in the
        // stack -- a separate hardware/style decision from runner height class.
        const isBig = zone.h === maxDrawerH && !tipOnAssigned;
        if (isBig) tipOnAssigned = true;
        const runnerSize = systemHasIntegratedBox ? (zone.h <= smallZoneH ? 'M' : 'C') : undefined;
        drawerFronts.push({
          width: round2(W - 3),
          height: round2(zone.h - zoneReduction),
          style: doorStyle,
          runnerSize,
          opening: doorStyle === 'Gola' ? (isBig ? 'TIP-ON' : 'channel') : doorStyle,
          tipOn: doorStyle === 'Push' ? true : (doorStyle === 'Gola' && isBig),
          notes: doorStyle === 'Gola'
            ? (isBig ? 'Big drawer: push-to-open (TIP-ON)' : 'Gola channel access')
            : (runnerSize ? `LEGRABOX ${runnerSize}` : ''),
        });
      }
    });
  }
  // A Glass Door cabinet's fronts are bought-in aluminium-framed glass doors
  // (priced per m² of the door's outer size, the supplier sizes the glass) --
  // not cut from the front board.
  if (isGlassDoorCabinet(config)) {
    doors.forEach(d => { d.glassDoor = true; d.notes = 'Aluminium glass door'; });
  }
  const drawerCount = drawerFronts.length;

  // ---- Gola aluminum profiles (aggregated to linear meters at room level) ----
  // Oven towers get no channel — the oven cutout itself gives both doors a finger pull.
  // A Drawers/2Drw+Door cabinet needs one C-channel above every zone that actually
  // needs its own pull point (golaNeedsChannelAbove) instead of the fixed single
  // channel other subtypes use.
  const zonesForGola = config.zonePreset?.zones || [];
  const numGolaChannels = isDrawerCab
    ? zonesForGola.reduce((n, _, i) => n + (golaNeedsChannelAbove(zonesForGola, i) ? 1 : 0), 0)
    : (config.cabinetType === 'tall' ? 1 : (drawerCount > 0 ? 1 : 0));
  const golaProfiles = (doorStyle === 'Gola' && !isOvenTower && !openBox) ? {
    // Tall units have no top L-profile; their base-level channel is a C. Wall
    // units have none either -- the door overhanging the short carcass is the pull.
    L_meters: (config.cabinetType === 'tall' || isWallGola) ? 0 : round2(W / 1000 * 100) / 100,
    C_meters: round2(numGolaChannels * W / 1000 * 100) / 100,
  } : null;

  const hardware = {};
  hardware.legs = 4;
  // A sink's bottom rail takes two more confirmats.
  hardware.confirmats = isSink && !openBox ? 12 : 10;
  // The blind panel and its doubled stile take 16 x 30mm wood screws (12 + 4),
  // counted as confirmats for now.
  if (hasBlindPanel) hardware.confirmats += 16;
  // Wall cabinets hang on a pair of cabinet hangers instead of legs
  hardware.cabinet_hangers = cabinetType === 'wall' ? 2 : 0;
  hardware.dowels = 10;
  // No screwed-on HDF back: an open box's back is board fixed between the panels,
  // and a sink cabinet has no back.
  hardware.back_screws = (openBox || isSink) ? 0 : Math.ceil((W - 2 * T) / 100) * 2;
  hardware.shelf_pins = shelves * 4;
  const numHandles = doors.filter(d => d.handle).length + (doorStyle === 'Handle' ? drawerCount : 0);
  hardware.handles = numHandles;
  const numTipOn = doors.filter(d => d.tipOn).length + drawerFronts.filter(d => d.tipOn).length;
  if (drawerCount > 0) {
    hardware.drawer_runner_sets = drawerCount;
    hardware.drawer_system = drawerSystem;
    if (systemHasIntegratedBox) {
      hardware.runner_sizes = {
        M: drawerFronts.filter(d => d.runnerSize === 'M').length,
        C: drawerFronts.filter(d => d.runnerSize === 'C').length,
      };
    }
  }
  hardware.tip_on = numTipOn;
  hardware.hinges = doors.reduce((acc, d) => acc + d.hinges, 0);
  hardware.confirmat_spec = CONFIRMAT;
  hardware.edge_banding_spec = EDGE_BANDING;

  let drawerBox = null;
  if (drawerCount > 0) {
    if (!systemHasIntegratedBox && drawerType.toLowerCase().includes('wood')) {
      // Wood box interior dims per drawer (runner clearance 2x12.5mm for side-mount)
      const boxW = round2(W - 2 * T - 25);
      const boxD = round2(D - 30 - 50);
      drawerBox = {
        type: 'Wood Box',
        system: drawerSystem,
        count: drawerCount,
        parts_per_drawer: [
          { name: 'Drawer side (12mm)', qty: 2, width: boxD, depth: 120 },
          { name: 'Drawer back/front (12mm)', qty: 2, width: round2(boxW - 24), depth: 120 },
          { name: 'Drawer base (8mm HDF)', qty: 1, width: boxW, depth: boxD },
        ],
        side_thickness: 12,
        back_thickness: 12,
        base_thickness: 8,
        false_front_thickness: 18,
        false_front_clearance_top: -3,
        false_front_clearance_bottom: -3,
      };
    } else {
      // Metal-sided systems (LEGRABOX etc.) supply the sides + back with the runner
      // set itself, but not the bottom -- that's still a shop-cut board sized to the
      // steel box's own interior, same clearance logic as a wood box.
      const intBoxW = round2(W - 2 * T - 25);
      const intBoxD = round2(D - 30 - 50);
      drawerBox = {
        type: drawerType,
        system: drawerSystem,
        count: drawerCount,
        integrated_front: true,
        parts_per_drawer: [
          { name: 'Drawer bottom panel (8mm HDF)', qty: 1, width: intBoxW, depth: intBoxD },
        ],
        base_thickness: 8,
        note: `Integrated box system (${drawerSystem}) — sides/back supplied by the runner set, bottom panel shop-cut`,
      };
    }
  }

  const edgeBanding = {
    specification: EDGE_BANDING,
    rules: {},
  };
  if (material.includes('plywood')) {
    edgeBanding.rules.carcass = 'front edges only';
  } else {
    edgeBanding.rules.carcass = 'all exposed edges';
  }
  edgeBanding.rules.door_front = 'banded in front color';
  edgeBanding.rules.carcass_exposed = 'banded in carcass color';

  const totalHinges = hardware.hinges;

  const summary = {
    width: W,
    height: H,
    depth: D,
    material,
    doorStyle,
    doorCount: doors.length,
    shelves,
    toeKickH,
    legH,
    totalPanels: panels.reduce((s, p) => s + (p.qty || 0), 0),
    totalDoors: doors.length,
    totalHinges,
    hardware,
  };

  const panelsDetailed = panels.map(p => ({
    ...p,
    width: round2(p.width),
    depth: round2(p.depth),
    thickness: p.thickness,
  }));

  return {
    constants: { T, BACK_T: backT, CONFIRMAT, EDGE_BANDING },
    panels: panelsDetailed,
    hardware,
    edgeBanding,
    doors,
    drawerFronts,
    golaProfiles,
    drawerBox,
    summary,
  };
}
