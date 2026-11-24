import { describe, it, expect } from 'vitest'
import { normalizeProductionPricing, boardRate, boardsNeeded, cuttingCost, assemblyCategory, assemblyCost, DEFAULT_PRODUCTION_PRICING } from './productionPricing'
import { computeProposalTotals } from './ProposalTab'

const t = (k, vars) => (vars ? `${k} ${JSON.stringify(vars)}` : k)

describe('production pricing settings', () => {
  it('fills a company with no saved settings with the defaults', () => {
    expect(normalizeProductionPricing(undefined)).toEqual(DEFAULT_PRODUCTION_PRICING)
    expect(normalizeProductionPricing({ waste_pct: 15 }).assembly_cab).toBe(7)
    expect(normalizeProductionPricing({ waste_pct: -3 }).waste_pct).toBe(10)
    expect(normalizeProductionPricing({ category_multipliers: { tall: 1.5 } }).category_multipliers)
      .toEqual({ base: 1, wall: 1, tall: 1.5, drawer: 1 })
  })

  it('matches a board size in either orientation, else prices it per m²', () => {
    const p = DEFAULT_PRODUCTION_PRICING
    expect(boardRate(2440, 1220, p)).toMatchObject({ rate: 6, fromTable: true, size: { width: 1220, height: 2440 } })
    expect(boardRate(2100, 2800, p)).toMatchObject({ rate: 10, fromTable: true })
    const other = boardRate(2800, 2070, p)
    expect(other.fromTable).toBe(false)
    expect(other.rate).toBeCloseTo(2 * 2.8 * 2.07)
  })
})

describe('boards needed', () => {
  it('is ceil(area x (1 + waste) / board area)', () => {
    const board = { width: 2440, height: 1220 } // 2.9768 m²
    expect(boardsNeeded(2.9768, board, 0)).toBe(1)
    expect(boardsNeeded(2.9768, board, 10)).toBe(2)
    expect(boardsNeeded(5.0, board, 10)).toBe(2)   // 5.5 / 2.9768 = 1.85
    expect(boardsNeeded(0, board, 10)).toBe(0)
  })

  it('counts each material on its own board size and groups the summary by size', () => {
    const materialsMap = { OAK: { name: 'Oak', board_width: 2800, board_height: 2100 } }
    const res = cuttingCost({
      OAK: { code: 'OAK', label: 'Oak', m2: 10 },                // 11 / 5.88 -> 2 boards @ 10
      'generic:sheet18_m2': { code: null, label: 'PB', m2: 6 },   // 6.6 / 2.9768 -> 3 boards @ 6
    }, materialsMap, DEFAULT_PRODUCTION_PRICING)
    expect(res.total).toBe(2 * 10 + 3 * 6)
    expect(res.boards).toBe(5)
    expect(res.bySize.map(s => [s.board.width, s.board.height, s.boards, s.rate]))
      .toEqual([[2800, 2100, 2, 10], [1220, 2440, 3, 6]])
  })

  it("uses a cutting job's actual sheets for that material instead of the estimate", () => {
    const res = cuttingCost(
      { W18: { code: 'W18', label: 'White', m2: 20 }, OAK: { code: 'OAK', label: 'Oak', m2: 2 } },
      {}, DEFAULT_PRODUCTION_PRICING,
      [{ material_sku: 'W18', width: 2440, height: 1220, sheets: 4 }],
    )
    const white = res.rows.filter(r => r.code === 'W18')
    expect(white).toHaveLength(1)
    expect(white[0]).toMatchObject({ boards: 4, source: 'cutting_job' })
    expect(res.rows.find(r => r.code === 'OAK')).toMatchObject({ boards: 1, source: 'estimate' })
  })
})

describe('assembly', () => {
  it('sorts cabinets into base, wall, tall and drawer', () => {
    expect(assemblyCategory({ category: 'base', subtype: 'Drawers' })).toBe('drawer')
    expect(assemblyCategory({ category: 'base', subtype: '2Drw+Door' })).toBe('drawer')
    expect(assemblyCategory({ category: 'tall', subtype: 'Pantry' })).toBe('tall')
    expect(assemblyCategory({ category: 'wall' })).toBe('wall')
    expect(assemblyCategory({ category: 'corner' })).toBe('base')
  })

  it('charges rate x category multiplier per cabinet', () => {
    const res = assemblyCost(
      [{ category: 'base' }, { category: 'base' }, { category: 'tall' }],
      { assembly_cab: 7, category_multipliers: { tall: 2 } },
    )
    expect(res.rows).toEqual([
      { category: 'base', count: 2, multiplier: 1, rate: 7, cost: 14 },
      { category: 'tall', count: 1, multiplier: 2, rate: 14, cost: 14 },
    ])
    expect(res.total).toBe(28)
  })
})

describe('proposal totals', () => {
  const cabinets = [
    { id: 1, category: 'base', subtype: 'Door', width: 600, height: 720, depth: 560, doorStyle: 'Handle', material: 'particleboard' },
    { id: 2, category: 'wall', subtype: 'Door', width: 600, height: 700, depth: 300, doorStyle: 'Handle', material: 'particleboard' },
  ]

  it('adds cutting and assembly, then overhead before margin', () => {
    const base = computeProposalTotals({ cabinets, margin: 0, extras: [], t })
    expect(base.assembly.total).toBe(14)
    expect(base.cutting.total).toBeGreaterThan(0)
    expect(base.cabinetsSubtotal).toBeCloseTo(base.pricedCabinets.reduce((s, c) => s + c.pricing.materialCost + c.pricing.hardwareCost, 0) + base.cutting.total + base.assembly.total)
    expect(base.costSubtotal).toBeCloseTo(base.cabinetsSubtotal + base.unallocatedCutting + base.countertopCost)
    expect(base.overheadAmount).toBe(0)

    const withOverhead = computeProposalTotals({ cabinets, margin: 20, extras: [], production: { overhead_pct: 10 }, t })
    expect(withOverhead.overheadAmount).toBeCloseTo(base.costSubtotal * 0.1)
    expect(withOverhead.marginAmount).toBeCloseTo(base.costSubtotal * 1.1 * 0.2)
  })

  it('still prices a proposal saved with the old CNC/labor rates, ignoring them', () => {
    const old = computeProposalTotals({ cabinets, margin: 30, extras: [], prices: { sheet18_m2: 12, machining_cab: 15, labor_cab: 20 }, t })
    const fresh = computeProposalTotals({ cabinets, margin: 30, extras: [], t })
    expect(Number.isFinite(old.grandTotal)).toBe(true)
    expect(old.grandTotal).toBeCloseTo(fresh.grandTotal)
    old.pricedCabinets.forEach(c => expect(c.pricing.total).toBeGreaterThan(0))
  })
})
