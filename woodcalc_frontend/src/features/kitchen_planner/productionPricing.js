// Production service pricing for the proposal: cutting & edge banding charged per
// board, assembly charged per cabinet, and an optional overhead percentage.
// These replace the old flat per-cabinet "CNC Machining" and "Labor" rates.
//
// The rates are company settings (CompanySettings.flags.production_pricing on
// the backend), not per-proposal values -- see useProductionPricing in
// api/companySettings.js. Everything here is pure so the Proposal tab and the
// planner's saved grand total compute the same numbers.

export const ASSEMBLY_CATEGORIES = ['base', 'wall', 'tall', 'drawer']

export const DEFAULT_PRODUCTION_PRICING = {
  // Cutting & edge banding charged per board, by board size (either orientation).
  board_rates: [
    { width: 1220, height: 2440, rate: 6 },
    { width: 2800, height: 2100, rate: 10 },
  ],
  // Per m² of board for a board size the table doesn't list (6 JD / 2.98 m²).
  fallback_rate_m2: 2,
  // Offcut allowance added to the part area before counting boards.
  waste_pct: 10,
  assembly_cab: 7,
  category_multipliers: { base: 1, wall: 1, tall: 1, drawer: 1 },
  overhead_pct: 0,
}

// A material with no board size set is assumed to be a standard board -- the
// same default the backend's Material.board_width/board_height use.
const DEFAULT_BOARD = { width: 2440, height: 1220 }

const num = (v, fallback) => {
  const n = Number(v)
  return v !== null && v !== '' && Number.isFinite(n) && n >= 0 ? n : fallback
}

// Fills any missing or invalid setting with its default, so a company that has
// never saved these settings (or saved only some) still prices correctly.
export function normalizeProductionPricing(raw) {
  const d = DEFAULT_PRODUCTION_PRICING
  const r = raw && typeof raw === 'object' ? raw : {}
  // Rows keep a 0 size while one is being typed in; boardRate never matches them.
  const board_rates = Array.isArray(r.board_rates)
    ? r.board_rates.map(x => ({ width: num(x?.width, 0), height: num(x?.height, 0), rate: num(x?.rate, 0) }))
    : d.board_rates.map(x => ({ ...x }))
  const category_multipliers = {}
  ASSEMBLY_CATEGORIES.forEach(c => { category_multipliers[c] = num(r.category_multipliers?.[c], 1) })
  return {
    board_rates,
    fallback_rate_m2: num(r.fallback_rate_m2, d.fallback_rate_m2),
    waste_pct: num(r.waste_pct, d.waste_pct),
    assembly_cab: num(r.assembly_cab, d.assembly_cab),
    category_multipliers,
    overhead_pct: num(r.overhead_pct, d.overhead_pct),
  }
}

const sameSize = (a, b) =>
  (Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1) ||
  (Math.abs(a.width - b.height) < 1 && Math.abs(a.height - b.width) < 1)

// Cutting & banding rate for one board of this size: the table's rate when the
// size is listed, else the per-m² fallback times the board's area. `size` is
// the board size as the table lists it (its orientation), for display.
export function boardRate(width, height, pricing) {
  const p = normalizeProductionPricing(pricing)
  const hit = p.board_rates.find(r => r.width > 0 && r.height > 0 && sameSize(r, { width, height }))
  if (hit) return { rate: hit.rate, fromTable: true, size: { width: hit.width, height: hit.height } }
  return { rate: p.fallback_rate_m2 * width * height / 1e6, fromTable: false, size: { width, height } }
}

export function boardSizeFor(code, materialsMap = {}) {
  const mat = code ? materialsMap[code] : null
  const w = Number(mat?.board_width), h = Number(mat?.board_height)
  return w > 0 && h > 0 ? { width: w, height: h } : { ...DEFAULT_BOARD }
}

// Boards needed for a material: ceil(part area x (1 + waste) / board area).
export function boardsNeeded(partM2, board, wastePct) {
  const boardM2 = board.width * board.height / 1e6
  if (!(partM2 > 0) || !(boardM2 > 0)) return 0
  // The epsilon keeps float noise (e.g. 2.9768000000000003) from adding a board.
  return Math.ceil(partM2 * (1 + wastePct / 100) / boardM2 - 1e-9)
}

