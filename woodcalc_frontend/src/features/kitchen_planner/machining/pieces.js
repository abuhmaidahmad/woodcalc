// Every physical piece a work order cuts, one entry per piece, each with its
// own ID:  <WO number>-R<room number>-<cabinet badge>-<part code>, e.g.
// WO125-R2-03-SL. The room number and badge are frozen once the room is
// confirmed (crm/numbering.py, formulaEngine cabinetBadges), so a piece keeps
// its ID across revisions. The cutting list, optimizer, labels and CNC export
// all work from this list; the saw operator's grouped view is
// groupPieces(pieces).
//
// Each piece: { id, code, cabinetId, badge, cabinet, name, label, length,
// width, thickness, kind ('carcass'|'front'|'back'|'drawer'), sku, materialName,
// grainLocked, edgeBanding { T, B, L, R }, part, errors } -- length x width in
// cut-list order (the same as the optimizer's width x height), part = the
// machining part (schema.js) for pieces the CNC drills, else null, and errors =
// buildMachining's problems with that part's ops (empty when it's fine).
import {
  cabinetBadges, cabinetConfig, isCarcassCabinet, isBackPanel, panelFace, panelEdgeBanding,
  nonCarcassPieceDims, fillerCleatDims, flatPieceEdgeBanding, APPLIANCE_SUBTYPES, withRoomBackPanel,
} from '../formulaEngine';
import { bilingualPartName } from '../partNamesAr';
import { buildMachining } from './index';

// Part code for each machining part id (parts.js); anything else is its id upper-cased.
const PART_CODES = {
  'side-left': 'SL', 'side-right': 'SR', bottom: 'BOT', top: 'TOP', 'fixed-panel': 'FX',
  'front-rail': 'RF', 'back-rail': 'RB', 'bottom-rail': 'RS', back: 'BK',
  'back-panel-box-board': 'BK', 'blind-panel': 'BP', 'blind-filler': 'BF',
};
export function partCode(partId) {
  if (PART_CODES[partId]) return PART_CODES[partId];
  let m;
  if ((m = partId.match(/^shelf-(\d+)$/))) return `SH${m[1]}`;
  if ((m = partId.match(/^door-(\d+)$/))) return `D${m[1]}`;
  if ((m = partId.match(/^drawer-front-(\d+)$/))) return `DF${m[1]}`;
  if ((m = partId.match(/^blind-stile-(\d+)$/))) return `BS${m[1]}`;
  return partId.toUpperCase();
}

// Flat (non-carcass) pieces: one board each, named by subtype.
const FLAT_CODES = { Filler: 'FIL', 'Side Panel': 'SP', 'Top Panel': 'TP', Panel: 'PNL', 'Toe Kick': 'TK', Shelf: 'SHF' };

// Drawer box parts, per drawer n: DB<n>-SL/SR (sides), -FR/-BK (front/back), -BT (base).
const DRAWER_CODES = {
  'Drawer side (12mm)': ['SL', 'SR'],
  'Drawer back/front (12mm)': ['FR', 'BK'],
  'Drawer base (8mm HDF)': ['BT'],
  'Drawer bottom panel (8mm HDF)': ['BT'],
};

const pad2 = (n) => String(n).padStart(2, '0');
export const pieceId = (woNumber, roomNumber, badge, code) => `${woNumber}-R${roomNumber ?? 0}-${pad2(badge)}-${code}`;

const allRound = (m) => ({ T: m, B: m, L: m, R: m });
const NONE = { T: 'None', B: 'None', L: 'None', R: 'None' };

