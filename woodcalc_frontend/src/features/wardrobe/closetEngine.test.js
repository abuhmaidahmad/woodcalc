import { describe, it, expect } from 'vitest'
import { DEFAULT_WARDROBE_STANDARD as STD } from './wardrobeStandard'
import { computeWardrobe } from './wardrobeEngine'
import { defaultCloset, closetLayout, computeCloset, computeDesign, withConstruction, runDesign, fitRunSections } from './closetEngine'
import { priceWardrobe } from './wardrobePricing'

const qty = (res, name) => res.parts.filter((p) => p.name === name).reduce((a, p) => a + p.qty, 0)

describe('closet layout and corners', () => {
  const closet = defaultCloset(STD)

  it('lets the back run own both corners and starts the side runs after it', () => {
    const l = closetLayout(closet, STD)
    expect(l.walls).toEqual(['B', 'A', 'C'])
    expect(l.runs.A).toEqual(expect.objectContaining({ start: 0, end: 0, length: 3000 }))
    expect(l.runs.B).toEqual(expect.objectContaining({ start: 0, end: 650, length: 1950 }))
    expect(l.runs.C).toEqual(expect.objectContaining({ start: 650, end: 0, length: 1950 }))
    expect(l.warnings).toEqual([])
  })

  it('keeps the side runs out of the back run footprint', () => {
    const l = closetLayout(closet, STD)
    const bNearCorner = l.runs.B.origin[1] + l.runs.B.u[1] * l.runs.B.length
    expect(bNearCorner).toBeGreaterThanOrEqual(l.runs.A.depth)
    const cStart = l.runs.C.origin[1]
    expect(cStart).toBeGreaterThanOrEqual(l.runs.A.depth)
  })

  it('can give the corners to the side runs or leave them empty', () => {
    const side = closetLayout({ ...closet, corners: { AB: 'side', AC: 'side' } }, STD)
    expect(side.runs.A).toEqual(expect.objectContaining({ start: 630, end: 630, length: 1740 }))
    expect(side.runs.B.length).toBe(2600)
    const empty = closetLayout({ ...closet, corners: { AB: 'empty', AC: 'empty' } }, STD)
    expect(empty.runs.A.length).toBe(3000 - 2 * 580)
    expect(empty.runs.B.length).toBe(2600 - 600)
  })

  it('uses only the walls of the chosen shape', () => {
    expect(closetLayout({ ...closet, shape: 'straight' }, STD).walls).toEqual(['A'])
    const l = closetLayout({ ...closet, shape: 'L' }, STD)
    expect(l.walls).toEqual(['B', 'A'])
  })

  it('warns when the walkway between facing runs is too narrow', () => {
    const l = closetLayout({ ...closet, width: 1800 }, STD)
    expect(l.warnings.find((w) => w.code === 'walkwayNarrow').params.w).toBe(1800 - 1160)
  })

  it('places an island in the middle and checks clearances', () => {
    const l = closetLayout({ ...closet, island: { ...closet.island, enabled: true } }, STD)
    expect(l.island).toEqual(expect.objectContaining({ x: 900, y: 1300, w: 1200, d: 600 }))
    expect(l.island.clearance).toEqual({ A: 700, B: 320, C: 320, entrance: 700 })
    expect(l.warnings.filter((w) => w.code === 'islandClearance').map((w) => w.params.side)).toEqual(['B', 'C'])
  })
})

