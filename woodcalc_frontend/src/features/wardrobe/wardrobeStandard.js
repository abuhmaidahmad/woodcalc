import { MACHINING_CONFIG } from '../kitchen_planner/machining/config'

export const DEFAULT_WARDROBE_STANDARD = {
  carcassT: 18,
  frontT: 18,
  backT: 8,
  grooveDepth: MACHINING_CONFIG.backGroove.depth,
  grooveSetback: MACHINING_CONFIG.backGroove.setback,
  backClearance: MACHINING_CONFIG.backGroove.backClearance,
  plinthH: 100,
  plinthSetback: 40,
  legsPerSection: 4,
  maxCarcassH: 2400,
  minLoftH: 300,
  maxSectionW: 1000,
  minSectionW: 300,
  maxDoorW: 600,
  doorGap: 3,
  minHangDepth: 530,
  railDrop: 50,
  railDeduction: 2,
  railDiameter: 25,
  minLongHangH: 1300,
  minDoubleHangH: 1750,
  shelfSpacing: 350,
  minShelfGap: 150,
  shelfFrontSetback: 20,
  shelfBackClearance: MACHINING_CONFIG.backGroove.shelfClearance,
  shelfSideClearance: 1,
  maxShelfSpan: 900,
  drawerH: 200,
  drawerFrontGap: 3,
  drawerSpacerT: 25,
  drawerBoxT: 12,
  drawerBottomT: 8,
  runnerClearance: 13,
  drawerBoxHDeduction: 50,
  runnerLengths: [250, 300, 350, 400, 450, 500, 550],
  slidingOverlap: 40,
  slidingTrackDepth: 100,
  slidingHDeduction: 50,
  maxSlidingDoorW: 1100,
  edgeCarcass: 1,
  edgeFront: 1,
  sheetL: 2440,
  sheetW: 1220,
  wasteFactor: 1.15,
}

export const STANDARD_FIELD_GROUPS = [
  { id: 'materials', fields: ['carcassT', 'frontT', 'backT', 'edgeCarcass', 'edgeFront', 'sheetL', 'sheetW', 'wasteFactor'] },
  { id: 'construction', fields: ['grooveDepth', 'grooveSetback', 'backClearance', 'plinthH', 'plinthSetback', 'legsPerSection', 'maxCarcassH', 'minLoftH'] },
  { id: 'sizes', fields: ['maxSectionW', 'minSectionW', 'maxDoorW', 'doorGap', 'maxShelfSpan', 'shelfSpacing', 'minShelfGap'] },
  { id: 'interior', fields: ['shelfFrontSetback', 'shelfBackClearance', 'shelfSideClearance', 'minHangDepth', 'railDrop', 'railDeduction', 'minLongHangH', 'minDoubleHangH'] },
  { id: 'drawers', fields: ['drawerH', 'drawerFrontGap', 'drawerSpacerT', 'drawerBoxT', 'drawerBottomT', 'runnerClearance', 'drawerBoxHDeduction'] },
  { id: 'sliding', fields: ['slidingOverlap', 'slidingTrackDepth', 'slidingHDeduction', 'maxSlidingDoorW'] },
]

const STORAGE_KEY = 'woodcalc.wardrobeStandard.v1'

export function normalizeStandard(raw) {
  const out = { ...DEFAULT_WARDROBE_STANDARD }
  if (!raw || typeof raw !== 'object') return out
  Object.keys(DEFAULT_WARDROBE_STANDARD).forEach((k) => {
    if (k === 'runnerLengths') {
      if (Array.isArray(raw[k]) && raw[k].every((n) => Number(n) > 0)) out[k] = raw[k].map(Number).sort((a, b) => a - b)
      return
    }
    if (raw[k] === null || raw[k] === undefined || raw[k] === '') return
    const n = Number(raw[k])
    if (Number.isFinite(n) && n >= 0) out[k] = n
  })
  return out
}

export function loadStandard() {
  try {
    return normalizeStandard(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'))
  } catch {
    return normalizeStandard(null)
  }
}

export function saveStandard(std) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(std))
  } catch {}
}
