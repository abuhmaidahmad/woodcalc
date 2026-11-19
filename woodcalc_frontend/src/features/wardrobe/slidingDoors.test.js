import { describe, it, expect } from 'vitest'
import { DEFAULT_WARDROBE_STANDARD as STD, slidingStd, normalizeStandard } from './wardrobeStandard'
import { computeWardrobe, defaultDesign, slidingDoorWidth, slidingDoorCount } from './wardrobeEngine'
import { defaultCloset, computeCloset } from './closetEngine'
import { priceWardrobe } from './wardrobePricing'
import { piecesFromParts } from './wardrobePieces'

const sliding = (extra = {}) => ({ ...defaultDesign(STD), doorType: 'sliding', ...extra })

describe('sliding door settings', () => {
  it('has the spec defaults', () => {
    expect(STD).toEqual(expect.objectContaining({
      slidingMaxDoorW: 1000, slidingMaxDoorH: 2750, slidingDoorPrice: 60, slidingWideDoorPrice: 70,
      slidingMirrorPriceM2: 15, slidingChannelW: 80, slidingCoverT: 18, slidingTolerance: 1, slidingOverlap: 45,
    }))
  })

  it('maps the company settings onto the standard', () => {
    const s = slidingStd({ max_door_width_mm: '900.0', standard_door_price: '62.50', door_overlap_mm: '40.0', mirror_price_m2: 'x' })
    expect(s).toEqual({ slidingMaxDoorW: 900, slidingDoorPrice: 62.5, slidingOverlap: 40 })
    expect(normalizeStandard({ ...STD, ...s }).slidingOverlap).toBe(40)
  })
})

describe('sliding door formula', () => {
  it('uses (opening + (n - 1) x overlap) / n', () => {
    expect(slidingDoorWidth(2364, 3, 45)).toBe(818)
    expect(slidingDoorWidth(1964, 2, 45)).toBe(1004.5)
  })

  it('picks the fewest doors that stay within the max width, never under two', () => {
    expect(slidingDoorCount(2364, STD)).toBe(3)
    expect(slidingDoorCount(1955, STD)).toBe(2)
    expect(slidingDoorCount(1956, STD)).toBe(3)
    expect(slidingDoorCount(800, STD)).toBe(2)
  })

  it('prices a door wider than the max width at the wide price', () => {
    const r = computeWardrobe(sliding({ slidingDoors: 2 }), STD)
    expect(r.bought[0]).toEqual(expect.objectContaining({ qty: 2, W: 1204.5, wide: true, unit: 70 }))
    expect(r.warnings.map((w) => w.code)).toContain('slidingDoorWide')
    const p = priceWardrobe(r, STD)
    expect(p.bought[0].cost).toBe(140)
  })

  it('flags doors taller than the max height', () => {
    const r = computeWardrobe(sliding({ height: 3200, loft: false }), STD)
    expect(r.bought[0].H).toBe(3050)
    expect(r.warnings.find((w) => w.code === 'slidingDoorTooTall').params).toEqual({ h: 3050, max: 2750 })
    expect(computeWardrobe(sliding(), STD).warnings.map((w) => w.code)).not.toContain('slidingDoorTooTall')
  })

  it('follows the company settings', () => {
    const std = { ...STD, slidingMaxDoorW: 1300, slidingDoorPrice: 80, slidingOverlap: 50 }
    const r = computeWardrobe(sliding(), std)
    expect(r.bought[0]).toEqual(expect.objectContaining({ qty: 2, W: (2364 + 50) / 2, unit: 80 }))
  })
})

describe('sliding door pricing', () => {
  it('adds doors and, when on, the inside mirror to the selling price', () => {
    const plain = priceWardrobe(computeWardrobe(sliding(), STD), STD, { labourPct: 0, marginPct: 0 })
    expect(plain.bought).toEqual([expect.objectContaining({ key: 'slidingDoor', qty: 3, cost: 180 })])
    const mirrored = priceWardrobe(computeWardrobe(sliding({ slidingMirror: true }), STD), STD, { labourPct: 0, marginPct: 0 })
    const mirror = mirrored.bought.find((b) => b.key === 'slidingMirror')
    expect(mirror.qty).toBe(4.79)
    expect(mirror.cost).toBeCloseTo(4.79 * 15, 6)
    expect(mirrored.grandTotal - plain.grandTotal).toBeCloseTo(mirror.cost * 1.16, 6)
  })

  it('prices the cover panel as front board', () => {
    const a = priceWardrobe(computeWardrobe(sliding(), STD), STD)
    const b = priceWardrobe(computeWardrobe(sliding({ slidingCover: true }), STD), STD)
    const front = (p) => p.boards.find((x) => x.material === 'Front' && x.T === 18)?.areaM2 || 0
    expect(front(b) - front(a)).toBeCloseTo((2364 * 100) / 1e6, 2)
  })
})

describe('sliding doors in closets and work orders', () => {
  it('lets each closet run take sliding doors, a cover and a mirror', () => {
    const closet = defaultCloset(STD)
    const c = { ...closet, runs: { ...closet.runs, A: { ...closet.runs.A, doorType: 'sliding', slidingCover: true, slidingMirror: true } } }
    const r = computeCloset(c, STD)
    expect(r.bought.map((b) => b.key)).toEqual(['slidingDoor', 'slidingMirror'])
    expect(r.parts.some((p) => p.name === 'Cover panel')).toBe(true)
  })

  it('puts the cover panel in the cut list pieces', () => {
    const ps = piecesFromParts(computeWardrobe(sliding({ slidingCover: true }), STD).rawParts, { woNumber: 'WO1' })
    expect(ps.find((p) => p.name === 'Cover panel')).toEqual(expect.objectContaining({ id: 'WO1-R0-00-CV1', length: 2364, width: 100, kind: 'front' }))
  })
})
