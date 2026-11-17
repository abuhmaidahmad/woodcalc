import { describe, it, expect } from 'vitest'
import { DEFAULT_WARDROBE_STANDARD as STD } from './wardrobeStandard'
import { computeWardrobe, defaultDesign, sectionWidths } from './wardrobeEngine'
import { defaultCloset, computeDesign } from './closetEngine'
import { priceWardrobe } from './wardrobePricing'
import { isWardrobeRoom, savedWardrobe, buildWardrobePlannerData, contractRows } from './wardrobeRoom'

describe('wardrobe rooms', () => {
  it('opens wardrobe and closet rooms in the builder but never a room with kitchen cabinets', () => {
    expect(isWardrobeRoom({ room_type: 'wardrobe', planner_data: {} })).toBe(true)
    expect(isWardrobeRoom({ room_type: 'closet', planner_data: {} })).toBe(true)
    expect(isWardrobeRoom({ room_type: 'bedroom', planner_data: { kind: 'wardrobe' } })).toBe(true)
    expect(isWardrobeRoom({ room_type: 'closet', planner_data: { cabinets: [{ id: 1 }] } })).toBe(false)
    expect(isWardrobeRoom({ room_type: 'kitchen', planner_data: {} })).toBe(false)
  })

  it('round-trips the design and frozen standard through planner_data', () => {
    const design = { ...defaultDesign(STD), construction: 'shared' }
    const result = computeWardrobe(design, STD)
    const price = priceWardrobe(result, STD)
    const data = buildWardrobePlannerData({ design, std: STD, price, result })
    expect(data.kind).toBe('wardrobe')
    expect(data.grandTotal).toBe(Math.round(price.grandTotal * 100) / 100)
    expect(data.summary.construction).toBe('shared')
    const back = savedWardrobe({ planner_data: JSON.parse(JSON.stringify(data)) })
    expect(back.design).toEqual(design)
    expect(back.standard).toEqual(STD)
    expect(savedWardrobe({ planner_data: {} })).toBe(null)
  })

  it('lists one contract row per section', () => {
    const d = defaultDesign(STD)
    const rows = contractRows(d, computeWardrobe(d, STD), sectionWidths(d), (k, p) => (p?.n ? `${k}${p.n}` : k), 'White')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual(expect.objectContaining({ id: 'S1', width: 800, height: 2600, depth: 600, material: 'White' }))
  })
  it('saves a walk-in closet and lists one contract row per run plus the island', () => {
    const closet = defaultCloset(STD)
    const design = { ...defaultDesign(STD), mode: 'closet', closet: { ...closet, island: { ...closet.island, enabled: true } } }
    const result = computeDesign(design, STD)
    const price = priceWardrobe(result, STD)
    const data = buildWardrobePlannerData({ design, std: STD, price, result })
    expect(data.summary).toEqual(expect.objectContaining({ mode: 'closet', width: 3000, depth: 2600, height: 2400 }))
    expect(savedWardrobe({ planner_data: JSON.parse(JSON.stringify(data)) }).design.closet.shape).toBe('U')
    const rows = contractRows(design, result, [], (k) => k, 'White')
    expect(rows.map((r) => r.id)).toEqual(['B', 'A', 'C', 'I'])
    expect(rows[1].width).toBe(3000)
  })
})
