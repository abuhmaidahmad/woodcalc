import { describe, it, expect } from 'vitest'
import { DEFAULT_WARDROBE_STANDARD as STD } from './wardrobeStandard'
import { computeWardrobe, defaultDesign } from './wardrobeEngine'
import { priceWardrobe, boardPrice, totalsFrom, pickMaterials, hardwareLines } from './wardrobePricing'

const carcassMat = { sku: 'CAR-W18', name: 'White 18', material_type: 'carcass', price_per_board: '30.00', price_unit: 'board', board_width: 2800, board_height: 2070, board_thickness: 18 }

describe('wardrobe pricing', () => {
  const res = computeWardrobe(defaultDesign(STD), STD)

  it('uses the standard sheet and fallback price when no material is picked', () => {
    const p = priceWardrobe(res, STD)
    const carcass = p.boards.find((b) => b.material === 'Carcass' && b.T === 18)
    const m = res.materials.find((x) => x.material === 'Carcass' && x.T === 18)
    expect(carcass.sheets).toBe(m.sheets)
    expect(carcass.unit).toBe(STD.priceBoardCarcass)
    expect(carcass.cost).toBeCloseTo(m.sheets * STD.priceBoardCarcass, 6)
    expect(carcass.fromCatalog).toBe(false)
  })

  it('counts sheets on the picked board size and uses its price', () => {
    const p = priceWardrobe(res, STD, { picked: { Carcass: carcassMat } })
    const carcass = p.boards.find((b) => b.material === 'Carcass' && b.T === 18)
    const m = res.materials.find((x) => x.material === 'Carcass' && x.T === 18)
    expect(carcass.sheets).toBe(Math.ceil((m.areaM2 * STD.wasteFactor) / (2.8 * 2.07)))
    expect(carcass.unit).toBe(30)
    expect(carcass.sku).toBe('CAR-W18')
    const spacer = p.boards.find((b) => b.material === 'Carcass' && b.T === 25)
    expect(spacer.fromCatalog).toBe(false)
  })

  it('turns a per-m2 price into a board price', () => {
    expect(boardPrice({ price_per_board: 10, price_unit: 'm2', board_width: 2440, board_height: 1220 }, STD)).toBeCloseTo(10 * 2.9768, 4)
    expect(boardPrice({ price_per_board: null }, STD)).toBe(null)
  })

  it('prices hardware from the standard', () => {
    const lines = hardwareLines(res.hardware, STD)
    const hinge = lines.find((l) => l.key === 'hinge')
    expect(hinge.qty).toBe(res.hardware.hinge)
    expect(hinge.cost).toBeCloseTo(res.hardware.hinge * STD.priceHinge, 6)
    expect(lines.find((l) => l.key === 'handles').qty).toBe(res.hardware.handle + res.hardware.drawerHandle)
    expect(lines.find((l) => l.key === 'railMeters').unit).toBe(STD.priceRailM)
    const sliding = hardwareLines(computeWardrobe({ ...defaultDesign(STD), doorType: 'sliding' }, STD).hardware, STD)
    expect(sliding.find((l) => l.key === 'slidingTrackSet').qty).toBe(1)
  })

  it('adds labour, margin and 16% VAT the same way as the proposal', () => {
    const t = totalsFrom(1000, 20, 30)
    expect(t.labourAmount).toBe(200)
    expect(t.costSubtotal).toBe(1200)
    expect(t.marginAmount).toBe(360)
    expect(t.vatAmount).toBeCloseTo(1560 * 0.16, 6)
    expect(t.grandTotal).toBeCloseTo(1809.6, 6)
    const p = priceWardrobe(res, STD, { labourPct: 0, marginPct: 0 })
    expect(p.grandTotal).toBeCloseTo(p.materialSubtotal * 1.16, 6)
    expect(p.materialSubtotal).toBeCloseTo(p.boardsCost + p.edge.cost + p.hardwareCost, 6)
  })

  it('makes shared partitions cheaper than separate boxes for the same design', () => {
    const boxes = priceWardrobe(res, STD)
    const shared = priceWardrobe(computeWardrobe({ ...defaultDesign(STD), construction: 'shared' }, STD), STD)
    expect(shared.grandTotal).toBeLessThan(boxes.grandTotal)
  })

  it('picks materials by sku and ignores unknown ones', () => {
    expect(pickMaterials({ Carcass: 'CAR-W18', Front: 'NOPE' }, [carcassMat])).toEqual({ Carcass: carcassMat })
  })
})
