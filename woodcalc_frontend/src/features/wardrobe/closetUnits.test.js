import { describe, it, expect } from 'vitest'
import { DEFAULT_WARDROBE_STANDARD as STD } from './wardrobeStandard'
import { defaultDesign, withSectionCount } from './wardrobeEngine'
import { defaultCloset, computeDesign, withUnits, withConstruction } from './closetEngine'
import { priceWardrobe } from './wardrobePricing'
import { piecesFromParts } from './wardrobePieces'
import { withClosetRoom } from './closetRoom'
import { placementFrom, unitFrame, framePolygon } from './unitGeometry'
import { PLANNER_SCALE } from '../kitchen_planner/wallGeometry'

const base = defaultDesign(STD)
const closetOf = (extra = {}) => ({ ...base, mode: 'closet', closet: { ...defaultCloset(STD), ...extra } })
const codes = (r) => r.warnings.map((w) => w.code)

describe('old closets become units', () => {
  const cases = {
    U: {},
    L: { shape: 'L', corners: { AB: 'side', AC: 'empty' } },
    straight: { shape: 'straight' },
    island: { island: { ...defaultCloset(STD).island, enabled: true } },
    singleIsland: { shape: 'straight', island: { ...defaultCloset(STD).island, enabled: true, doubleSided: false, drawerStyle: 'internal' } },
    doors: { runs: { ...defaultCloset(STD).runs, A: { ...defaultCloset(STD).runs.A, doorType: 'hinged', loft: true } } },
  }
  Object.entries(cases).forEach(([name, extra]) => {
    it(`keeps parts, hardware, price and pieces for the ${name} closet`, () => {
      const old = closetOf(extra)
      const a = computeDesign(old, STD)
      const conv = withUnits(withClosetRoom(old), STD)
      const b = computeDesign(conv, STD)
      expect(JSON.stringify(b.parts)).toBe(JSON.stringify(a.parts))
      expect(JSON.stringify(b.rawParts)).toBe(JSON.stringify(a.rawParts))
      expect(b.hardware).toEqual(a.hardware)
      expect(b.materials).toEqual(a.materials)
      expect(b.edgeBanding).toEqual(a.edgeBanding)
      expect(priceWardrobe(b, STD)).toEqual(priceWardrobe(a, STD))
      expect(JSON.stringify(piecesFromParts(b.rawParts))).toBe(JSON.stringify(piecesFromParts(a.rawParts)))
      const geo = (r) => JSON.stringify(r.units.map((u) => (u.kind === 'island' ? u.halves.map((h) => h.result.geometry) : u.result.geometry)))
      expect(geo(b)).toBe(geo(a))
      const frames = (r) => r.units.map((u) => ({ o: u.frame.origin.map(Math.round), u: u.frame.u, l: u.frame.length, d: u.frame.depth }))
      expect(frames(b)).toEqual(frames(a))
      expect(b.summary.sectionCount).toBe(a.summary.sectionCount)
      expect(b.summary.runLength).toBe(a.summary.runLength)
    })
  })

  it('labels converted units A, B, C and I and leaves converted closets alone', () => {
    const conv = withUnits(withClosetRoom(closetOf(cases.island)), STD)
    expect(conv.closet.units.map((u) => [u.label, u.kind, u.rotation])).toEqual([['B', 'wardrobe', 270], ['A', 'wardrobe', 0], ['C', 'wardrobe', 90], ['I', 'island', 0]])
    expect(withUnits(conv, STD)).toBe(conv)
    expect(withUnits(base, STD)).toBe(base)
  })

  it('gives the converted default closet no unit warnings', () => {
    const r = computeDesign(withUnits(withClosetRoom(closetOf()), STD), STD)
    expect(r.warnings.filter((w) => w.code.startsWith('unit') || w.code === 'doorsHitUnit')).toEqual([])
  })

  it('switches construction on every unit for the price comparison', () => {
    const conv = withUnits(withClosetRoom(closetOf(cases.island)), STD)
    const boxes = withConstruction(conv, 'boxes')
    expect(boxes.closet.units.every((u) => u.design.construction === 'boxes')).toBe(true)
  })
})