// The pieces of one cabinet, IDs built with idFor(code). kitchenCarcassSku is
// the board most of the room's boxes use (a filler's cleat is cut from it).
export function cabinetPieces(cab, badge, idFor, { constructionSettings = null, kitchenCarcassSku = null } = {}) {
  if (APPLIANCE_SUBTYPES.includes(cab.subtype) && !isCarcassCabinet(cab)) return [];
  const carcassName = cab.carcassMaterialName || cab.material || 'Carcass';
  const frontName = cab.frontMaterialName || 'Front';
  const base = { cabinetId: cab.id, badge, cabinet: cab.label || cab.subtype || '' };
  let partErrors = []; // buildMachining's, set below for carcass cabinets
  const piece = (code, name, length, width, thickness, kind, sku, materialName, grainLocked, edgeBanding, part = null) => ({
    ...base, id: idFor(code), code, name, label: bilingualPartName(name), length, width, thickness,
    kind, sku: typeof sku === 'string' ? sku.trim() || null : sku ?? null, materialName, grainLocked, edgeBanding, part,
    errors: part ? partErrors.filter(e => e.startsWith(`${part.id} `) || e.startsWith(`${part.id}:`)) : [],
  });

  if (!isCarcassCabinet(cab)) {
    const out = [];
    const dims = nonCarcassPieceDims(cab);
    const fb = flatPieceEdgeBanding(cab, frontName);
    if (dims.width > 0 && dims.depth > 0) {
      out.push(piece(FLAT_CODES[cab.subtype] || 'PC', cab.subtype || 'Piece', dims.width, dims.depth, dims.thickness || 18,
        'front', cab.frontMaterialCode, frontName, true, Object.keys(fb).length ? fb : NONE));
    }
    if (cab.subtype === 'Filler') {
      const cleat = fillerCleatDims(cab);
      if (cleat.width > 0) {
        out.push(piece('CL', 'Filler Fixing Cleat', cleat.width, cleat.depth, cleat.thickness, 'carcass',
          cab.carcassMaterialCode || kitchenCarcassSku, carcassName, false, { ...NONE, R: frontName }));
      }
    }
    return out;
  }

  const config = {
    ...cabinetConfig(cab), hingeSide: cab.hingeSide, blindSide: cab.blindSide, shelfHeights: cab.shelfHeights, constructionSettings,
  };
  let built;
  try { built = buildMachining(config); } catch { return []; }
  const { parts, result } = built;
  partErrors = built.errors;
  const panelFor = (name) => result.panels.find(p => p.name === name);
  const out = parts.map(part => {
    const code = partCode(part.id);
    if (part.source === 'Door' || part.source === 'Drawer front') {
      // 'Drawer Front' is the name the cut lists and their Arabic names use.
      return piece(code, part.source === 'Door' ? 'Door' : 'Drawer Front', part.length, part.width, part.thickness, 'front', cab.frontMaterialCode, frontName, true, allRound(frontName), part);
    }
    const p = panelFor(part.source);
    const eb = panelEdgeBanding(p, null, null, carcassName, frontName, cab.doorStyle);
    if (isBackPanel(p)) return piece(code, p.name, part.length, part.width, p.thickness, 'back', p.materialCode, p.materialCode || `HDF ${p.thickness}mm`, false, eb, part);
    if (panelFace(p) === 'front') return piece(code, p.name, part.length, part.width, part.thickness, 'front', cab.frontMaterialCode, frontName, true, eb, part);
    return piece(code, p.name, part.length, part.width, part.thickness, 'carcass', cab.carcassMaterialCode, carcassName, false, eb, part);
  });

  const box = result.drawerBox;
  if (box?.parts_per_drawer) {
    for (let n = 1; n <= (box.count || 1); n++) {
      box.parts_per_drawer.forEach(dp => {
        const codes = DRAWER_CODES[dp.name] || Array.from({ length: dp.qty }, (_, k) => `P${k + 1}`);
        const hdf = /HDF/.test(dp.name);
        const th = hdf ? (box.base_thickness || 8) : (box.side_thickness || 12);
        for (let k = 0; k < dp.qty; k++) {
          out.push(piece(`DB${n}-${codes[k] || `P${k + 1}`}`, dp.name, dp.width, dp.depth, th, 'drawer', null,
            hdf ? `HDF ${th}mm` : `Drawer box ${th}mm`, false, NONE));
        }
      });
    }
  }
  return out;
}

// All pieces of one work order. workOrder: { order_number, sent_cabinet_ids };
// room: { room_number, planner_data, construction_settings }. Only the cabinets
// the work order was sent with are included (all of the room's when it lists none).
export function workOrderPieces(workOrder, room) {
  const all = room?.planner_data?.cabinets || [];
  const sent = new Set(workOrder?.sent_cabinet_ids || []);
  const cabinets = sent.size ? all.filter(c => sent.has(c.id)) : all;
  const badges = cabinetBadges(all);
  const carcassUse = new Map();
  all.forEach(c => {
    const sku = isCarcassCabinet(c) && typeof c.carcassMaterialCode === 'string' && c.carcassMaterialCode.trim();
    if (sku) carcassUse.set(sku, (carcassUse.get(sku) || 0) + 1);
  });
  const kitchenCarcassSku = [...carcassUse.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const constructionSettings = room?.construction_settings || null;
  return withRoomBackPanel(constructionSettings, () => cabinets.flatMap(cab => {
    const badge = badges.get(cab.id);
    return cabinetPieces(cab, badge, (code) => pieceId(workOrder?.order_number || 'WO', room?.room_number, badge, code),
      { constructionSettings, kitchenCarcassSku });
  }));
}

// The saw operator's view: pieces grouped by name + size + material, with the
// IDs in each group, in first-seen order.
export function groupPieces(pieces) {
  const groups = new Map();
  pieces.forEach(p => {
    const key = [p.label, p.length, p.width, p.thickness, p.kind, p.sku || p.materialName, p.grainLocked].join('|');
    if (!groups.has(key)) {
      groups.set(key, { key, label: p.label, name: p.name, length: p.length, width: p.width, thickness: p.thickness,
        kind: p.kind, sku: p.sku, materialName: p.materialName, grainLocked: p.grainLocked, quantity: 0, ids: [] });
    }
    const g = groups.get(key);
    g.quantity += 1;
    g.ids.push(p.id);
  });
  return [...groups.values()];
}
