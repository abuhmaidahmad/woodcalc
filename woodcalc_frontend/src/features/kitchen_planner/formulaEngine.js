// formulaEngine.js
// Cabinet formula engine for WoodCalc
// Units: mm

const T = 18; // panel thickness mm
const BACK_T = 8; // HDF back panel thickness mm
const CONFIRMAT = '7x50mm';
const EDGE_BANDING = '1mm ABS';
// Gola milled channel/reveal height (mm) -- matches GOLA_CH in KitchenPlanner3D.jsx.
const GOLA_CHANNEL_MM = 25;
export const BLIND_PANEL_WIDTH = 650; // mm — fixed hidden section behind adjoining cabinet

// Adjustable-shelf feature: base/wall/tall/corner cabinets get it, EXCEPT drawer-based fronts,
// sink cabinets, and anything in vanity/specialty/accessories (those aren't real shelf-and-door boxes).
export function isShelfEligible(cab) {
  if (['vanity', 'specialty', 'accessories'].includes(cab.category)) return false;
  if (['Drawers', '2Drw+Door', 'Sink', 'Double Sink', 'Hob + Oven'].includes(cab.subtype)) return false;
  if (['Filler', 'Panel', 'Toe Kick', 'Side Panel'].includes(cab.subtype)) return false;
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
export const NON_CARCASS_SUBTYPES = ['Filler', 'Panel', 'Toe Kick', 'Shelf', 'Open Shelf', 'Fridge', 'Appliance'];
export const APPLIANCE_SUBTYPES = ['Fridge', 'Oven Tower', 'Double Oven', 'Appliance', 'Freestanding Oven', 'Freestanding Fridge', 'Freestanding Dishwasher'];

export function isCarcassCabinet(c) {
  return !NON_CARCASS_SUBTYPES.includes(c.subtype) && c.category !== 'accessories';
}

// Dimensions for a non-carcass flat piece (Filler/Panel/Toe Kick/Shelf/Open Shelf) —
// one board cut at its own size, no box formula. Matches the master cut list's piece
// entry exactly, so the cost proposal never charges for a size it wouldn't actually cut.
// Side Panel is depth-oriented (a vertical infill against a wall); everything else in
// this bucket is width-oriented (a horizontal strip/board).
export function nonCarcassPieceDims(c) {
  const isPanel = c.subtype === 'Side Panel';
  return {
    width: c.height,
    depth: isPanel ? (c.depth || 581) : c.width,
    thickness: isPanel ? (c.panelThickness || c.frontMaterialThickness || 18) : 18,
  };
}

// Builds the calculateCabinet() input from a saved cabinet object — shared by the
// cut list and the cost proposal so a subtype's door/drawer rules (Blind's narrow
// door, Hob + Oven's no-wood-door front, drawer counts, etc.) price the same way
// they get cut.
export function cabinetConfig(c) {
  return {
    width: c.width, height: c.height, depth: c.depth,
    material: c.material, doorStyle: c.doorStyle, shelves: 0,
    cabinetType: c.category,
    doorCount: c.doorCount,
    subtype: c.subtype,
    zonePreset: resolveZonePreset(c),
    drawerType: c.drawerType,
    drawerSystem: c.drawerSystem,
    drawerBoxConstruction: c.drawerBoxConstruction,
    baseHeight: c.baseHeight,
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
export function stairFillerPanels(seg, effectiveH, depth) {
  const fillerH = round2(seg.availableH - effectiveH);
  if (fillerH <= 1) return [];
  const w = round2(seg.x1 - seg.x0);
  const innerDepth = round2(depth - 30 - 8);
  return [
    { name: 'Stepped filler side panel', qty: 2, width: fillerH, depth, thickness: T, notes: 'Follows stair above' },
    { name: 'Stepped filler top panel', qty: 1, width: w, depth: innerDepth, thickness: T, notes: 'Follows stair above' },
    { name: 'Stepped filler bottom panel', qty: 1, width: w, depth: innerDepth, thickness: T, notes: 'Follows stair above' },
    { name: 'Stepped filler back panel', qty: 1, width: w, depth: fillerH, thickness: BACK_T, notes: 'Follows stair above' },
  ];
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
  const shelves = Number(config.shelves || (config.cabinetType === 'tall' && !isOvenTower ? 4 : 0));
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

  // Wall and tall cabinets don't sit on the floor with a toe kick + legs
  const hasFloorBase = cabinetType === 'base';
  const { toeKickH, legH, preset } = hasFloorBase
    ? chooseToeKickAndLegs(H)
    : { toeKickH: 0, legH: 0, preset: cabinetType === 'wall' ? 'WALL' : 'TALL' };

  const panels = [];
  panels.push({
    name: 'Side panel',
    qty: 2,
    width: H,
    depth: D,
    thickness: T,
    notes: 'Vertical sides',
  });

  const bottomW = round2(W - 2 * T);
  const bottomD = round2(D - 30 - 8);
  panels.push({
    name: 'Bottom panel',
    qty: 1,
    width: bottomW,
    depth: bottomD,
    thickness: T,
    notes: '(W - 2T) × (D - 30 - 8)',
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
      notes: '(W - 2T) × (D - 30 - 8), same as bottom panel',
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

  const backW = round2(bottomW + 16);
  const backH = round2(H - T - 3);
  panels.push({
    name: 'Back panel (HDF)',
    qty: 1,
    width: backW,
    depth: backH,
    thickness: BACK_T,
    notes: '8mm HDF',
  });

  const shelfW = round2(bottomW - 2);
  const shelfD = round2(D - 38);
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

  const opening = round2(H - T - 100);
  const golaDoorHeight = round2(H - 25 - 3);
  const handlePushDoorHeight = round2(opening - 3 - 3);
  const isBlind = config.subtype === 'Blind';
  // The built-in oven's own fascia/door covers this cabinet's whole front —
  // there's no room left for a manufactured wood door.
  const isHobOven = config.subtype === 'Hob + Oven';
  const oneDoorWidth = isBlind ? round2(W - BLIND_PANEL_WIDTH - 3) : round2(W - 3);
  const twoDoorWidthEach = round2((W - 3) / 2);

  const defaultDoorCount = getDefaultDoorCount(W);
  const doorCount = isBlind ? 1 : isHobOven ? 0 : (Number.isFinite(requestedDoorCount) ? requestedDoorCount : defaultDoorCount);

  const isTallSplit = !isOvenTower && config.cabinetType === 'tall' && doorCount > 1;
  const columnCount = isTallSplit ? Math.max(1, Math.round(doorCount / 2)) : doorCount;

  const doors = [];
  const doorWidths = [];
  if (columnCount === 1) {
    doorWidths.push(oneDoorWidth);
  } else if (columnCount === 2) {
    doorWidths.push(twoDoorWidthEach, twoDoorWidthEach);
  } else {
    const each = round2((W - 3) / columnCount);
    for (let i = 0; i < columnCount; i++) doorWidths.push(each);
  }

  if (isOvenTower) {
    // No opening doors here — the oven(s) are a purchased appliance sitting in a cutout,
    // flanked by fixed front panels above/below. The cavity's bottom is anchored to the
    // project's countertop height (baseHeight) so it lines up with the worktop on
    // neighboring base cabinets, matching OvenTowerAppliance in KitchenPlanner3D.jsx.
    const isDouble = config.subtype === 'Double Oven';
    const ovenCavityH = 595;
    const baseH = Number(config.baseHeight) || 800;
    const panelW = round2(W - 3);
    if (isDouble) {
      const bottomOvenBottom = baseH;
      const bottomOvenTop = bottomOvenBottom + ovenCavityH;
      const topOvenTop = bottomOvenTop + ovenCavityH;
      panels.push({ name: 'Front panel (below ovens)', qty: 1, width: panelW, depth: round2(bottomOvenBottom), thickness: T, notes: 'Fixed panel, below the two ovens' });
      panels.push({ name: 'Front panel (above ovens)', qty: 1, width: panelW, depth: round2(H - topOvenTop), thickness: T, notes: 'Fixed panel, above the two ovens' });
    } else {
      const ovenBottom = baseH;
      const ovenTop = ovenBottom + ovenCavityH;
      panels.push({ name: 'Front panel (below oven)', qty: 1, width: panelW, depth: round2(ovenBottom), thickness: T, notes: 'Fixed panel, below the oven' });
      panels.push({ name: 'Front panel (above oven)', qty: 1, width: panelW, depth: round2(H - ovenTop), thickness: T, notes: 'Fixed panel, above the oven' });
    }
  } else if (isDrawerCab) {
    // Handled entirely below via the zone-driven layout — no generic full-height
    // door here (a Drawers/2Drw+Door cabinet's fronts all come from its zones).
  } else if (isTallSplit) {
    // Tall Gola: C-channel at base-cabinet-top level splits into lower + upper door.
    // Lower door is cut-identical to a base cabinet Gola door so fronts align.
    const bh = config.baseHeight || 800;
    const lowerH = round2(bh - 25 - 3);   // 772 (H800) / 692 (H720) — aligns with base run
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
    const doorH = config.cabinetType === 'tall' ? round2(H - 3) : (doorStyle === 'Gola' ? golaDoorHeight : handlePushDoorHeight);
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
    // Every front in a Gola stack sits behind a milled channel/reveal (25mm) —
    // matching the 3D render's computeGolaDrawerLayout, which shrinks each front
    // by the same amount to make its slot fit without overflowing the cabinet.
    const zoneReduction = doorStyle === 'Gola' ? (GOLA_CHANNEL_MM + 3) : 3;
    const maxDrawerH = Math.max(0, ...zoneList.filter(z => z.type === 'drawer').map(z => z.h));
    let tipOnAssigned = false;
    zoneList.forEach((zone) => {
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
        // The biggest drawer in the stack gets the Gola TIP-ON (push-to-open,
        // LEGRABOX C) treatment; smaller ones use a regular LEGRABOX M channel pull.
        const isBig = zone.h === maxDrawerH && !tipOnAssigned;
        if (isBig) tipOnAssigned = true;
        drawerFronts.push({
          width: round2(W - 3),
          height: round2(zone.h - zoneReduction),
          style: doorStyle,
          runnerSize: doorStyle === 'Gola' ? (isBig ? 'C' : 'M') : undefined,
          opening: doorStyle === 'Gola' ? (isBig ? 'TIP-ON' : 'channel') : doorStyle,
          tipOn: doorStyle === 'Push' ? true : (doorStyle === 'Gola' && isBig),
          notes: doorStyle === 'Gola' ? (isBig ? 'Big drawer: LEGRABOX C, push-to-open (TIP-ON)' : 'LEGRABOX M, Gola channel access') : '',
        });
      }
    });
  }
  const drawerCount = drawerFronts.length;

  // ---- Gola aluminum profiles (aggregated to linear meters at room level) ----
  // Oven towers have no doors/drawers to channel — their fronts are fixed panels.
  // A Drawers/2Drw+Door cabinet needs one C-channel between every adjacent pair
  // of zones (N-1 for N zones) instead of the fixed single channel other subtypes use.
  const numGolaChannels = isDrawerCab
    ? Math.max(0, (config.zonePreset?.zones?.length || 1) - 1)
    : (config.cabinetType === 'tall' ? 1 : (drawerCount > 0 ? 1 : 0));
  const golaProfiles = (doorStyle === 'Gola' && !isOvenTower) ? {
    // Tall units have no top L-profile; their base-level channel is a C.
    L_meters: config.cabinetType === 'tall' ? 0 : round2(W / 1000 * 100) / 100,
    C_meters: round2(numGolaChannels * W / 1000 * 100) / 100,
  } : null;

  const hardware = {};
  hardware.legs = 4;
  hardware.confirmats = 10;
  // Wall cabinets hang on a pair of cabinet hangers instead of legs
  hardware.cabinet_hangers = cabinetType === 'wall' ? 2 : 0;
  hardware.dowels = 10;
  hardware.back_screws = Math.ceil((W - 2 * T) / 100) * 2;
  hardware.shelf_pins = shelves * 4;
  const numHandles = doors.filter(d => d.handle).length + (doorStyle === 'Handle' ? drawerCount : 0);
  hardware.handles = numHandles;
  const numTipOn = doors.filter(d => d.tipOn).length + drawerFronts.filter(d => d.tipOn).length;
  if (drawerCount > 0) {
    hardware.drawer_runner_sets = drawerCount;
    hardware.drawer_system = drawerSystem;
    if (doorStyle === 'Gola') {
      hardware.runner_sizes = {
        M: drawerFronts.filter(d => d.runnerSize === 'M').length,
        C: drawerFronts.filter(d => d.runnerSize === 'C').length,
      };
    }
  }
  hardware.tip_on = numTipOn;
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
      drawerBox = {
        type: drawerType,
        system: drawerSystem,
        count: drawerCount,
        integrated_front: true,
        note: `Integrated box system (${drawerSystem}) — no wood box parts`,
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

  const totalHinges = doors.reduce((acc, d) => acc + d.hinges, 0);

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
    constants: { T, BACK_T, CONFIRMAT, EDGE_BANDING },
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