describe('placing units', () => {
  const wall = (x1, y1, x2, y2) => ({ id: `${x1}${y1}${x2}${y2}`, x1: x1 * PLANNER_SCALE, y1: y1 * PLANNER_SCALE, x2: x2 * PLANNER_SCALE, y2: y2 * PLANNER_SCALE, thickness: 120, thicknessSide: 'right' })
  const room = (W, D, elements = []) => ({
    walls: [wall(0, D, 0, 0), wall(0, 0, W, 0), wall(W, 0, W, D), wall(W, D, 0, D)],
    elements,
    room: { width: W, depth: D, ceilingHeight: 2700 },
  })
  const unit1 = () => {
    const d = withSectionCount({ ...base, width: 2500, height: 2400, depth: 600, fillerLeft: 40, doorType: 'hinged', loft: true, loftH: 300 }, 4, STD)
    d.sections = d.sections.map((s, i) => ({ ...s, w: [510, 600, 600, 600][i] }))
    return { id: 'u1', kind: 'wardrobe', label: 'U1', ...placementFrom([0, 0], [1, 0], 2500, 600), design: d }
  }
  const facing = (gap) => {
    const d = { ...base, width: 2000, height: 2400, depth: 600, doorType: 'hinged', loft: false }
    const back = 600 + gap + 600
    return { id: 'u2', kind: 'wardrobe', label: 'U2', ...placementFrom([2250, back], [-1, 0], 2000, 600), design: d }
  }
  const run = (units, r) => computeDesign({ ...base, mode: 'closet', closet: { height: 2400, units, room: r } }, STD)

  it('puts a free-standing unit facing the first one', () => {
    const f = unitFrame(facing(1200))
    expect(f.n).toEqual([0, -1])
    expect(framePolygon(f).map((p) => p.map(Math.round))).toEqual([[2250, 2400], [250, 2400], [250, 1800], [2250, 1800]])
  })

  it('gives no warning with 1200 between the fronts', () => {
    const r = run([unit1(), facing(1200)], room(2500, 4000))
    expect(codes(r).filter((c) => ['unitWalkway', 'doorsHitUnit', 'unitsOverlap', 'unitInWall'].includes(c))).toEqual([])
  })

  it('warns about the walkway and the doors at 600', () => {
    const r = run([unit1(), facing(600)], room(2500, 4000))
    expect(codes(r)).toEqual(expect.arrayContaining(['unitWalkway', 'doorsHitUnit']))
    expect(r.warnings.find((w) => w.code === 'unitWalkway').params).toMatchObject({ w: 600, min: STD.minWalkway })
  })

  it('flags overlaps with units, walls and columns as errors', () => {
    const col = { id: 9, type: 'column', x: 1000, y: 300, w: 335, h: 450 }
    const r = run([unit1(), { ...facing(-100), id: 'u3', label: 'U3' }], room(2400, 4000, [col]))
    const errs = r.warnings.filter((w) => w.level === 'error').map((w) => w.code)
    expect(errs).toEqual(expect.arrayContaining(['unitsOverlap', 'unitInWall', 'unitHitsColumn']))
  })

  it('warns when a unit stands in a door swing or in front of a window', () => {
    const W = 2500
    const door = { id: 1, type: 'door', embeddedInWall: true, wallIndex: 1, x: 2000, y: 0, w: 800 }
    const win = { id: 2, type: 'window', embeddedInWall: true, wallIndex: 1, x: 600, y: 0, w: 900, elevation: 900 }
    const r = run([unit1()], room(W, 4000, [door, win]))
    expect(codes(r)).toEqual(expect.arrayContaining(['unitBlocksDoor', 'unitCoversWindow']))
  })
})
