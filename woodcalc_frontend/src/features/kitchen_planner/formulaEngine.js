// formulaEngine.js
// Cabinet formula engine for WoodCalc
// Units: mm

const T = 18; // panel thickness mm
const BACK_T = 8; // HDF back panel thickness mm
const CONFIRMAT = '7x50mm';
const EDGE_BANDING = '1mm ABS';

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
  const shelves = Number(config.shelves || 0);
  const drawerType = (config.drawerType || 'Wood Box');
  const zones = config.zones || [];
  const cabinetType = config.cabinetType || 'base';

  const { toeKickH, legH, preset } = chooseToeKickAndLegs(H);

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

  panels.push({
    name: 'Toe kick',
    qty: 1,
    width: round2(W),
    depth: toeKickH,
    thickness: 18,
    notes: `Toe kick height ${toeKickH} (preset ${preset})`,
  });

  const opening = round2(H - T - 100);
  const golaDoorHeight = round2(opening - 25 - 3);
  const handlePushDoorHeight = round2(opening - 3 - 3);
  const oneDoorWidth = round2(W - 3);
  const twoDoorWidthEach = round2((W - 3) / 2);

  const defaultDoorCount = getDefaultDoorCount(W);
  const doorCount = Number.isFinite(requestedDoorCount) ? requestedDoorCount : defaultDoorCount;

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

  const hardware = {};
  hardware.legs = 4;
  hardware.confirmats = 10;
  hardware.dowels = 10;
  hardware.back_screws = Math.ceil((W - 2 * T) / 100) * 2;
  hardware.shelf_pins = shelves * 4;
  const numHandles = doors.filter(d => d.handle).length + (config.drawers || 0);
  hardware.handles = numHandles;
  const numTipOn = doors.filter(d => d.tipOn).length + (config.drawers || 0);
  hardware.tip_on = numTipOn;
  hardware.confirmat_spec = CONFIRMAT;
  hardware.edge_banding_spec = EDGE_BANDING;

  let drawerBox = null;
  if (config.drawers && config.drawers > 0) {
    if (drawerType.toLowerCase().includes('wood')) {
      drawerBox = {
        type: 'Wood Box',
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
        integratd_front: true,
        note: 'No false front, integrated Blum front system',
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
    drawerBox,
    summary,
  };
}
