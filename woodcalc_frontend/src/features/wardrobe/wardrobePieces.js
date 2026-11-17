import { asciiIdPart } from '../kitchen_planner/machining/pieces'
import { normalizeStandard } from './wardrobeStandard'
import { computeDesign } from './closetEngine'
import { PART_NAMES_AR } from './wardrobeEngine'
import { savedWardrobe } from './wardrobeRoom'

export const WARDROBE_PART_CODES = {
  'Side': 'SD',
  'Partition': 'P',
  'Top': 'TOP',
  'Bottom': 'BOT',
  'Back': 'BK',
  'Back rail': 'RB',
  'Fixed shelf': 'FX',
  'Shelf': 'SH',
  'Door': 'D',
  'Sliding door': 'SLD',
  'Drawer spacer': 'SP',
  'Drawer front': 'DF',
  'Drawer side': 'DS',
  'Drawer front/back': 'DFB',
  'Drawer bottom': 'DBT',
  'Plinth': 'PL',
  'Filler': 'FIL',
  'Top filler': 'TF',
  'Island top': 'IT',
}

const KIND = { Carcass: 'carcass', Front: 'front', Back: 'back', 'Drawer box': 'drawer' }
const NONE = 'None'

export function pieceGroup(section) {
  return section === 'ALL' ? '00' : asciiIdPart(section, '00')
}

export function edgeBandingFor(edges, band) {
  const set = new Set(edges ? edges.split(',') : [])
  return {
    T: set.has('L') ? band : NONE,
    B: set.has('R') ? band : NONE,
    L: set.has('B') ? band : NONE,
    R: set.has('F') ? band : NONE,
  }
}

export function materialFor(role, T, snapshot) {
  const snap = snapshot?.[role]
  const thick = Number(snap?.thickness) || 0
  if (snap?.sku && (!thick || thick === T)) return { sku: snap.sku, materialName: snap.name || snap.sku }
  return { sku: null, materialName: `${role} ${T}mm` }
}

export function piecesFromParts(rawParts, { woNumber = 'WO', roomNumber = 0, materials = {} } = {}) {
  const counters = new Map()
  const bandName = (role, T) => materialFor(role, T, materials).materialName
  const carcassBand = bandName('Carcass', 18)
  const out = []
  rawParts.forEach((p) => {
    const group = pieceGroup(p.section)
    const code = `${p.loft ? 'L' : ''}${WARDROBE_PART_CODES[p.name] || asciiIdPart(p.name, 'PC').toUpperCase()}`
    const kind = p.name === 'Drawer bottom' ? 'drawer' : KIND[p.material] || 'carcass'
    const { sku, materialName } = materialFor(p.material, p.T, materials)
    const band = p.material === 'Front' ? materialName : carcassBand
    const ar = PART_NAMES_AR[p.name]
    for (let k = 0; k < p.qty; k++) {
      const key = `${group}|${code}`
      const n = (counters.get(key) || 0) + 1
      counters.set(key, n)
      const pieceCode = `${code}${n}`
      out.push({
        id: `${asciiIdPart(woNumber, 'WO')}-R${roomNumber ?? 0}-${group}-${pieceCode}`,
        code: pieceCode,
        cabinetId: p.section,
        badge: group,
        cabinet: p.section === 'ALL' ? 'Wardrobe' : String(p.section).replace(/·/g, '-'),
        name: p.name,
        label: ar ? `${p.name} / ${ar}` : p.name,
        length: p.L,
        width: p.W,
        thickness: p.T,
        kind,
        sku,
        materialName,
        grainLocked: kind === 'front',
        edgeBanding: p.edges ? edgeBandingFor(p.edges, band) : { T: NONE, B: NONE, L: NONE, R: NONE },
        part: null,
        errors: [],
      })
    }
  })
  return out
}

export function wardrobeRoomResult(room) {
  const saved = savedWardrobe(room)
  if (!saved) return null
  const std = normalizeStandard(saved.standard)
  return { design: saved.design, std, result: computeDesign(saved.design, std) }
}

export function wardrobePieces(workOrder, room) {
  const built = wardrobeRoomResult(room)
  if (!built) return []
  return piecesFromParts(built.result.rawParts, {
    woNumber: workOrder?.order_number || 'WO',
    roomNumber: room?.room_number,
    materials: room?.planner_data?.materials || {},
  })
}

export function workOrderItems(pieces) {
  const map = new Map()
  pieces.forEach((p) => {
    const key = [p.name, p.length, p.width, p.thickness, p.materialName].join('|')
    const e = map.get(key)
    if (e) e.quantity += 1
    else map.set(key, { description: `${p.name} ${p.length}x${p.width}x${p.thickness}mm (${p.materialName})`, quantity: 1, unit: 'pcs' })
  })
  return [...map.values()]
}
