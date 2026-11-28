import { describe, it, expect } from 'vitest'
import { computeProposalTotals } from './ProposalTab'
import { ledStripMetersFor } from './formulaEngine'

const t = (k) => k
const box = (extra = {}) => ({
  id: 'ob', category: 'wall', subtype: 'Open Shelf', width: 800, height: 1000, depth: 300,
  shelfCount: 2, material: 'particleboard', doorStyle: 'Handle', shelfMaterial: 'wood', ...extra,
})
const priced = (cab, prices) => computeProposalTotals({ cabinets: [cab], prices, t }).pricedCabinets[0].pricing
const ledRow = (p) => p.breakdown.find(r => r.label === 'proposalTab.breakdownLedStrip')

describe('LED strip pricing', () => {
  it('adds every LED option of a cabinet', () => {
    expect(ledStripMetersFor(box({ ledStripInterior: true, ledStripUnder: true, ledStripShelves: true })))
      .toBeCloseTo(2 * 1.0 + 0.8 + 2 * 0.76)
  })

  it('prices the meters as hardware with its own breakdown line', () => {
    const without = priced(box(), { led_strip_m: 10 })
    const withLed = priced(box({ ledStripShelves: true }), { led_strip_m: 10 })
    expect(ledRow(without)).toBeUndefined()
    expect(ledRow(withLed)).toMatchObject({ unit: 10, cost: 15.2 })
    expect(withLed.hardwareCost - without.hardwareCost).toBeCloseTo(15.2)
  })

  it('falls back to the default rate for rooms saved without one', () => {
    expect(ledRow(priced(box({ ledStripShelves: true }), {})).unit).toBe(8)
  })
})
