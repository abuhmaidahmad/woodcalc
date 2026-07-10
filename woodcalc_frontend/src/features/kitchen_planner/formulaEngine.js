// formulaEngine.js
// Cabinet formula engine for WoodCalc
// Units: mm

const T = 18; // panel thickness mm
const BACK_T = 8; // HDF back panel thickness mm
const CONFIRMAT = '7x50mm';
const EDGE_BANDING = '1mm ABS';
export const BLIND_PANEL_WIDTH = 650; // mm — fixed hidden section behind adjoining cabinet

// Adjustable-shelf feature: base/wall/tall/corner cabinets get it, EXCEPT drawer-based fronts,
// sink cabinets, and anything in vanity/specialty/accessories (those aren't real shelf-and-door boxes).
export function isShelfEligible(cab) {
  if (['vanity', 'specialty', 'accessories'].includes(cab.category)) return false;
  if (['Drawers', '2Drw+Door', 'Sink', 'Double Sink'].includes(cab.subtype)) return false;
  if (['Filler', 'Panel', 'Toe Kick', 'Side Panel'].includes(cab.subtype)) return false;
  return ['base', 'wall', 'tall', 'corner'].includes(cab.category);
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

export function getZonePresets(height) {
  const isH800 = height >= 800;
  const zoneUnit = isH800 ? 200 : 180;
  const cutSize = zoneUnit - 3;
  const presets = [
    {
      id: '4_drawers',
      name: '4 drawers',
      zones: Array(4).fill(zoneUnit),
      cutSize,
    },
    {
      id: '2_drawers_1_door',
      name: '2 drawers + 1 door',
      zones: [zoneUnit, zoneUnit, height - (2 * zoneUnit)],
      cutSize,
    },
    {
      id: '2_drawers',
      name: '2 drawers',
      zones: [zoneUnit, zoneUnit],
      cutSize,
    },
    {
      id: '1_full_door',
      name: '1 full door',
      zones: [height],
      cutSize,
    },
  ];

  const valid = presets.filter(p => {
    const drawerZones = p.zones.filter(z => z < 300);
    const drawerOk = drawerZones.length === 0 || drawerZones.every(z => z >= 150);
    const doorZones = p.zones.filter(z => z >= 300);
    const doorOk = doorZones.length === 0 || doorZones.every(z => z >= 300);
    const maxDrawersOk = p.zones.length <= 4;
    return drawerOk && doorOk && maxDrawersOk;
  });

  return valid;
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

export function calculateCabinet(config) {
  const W = Number(config.width);
  const H = Number(config.height);
  const D = Number(config.depth);
  const material = (config.material || 'particleboard').toLowerCase();
  const doorStyle = (config.doorStyle || 'Handle');
  const requestedDoorCount = Number(config.doorCount || getDefaultDoorCount(W));
  const shelves = Number(config.shelves || (config.cabinetType === 'tall' ? 4 : 0));
  const drawerType = (config.drawerType || 'Wood Box');
  // Drawer runner system: 'LEGRABOX' (integrated box), 'Tandem' (runner + wood box),
  // 'Local Bearing' (runner + wood box), or any custom system name from the catalog.
  const drawerSystem = (config.drawerSystem || 'Local Bearing');
  // box_construction from DrawerSystem API drives the branch; regex only for legacy saved data
  const systemHasIntegratedBox = config.drawerBoxConstruction
    ? config.drawerBoxConstruction === 'metal_sided'
    : /legrabox|tandembox|integrated/i.test(drawerSystem);
  const zones = config.zones || [];
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

  const backW = round2(W - 2 * T - 3);
  const backH = round2(H - T - 3);
  panels.push({
    name: 'Back panel (HDF)',
    qty: 1,
    width: backW,
    depth: backH,
    thickness: BACK_T,
    notes: '8mm HDF',
  });

  const shelfW = bottomW;
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
  const oneDoorWidth = isBlind ? round2(W - BLIND_PANEL_WIDTH - 3) : round2(W - 3);
  const twoDoorWidthEach = round2((W - 3) / 2);

  const defaultDoorCount = getDefaultDoorCount(W);
  const doorCount = isBlind ? 1 : (Number.isFinite(requestedDoorCount) ? requestedDoorCount : defaultDoorCount);

  const doors = [];
  const doorWidths = [];
  if (doorCount === 1) {
    doorWidths.push(oneDoorWidth);
  } else if (doorCount === 2) {
    doorWidths.push(twoDoorWidthEach, twoDoorWidthEach);
  } else {
    const each = round2((W - 3) / doorCount);
    for (let i = 0; i < doorCount; i++) doorWidths.push(each);
  }

  const isTallSplit = config.cabinetType === 'tall';
  if (isTallSplit) {
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
    const doorH = doorStyle === 'Gola' ? golaDoorHeight : handlePushDoorHeight;
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

  // ---- Drawer fronts (Richelieu Gola art.1004-1005 layout) ----
  // Gola stack top-down: L channel (25) -> d1 -> d2 -> C channel (25) -> d3 -> d4(TIP-ON).
  // First three fronts equal: unit - 47/3; fourth: unit - 3 tolerance.
  const drawerFronts = [];
  const requestedDrawers = Number(config.drawers || 0);
  const drawerCount = (doorStyle === 'Gola' && requestedDrawers > 0) ? 3 : requestedDrawers;
  if (drawerCount > 0) {
    const frontW = round2(W - 3);
    if (doorStyle === 'Gola') {
      // Standard Gola stack: L channel (25) -> 2 small fronts (LEGRABOX M)
      // -> C channel (25) -> 1 big front at 2*unit - 3 (LEGRABOX C).
      const unit = H >= 790 ? 200 : 180;
      const hBig = round2(2 * unit - 3);
      const hSmall = round2((H - 50 - hBig) / 2);
      const fronts = [
        { h: hSmall, runner: 'M', opening: 'L/C channel' },
        { h: hSmall, runner: 'M', opening: 'C channel' },
        { h: hBig, runner: 'C', opening: 'TIP-ON', tipOn: true },
      ];
      fronts.forEach((f, i) => {
        drawerFronts.push({
          width: frontW,
          height: f.h,
          style: 'Gola',
          runnerSize: f.runner,
          opening: f.opening,
          notes: f.tipOn ? 'Big drawer: LEGRABOX C, push-to-open (TIP-ON)' : 'LEGRABOX M, Gola channel access',
        });
      });
    } else {
      const eq = round2((H - 3 * (drawerCount + 1)) / drawerCount);
      for (let d = 0; d < drawerCount; d++) {
        drawerFronts.push({ width: frontW, height: eq, style: doorStyle, opening: doorStyle, notes: '' });
      }
    }
  }

  // ---- Gola aluminum profiles (aggregated to linear meters at room level) ----
  const golaProfiles = doorStyle === 'Gola' ? {
    // Tall units have no top L-profile; their base-level channel is a C.
    L_meters: config.cabinetType === 'tall' ? 0 : round2(W / 1000 * 100) / 100,
    C_meters: (config.cabinetType === 'tall' || drawerCount > 0) ? round2(W / 1000 * 100) / 100 : 0,
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
  const numTipOn = doors.filter(d => d.tipOn).length
    + (doorStyle === 'Gola' && drawerCount > 0 ? 1 : (doorStyle === 'Push' ? drawerCount : 0));
  if (drawerCount > 0) {
    hardware.drawer_runner_sets = drawerCount;
    hardware.drawer_system = drawerSystem;
    if (doorStyle === 'Gola') {
      hardware.runner_sizes = { M: 2, C: 1 };
    }
  }
  hardware.tip_on = numTipOn;
  hardware.confirmat_spec = CONFIRMAT;
  hardware.edge_banding_spec = EDGE_BANDING;

  let drawerBox = null;
  if (config.drawers && config.drawers > 0) {
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
