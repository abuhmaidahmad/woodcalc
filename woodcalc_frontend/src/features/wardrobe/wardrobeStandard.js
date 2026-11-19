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
  minDrawerBoxH: 70,
  spacerBoardSku: '',
  runnerLengths: [250, 300, 350, 400, 450, 500, 550],
  slidingHDeduction: 50,
  slidingMaxDoorW: 1000,
  slidingMaxDoorH: 2750,
  slidingDoorPrice: 60,
  slidingWideDoorPrice: 70,
  slidingMirrorPriceM2: 15,
  slidingChannelW: 80,
  slidingCoverT: 18,
  slidingCoverH: 100,
  slidingTolerance: 1,
  slidingOverlap: 45,
  edgeCarcass: 1,
  edgeFront: 1,
  sheetL: 2440,
  sheetW: 1220,
  wasteFactor: 1.15,
  backRailH: 100,
  backRailCount: 2,
  wallClearance: 10,
  partitionStagger: 16,
  grooveStagger: 20,
  minGrooveBacking: 10,
  minConfirmatEdge: 30,
  minConfirmatSpacing: 30,
  railStagger: 80,
  connectorsPerJoint: 4,
  connectorDiameter: 5,
  connectorEdge: 100,
  connectorInset: 50,
  priceCarcassConnector: 0.6,
  hingeStagger: 64,
  hingePlateFront: 37,
  hingePlateSpacing: 32,
  hingePlateDiameter: 5,
  hingePlateDepth: 12,
  runnerHoleDiameter: 4,
  runnerHoleDepth: 12,
  runnerStagger: 32,
  railSocketHoles: 2,
  railSocketSpacing: 32,
  railSocketDiameter: 4,
  railSocketDepth: 12,
  railSocketStagger: 32,
  sideJoin: 'full',
  partitionJoin: 'between',
  priceBoardCarcass: 28,
  priceBoardFront: 45,
  priceBoardBack: 9,
  priceBoardDrawer: 26,
  priceEdgeM: 0.25,
  priceHinge: 1.2,
  priceRunnerPair: 8,
  priceRailM: 3,
  priceRailSocket: 0.4,
  priceLeg: 0.8,
  priceSlidingTrackSet: 25,
  priceHandle: 3.5,
  priceConfirmat: 0.1,
  priceShelfPin: 0.05,
  labourPct: 20,
  marginPct: 30,
  closetCornerGap: 50,
  minWalkway: 700,
  islandTopOverhang: 20,
}

export const STANDARD_STRINGS = new Set(['spacerBoardSku'])

export const STANDARD_ENUMS = {
  sideJoin: ['full', 'between'],
  partitionJoin: ['between', 'full'],
}

export const STANDARD_FIELD_GROUPS = [
  { id: 'materials', fields: ['carcassT', 'frontT', 'backT', 'edgeCarcass', 'edgeFront', 'sheetL', 'sheetW', 'wasteFactor'] },
  { id: 'construction', fields: ['grooveDepth', 'grooveSetback', 'backClearance', 'plinthH', 'plinthSetback', 'legsPerSection', 'maxCarcassH', 'minLoftH'] },
  { id: 'sizes', fields: ['maxSectionW', 'minSectionW', 'maxDoorW', 'doorGap', 'maxShelfSpan', 'shelfSpacing', 'minShelfGap'] },
  { id: 'interior', fields: ['shelfFrontSetback', 'shelfBackClearance', 'shelfSideClearance', 'minHangDepth', 'railDrop', 'railDeduction', 'minLongHangH', 'minDoubleHangH'] },
  { id: 'drawers', fields: ['drawerH', 'drawerFrontGap', 'drawerSpacerT', 'drawerBoxT', 'drawerBottomT', 'runnerClearance', 'drawerBoxHDeduction', 'minDrawerBoxH', 'spacerBoardSku'] },
  { id: 'sliding', fields: ['slidingHDeduction'] },
  { id: 'shared', fields: ['sideJoin', 'partitionJoin', 'backRailCount', 'backRailH', 'wallClearance', 'partitionStagger', 'grooveStagger', 'minGrooveBacking', 'minConfirmatEdge', 'minConfirmatSpacing', 'railStagger', 'connectorsPerJoint', 'connectorDiameter', 'connectorEdge', 'connectorInset'] },
  { id: 'closet', fields: ['closetCornerGap', 'minWalkway', 'islandTopOverhang'] },
  { id: 'cnc', fields: ['hingeStagger', 'hingePlateFront', 'hingePlateSpacing', 'hingePlateDiameter', 'hingePlateDepth', 'runnerHoleDiameter', 'runnerHoleDepth', 'runnerStagger', 'railSocketHoles', 'railSocketSpacing', 'railSocketDiameter', 'railSocketDepth', 'railSocketStagger'] },
  { id: 'prices', fields: ['priceBoardCarcass', 'priceBoardFront', 'priceBoardBack', 'priceBoardDrawer', 'priceEdgeM', 'priceHinge', 'priceRunnerPair', 'priceRailM', 'priceRailSocket', 'priceLeg', 'priceSlidingTrackSet', 'priceHandle', 'priceConfirmat', 'priceShelfPin', 'priceCarcassConnector', 'labourPct', 'marginPct'] },
]

export const DECIMAL_FIELDS = new Set(['wasteFactor', 'priceCarcassConnector', 'priceBoardCarcass', 'priceBoardFront', 'priceBoardBack', 'priceBoardDrawer', 'priceEdgeM', 'priceHinge', 'priceRunnerPair', 'priceRailM', 'priceRailSocket', 'priceLeg', 'priceSlidingTrackSet', 'priceHandle', 'priceConfirmat', 'priceShelfPin'])

const STORAGE_KEY = 'woodcalc.wardrobeStandard.v1'

export function normalizeStandard(raw) {
  const out = { ...DEFAULT_WARDROBE_STANDARD }
  if (!raw || typeof raw !== 'object') return out
  Object.keys(DEFAULT_WARDROBE_STANDARD).forEach((k) => {
    if (k === 'runnerLengths') {
      if (Array.isArray(raw[k]) && raw[k].every((n) => Number(n) > 0)) out[k] = raw[k].map(Number).sort((a, b) => a - b)
      return
    }
    if (STANDARD_STRINGS.has(k)) {
      if (typeof raw[k] === 'string') out[k] = raw[k].trim()
      return
    }
    if (STANDARD_ENUMS[k]) {
      if (STANDARD_ENUMS[k].includes(raw[k])) out[k] = raw[k]
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

export const TENANT_SLIDING_FIELDS = {
  max_door_width_mm: 'slidingMaxDoorW',
  max_door_height_mm: 'slidingMaxDoorH',
  standard_door_price: 'slidingDoorPrice',
  wide_door_price: 'slidingWideDoorPrice',
  mirror_price_m2: 'slidingMirrorPriceM2',
  channel_width_mm: 'slidingChannelW',
  cover_panel_thickness_mm: 'slidingCoverT',
  cover_panel_height_mm: 'slidingCoverH',
  partition_tolerance_mm: 'slidingTolerance',
  door_overlap_mm: 'slidingOverlap',
}

export function slidingStd(settings) {
  const out = {}
  if (!settings) return out
  Object.entries(TENANT_SLIDING_FIELDS).forEach(([api, key]) => {
    const n = Number(settings[api])
    if (Number.isFinite(n) && n >= 0) out[key] = n
  })
  return out
}