// cutAreas: { [key]: { code, label, m2 } } -- total part area per material, keyed
// by the material's catalog code (or a generic key when a part has none).
// sheetUsage: [{ material_sku, width, height, sheets }] -- actual sheets from the
// room's optimized cutting jobs. A material with any actual usage is counted from
// it instead of the estimate; each material is otherwise estimated from its area.
export function cuttingCost(cutAreas, materialsMap, pricing, sheetUsage = []) {
  const p = normalizeProductionPricing(pricing)
  const actual = new Map()
  for (const u of sheetUsage || []) {
    const sheets = Number(u.sheets)
    if (!u.material_sku || !(sheets > 0)) continue
    if (!actual.has(u.material_sku)) actual.set(u.material_sku, [])
    actual.get(u.material_sku).push({ width: Number(u.width), height: Number(u.height), sheets })
  }

  const rows = []
  const push = (code, label, board, boards, source, m2 = null) => {
    if (!(boards > 0)) return
    const { rate, fromTable, size } = boardRate(board.width, board.height, p)
    rows.push({ code, label, board: size, boards, rate, fromTable, cost: boards * rate, source, m2 })
  }

  for (const [key, area] of Object.entries(cutAreas || {})) {
    if (area.code && actual.has(area.code)) continue
    const board = boardSizeFor(area.code, materialsMap)
    push(area.code || null, area.label || key, board, boardsNeeded(area.m2, board, p.waste_pct), 'estimate', area.m2)
  }
  for (const [sku, sizes] of actual) {
    const label = materialsMap[sku]?.name || sku
    sizes.forEach(s => push(sku, label, { width: s.width, height: s.height }, s.sheets, 'cutting_job'))
  }

  // One summary line per board size (and rate): boards x rate.
  const bySizeMap = new Map()
  rows.forEach(r => {
    const k = `${Math.min(r.board.width, r.board.height)}x${Math.max(r.board.width, r.board.height)}@${r.rate}`
    const e = bySizeMap.get(k) || { board: r.board, rate: r.rate, fromTable: r.fromTable, boards: 0, cost: 0, materials: [] }
    e.boards += r.boards
    e.cost += r.cost
    e.materials.push({ label: r.label, boards: r.boards, source: r.source })
    bySizeMap.set(k, e)
  })
  const bySize = [...bySizeMap.values()]
  const total = round2(rows.reduce((s, r) => s + r.cost, 0))
  return { rows, bySize, total, boards: rows.reduce((s, r) => s + r.boards, 0) }
}

// Which assembly multiplier a cabinet takes. Drawer cabinets (any category) are
// 'drawer'; tall and wall by their category; everything else (base, vanity,
// corner, specialty) assembles like a base cabinet.
export function assemblyCategory(cab) {
  if (/drawer|drw/i.test(cab.subtype || '')) return 'drawer'
  if (cab.category === 'tall') return 'tall'
  if (cab.category === 'wall') return 'wall'
  return 'base'
}

// cabinets: the cabinets that are assembled (carcass cabinets -- not flat
// pieces or appliance placeholders). One line per category: count x rate.
export function assemblyCost(cabinets, pricing) {
  const p = normalizeProductionPricing(pricing)
  const counts = {}
  cabinets.forEach(c => { const k = assemblyCategory(c); counts[k] = (counts[k] || 0) + 1 })
  const rows = ASSEMBLY_CATEGORIES.filter(k => counts[k]).map(k => {
    const multiplier = p.category_multipliers[k]
    const rate = p.assembly_cab * multiplier
    return { category: k, count: counts[k], multiplier, rate, cost: round2(counts[k] * rate) }
  })
  return { rows, count: cabinets.length, rate: p.assembly_cab, total: round2(rows.reduce((s, r) => s + r.cost, 0)) }
}

function round2(n) { return Math.round(n * 100) / 100 }
