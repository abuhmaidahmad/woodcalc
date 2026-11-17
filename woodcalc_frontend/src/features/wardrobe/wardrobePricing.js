export const VAT_RATE = 0.16
export const USD_RATE = 0.71
export const MATERIAL_ROLES = ['Carcass', 'Front', 'Back', 'Drawer box']

export const ROLE_TYPES = {
  Carcass: ['carcass'],
  Front: ['front'],
  Back: ['back'],
  'Drawer box': ['carcass'],
}

const FALLBACK_KEY = {
  Carcass: 'priceBoardCarcass',
  Front: 'priceBoardFront',
  Back: 'priceBoardBack',
  'Drawer box': 'priceBoardDrawer',
}

const money = (n) => Math.round(n * 1000) / 1000
const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function boardOf(mat, std) {
  const L = num(mat?.board_width) || std.sheetL
  const W = num(mat?.board_height) || std.sheetW
  return { L, W, m2: (L * W) / 1e6 }
}

export function boardPrice(mat, std) {
  if (!mat || mat.price_per_board == null || mat.price_per_board === '') return null
  const price = num(mat.price_per_board)
  if (price <= 0) return null
  if (mat.price_unit === 'm2') return price * boardOf(mat, std).m2
  return price
}

export function boardLines(result, std, picked = {}) {
  return result.materials.map((m) => {
    const mat = picked[m.material] || null
    const thick = num(mat?.board_thickness)
    const fits = mat && (!thick || thick === m.T)
    const board = boardOf(fits ? mat : null, std)
    const catalog = fits ? boardPrice(mat, std) : null
    const unit = catalog ?? num(std[FALLBACK_KEY[m.material]])
    const sheets = board.m2 > 0 ? Math.ceil((m.areaM2 * std.wasteFactor) / board.m2) : 0
    return {
      material: m.material,
      T: m.T,
      areaM2: m.areaM2,
      sku: fits ? mat.sku : null,
      name: fits ? mat.name : null,
      board,
      sheets,
      unit,
      fromCatalog: catalog != null,
      cost: money(sheets * unit),
    }
  })
}

export function hardwareLines(hw, std) {
  const lines = [
    ['hinge', hw.hinge, std.priceHinge],
    ['runnerPair', hw.runnerPair, std.priceRunnerPair],
    ['railMeters', hw.railMeters, std.priceRailM],
    ['railBracket', hw.railBracket, std.priceRailSocket],
    ['leg', hw.leg, std.priceLeg],
    ['slidingTrackSet', hw.slidingTrack ? Math.ceil(hw.slidingTrack / 2) : 0, std.priceSlidingTrackSet],
    ['slidingKit', hw.slidingKit, std.priceSlidingKit],
    ['handles', num(hw.handle) + num(hw.drawerHandle), std.priceHandle],
    ['confirmat', hw.confirmat, std.priceConfirmat],
    ['shelfPin', hw.shelfPin, std.priceShelfPin],
  ]
  return lines
    .filter(([, qty]) => num(qty) > 0)
    .map(([key, qty, unit]) => ({ key, qty: num(qty), unit: num(unit), cost: money(num(qty) * num(unit)) }))
}

export function totalsFrom(materialSubtotal, labourPct, marginPct) {
  const labourAmount = materialSubtotal * (num(labourPct) / 100)
  const costSubtotal = materialSubtotal + labourAmount
  const marginAmount = costSubtotal * (num(marginPct) / 100)
  const afterMargin = costSubtotal + marginAmount
  const vatAmount = afterMargin * VAT_RATE
  const grandTotal = afterMargin + vatAmount
  return { labourAmount, costSubtotal, marginAmount, afterMargin, vatAmount, grandTotal }
}

export function priceWardrobe(result, std, { picked = {}, labourPct = std.labourPct, marginPct = std.marginPct } = {}) {
  const boards = boardLines(result, std, picked)
  const edgeMeters = result.edgeBanding.reduce((a, e) => a + e.meters, 0)
  const edge = { meters: Math.round(edgeMeters * 10) / 10, unit: num(std.priceEdgeM), cost: money(edgeMeters * num(std.priceEdgeM)) }
  const hardware = hardwareLines(result.hardware, std)
  const boardsCost = boards.reduce((a, b) => a + b.cost, 0)
  const hardwareCost = hardware.reduce((a, h) => a + h.cost, 0)
  const materialSubtotal = boardsCost + edge.cost + hardwareCost
  return {
    boards,
    edge,
    hardware,
    boardsCost,
    hardwareCost,
    materialSubtotal,
    sheetCount: boards.reduce((a, b) => a + b.sheets, 0),
    labourPct: num(labourPct),
    marginPct: num(marginPct),
    ...totalsFrom(materialSubtotal, labourPct, marginPct),
  }
}

export function pickMaterials(picks = {}, materials = []) {
  const bySku = new Map(materials.map((m) => [m.sku, m]))
  const out = {}
  MATERIAL_ROLES.forEach((r) => { if (picks[r] && bySku.has(picks[r])) out[r] = bySku.get(picks[r]) })
  return out
}

export const fmt = (n) => (Number(n) || 0).toFixed(2)

export function otherConstruction(design) {
  return design.construction === 'shared'
    ? { ...design, construction: 'boxes' }
    : { ...design, construction: 'shared', backType: design.backType || 'none' }
}

export function constructionName(t, design) {
  return design.construction === 'shared'
    ? `${t('wardrobe.constructionTypes.shared')} · ${t(`wardrobe.backTypes.${design.backType || 'none'}`)}`
    : t('wardrobe.constructionTypes.boxes')
}