describe('closet cut list', () => {
  const closet = defaultCloset(STD)
  const res = computeCloset(closet, STD)

  it('starts with sections that pass the standard', () => {
    expect(closet.runs.A.sections).toHaveLength(4)
    expect(closet.runs.B.sections).toHaveLength(3)
    expect(res.warnings).toEqual([])
  })

  it('is open by default and adds up every run', () => {
    expect(res.summary.doorCount).toBe(0)
    expect(res.summary.runCount).toBe(3)
    const one = computeWardrobe(runDesign(closet, 'A', 3000), STD)
    expect(qty(res, 'Partition')).toBe(qty(one, 'Partition') + 2 + 2)
    const sides = res.parts.filter((p) => p.name === 'Side')
    expect(sides.flatMap((p) => p.sections).sort()).toEqual(['A', 'B', 'C'])
    expect(sides.find((p) => p.W === 580).qty).toBe(4)
  })

  it('uses the same pricing as a wardrobe', () => {
    const p = priceWardrobe(res, STD)
    expect(p.grandTotal).toBeGreaterThan(0)
    expect(p.sheetCount).toBe(res.materials.reduce((a, m) => a + Math.ceil((m.areaM2 * STD.wasteFactor) / 2.9768), 0))
  })

  it('adds doors per run when asked', () => {
    const withDoors = { ...closet, runs: { ...closet.runs, A: { ...closet.runs.A, doorType: 'hinged' } } }
    expect(computeCloset(withDoors, STD).summary.doorCount).toBeGreaterThan(0)
  })

  it('builds a double-sided drawer island with a top', () => {
    const r = computeCloset({ ...closet, island: { ...closet.island, enabled: true } }, STD)
    expect(r.island.halves).toHaveLength(2)
    const islandFronts = r.parts.filter((p) => p.name === 'Drawer front' && p.sections.every((s) => s.startsWith('I')))
    expect(islandFronts.reduce((a, p) => a + p.qty, 0)).toBe(2 * 2 * 3)
    const top = r.parts.find((p) => p.name === 'Island top')
    expect(top).toEqual(expect.objectContaining({ L: 1240, W: 640, material: 'Front', qty: 1 }))
    expect(r.hardware.runnerPair).toBe(res.hardware.runnerPair + 12)
  })

  it('switches every run between constructions for the comparison', () => {
    const d = { mode: 'closet', closet }
    const boxes = computeDesign(withConstruction(d, 'boxes'), STD)
    const shared = computeDesign(withConstruction(d, 'shared'), STD)
    expect(boxes.summary.construction).toBe('boxes')
    expect(shared.summary.construction).toBe('shared')
    expect(priceWardrobe(shared, STD).grandTotal).toBeLessThan(priceWardrobe(boxes, STD).grandTotal)
  })

  it('refits a run to its wall length', () => {
    const wide = fitRunSections({ ...closet, width: 4500 }, 'A', STD)
    expect(wide.runs.A.sections).toHaveLength(Math.ceil(4500 / 936))
  })
  it('gives the island external full-overlay drawers by default, with no spacers', () => {
    const r = computeCloset({ ...closet, island: { ...closet.island, enabled: true } }, STD)
    const isl = (name) => r.parts.filter((p) => p.name === name && p.sections.every((s) => s.startsWith('I')))
    expect(isl('Drawer spacer')).toHaveLength(0)
    const fronts = isl('Drawer front')
    expect(fronts).toEqual([expect.objectContaining({ L: 597, W: 257.7, qty: 12 })])
    expect(3 * (257.7 + STD.drawerFrontGap)).toBeCloseTo(782, 0)
    expect(isl('Drawer front/back')[0]).toEqual(expect.objectContaining({ L: 547 - 2 * STD.drawerBoxT, W: 198.7 }))
    const half = r.island.halves[0].result
    const g = half.geometry.filter((x) => x.kind === 'drawerFront')
    expect(g[0].z).toBe(300)
    expect(g[0].y).toBeCloseTo(STD.plinthH + STD.drawerFrontGap / 2, 1)
    expect(half.warnings).toEqual([])
  })

  it('keeps internal drawers available for the island and for wardrobes', () => {
    const r = computeCloset({ ...closet, island: { ...closet.island, enabled: true, drawerStyle: 'internal' } }, STD)
    expect(r.parts.some((p) => p.name === 'Drawer spacer' && p.sections.some((s) => s.startsWith('I')))).toBe(true)
    const runA = r.runs.find((x) => x.id === 'A').result
    expect(runA.parts.some((p) => p.name === 'Drawer spacer')).toBe(true)
  })

  it('warns when external drawer boxes get too low', () => {
    const r = computeCloset({ ...closet, island: { ...closet.island, enabled: true, drawers: 7 } }, STD)
    expect(r.warnings.some((w) => w.code === 'drawersDontFit' && w.run.startsWith('I'))).toBe(true)
  })
})
