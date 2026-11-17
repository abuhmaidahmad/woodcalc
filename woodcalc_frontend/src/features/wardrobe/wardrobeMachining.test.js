import { describe, it, expect } from 'vitest'
import { DEFAULT_WARDROBE_STANDARD as STD } from './wardrobeStandard'
import { computeWardrobe, defaultDesign } from './wardrobeEngine'
import { defaultCloset, computeDesign } from './closetEngine'
import { priceWardrobe } from './wardrobePricing'
import { buildWardrobePlannerData } from './wardrobeRoom'
import { piecesFromParts } from './wardrobePieces'
import { cncExport } from '../kitchen_planner/machining/cncExport'
import { MACHINING_CONFIG } from '../kitchen_planner/machining/config'

const pieces = (design, std = STD) => piecesFromParts(computeDesign(design, std).rawParts, { woNumber: 'WO1', roomNumber: 1 })
const ops = (ps, pred) => ps.flatMap((p) => (p.part ? p.part.machining_ops.filter(pred).map((op) => ({ ...op, piece: p })) : []))
const thru = (op) => op.rule === 'confirmat' && op.type === 'HOLE'
const edge = (op) => op.rule === 'confirmat' && op.type === 'EDGE_HOLE'
const base = defaultDesign(STD)

const VARIANTS = {
  boxes: base,
  boxesSliding: { ...base, doorType: 'sliding' },
  sharedNoBack: { ...base, construction: 'shared', backType: 'none' },
  sharedFullBack: { ...base, construction: 'shared', backType: 'full' },
  sharedPerSection: { ...base, construction: 'shared', backType: 'perSection' },
  sharedWideSplit: { ...base, width: 3000, construction: 'shared' },
}
const STD_VARIANTS = {
  topOverSides: { ...STD, sideJoin: 'between' },
  fullPartitions: { ...STD, partitionJoin: 'full' },
  bothRules: { ...STD, sideJoin: 'between', partitionJoin: 'full' },
}

describe('wardrobe CNC machining', () => {
  const all = [
    ...Object.entries(VARIANTS).map(([k, d]) => [k, d, STD]),
    ...Object.entries(STD_VARIANTS).map(([k, s]) => [k, { ...base, construction: 'shared' }, s]),
    ['closet', { ...base, mode: 'closet', closet: { ...defaultCloset(STD), island: { ...defaultCloset(STD).island, enabled: true } } }, STD],
  ]

  it.each(all)('%s: one Confirmat through-hole and one edge hole per screw, and every op fits its board', (_, design, std) => {
    const ps = pieces(design, std)
    const screws = computeDesign(design, std).hardware.confirmat
    expect(ops(ps, thru)).toHaveLength(screws)
    expect(ops(ps, edge)).toHaveLength(screws)
    expect(ps.flatMap((p) => p.errors)).toEqual([])
  })

  it('drills a box side for its top and bottom and grooves it for the back', () => {
    const side = pieces(base).find((p) => p.name === 'Side' && !p.code.startsWith('L'))
    const holes = side.part.machining_ops.filter(thru)
    expect(holes.filter((o) => o.x === 1991).map((o) => o.y)).toEqual([50, 300, 550])
    expect(holes.filter((o) => o.x === 9).map((o) => o.y)).toEqual([50, 300, 550])
    expect(holes.every((o) => o.face === 'BOTTOM' && o.through && o.depth === 18)).toBe(true)
    const g = side.part.machining_ops.find((o) => o.type === 'GROOVE')
    expect(g).toEqual(expect.objectContaining({ face: 'TOP', x: 0, x2: 2000, y: 600 - 18 - 4.5, width: 9, depth: 8 }))
  })

  it('drills the top panel ends to match', () => {
    const top = pieces(base).find((p) => p.name === 'Top' && !p.code.startsWith('L'))
    const e = top.part.machining_ops.filter(edge)
    expect(e.filter((o) => o.face === 'LEFT').map((o) => o.y)).toEqual([50, 300, 550])
    expect(e.filter((o) => o.face === 'RIGHT').every((o) => o.x === 764)).toBe(true)
    expect(e[0]).toEqual(expect.objectContaining({ diameter: 5, depth: 45, z: 9 }))
  })

  it('puts shelf pins under each adjustable shelf on both walls', () => {
    const d = { ...base, sections: [{ preset: null, zones: [{ type: 'shelves', n: 2, auto: true }] }, ...base.sections.slice(1)] }
    const ps = pieces(d)
    const pins = ops(ps.filter((p) => p.cabinet === 'S1'), (o) => o.rule === 'shelf_pin')
    const per = 3 * 2
    const sideOps = ps.find((p) => p.cabinet === 'S1' && p.name === 'Side').part.machining_ops.filter((o) => o.rule === 'shelf_pin')
    expect(sideOps).toHaveLength(2 * per)
    expect(pins.length).toBeGreaterThanOrEqual(2 * per)
    const c = MACHINING_CONFIG.shelfPins
    expect(new Set(sideOps.map((o) => o.y))).toEqual(new Set([c.frontDistance, 600 - 18 - 9 - c.backDistance]))
    expect(sideOps.every((o) => o.depth === c.depth && o.diameter === c.diameter && o.face === 'TOP')).toBe(true)
  })

  it('offsets holes on the two faces of a shared partition so they never meet', () => {
    const d = { ...base, construction: 'shared', sections: base.sections.map(() => ({ preset: null, zones: [{ type: 'shelves', n: 3, auto: true }] })) }
    const parts = pieces(d).filter((p) => p.name === 'Partition' && !p.code.startsWith('L'))
    expect(parts).toHaveLength(2)
    parts.forEach((p) => {
      const face = (f) => p.part.machining_ops.filter((o) => o.type === 'HOLE' && o.face === f)
      const top = face('TOP')
      const bottom = face('BOTTOM')
      expect(top.length).toBeGreaterThan(0)
      expect(bottom.length).toBeGreaterThan(0)
      top.forEach((a) => bottom.forEach((b) => expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(7)))
    })
  })

  it('grooves only where a back sits in a groove', () => {
    const groovesOn = (d, name) => pieces(d).filter((p) => p.name === name).flatMap((p) => p.part?.machining_ops.filter((o) => o.type === 'GROOVE') || [])
    expect(groovesOn(VARIANTS.sharedNoBack, 'Side')).toHaveLength(0)
    expect(groovesOn(VARIANTS.sharedFullBack, 'Partition')).toHaveLength(0)
    expect(groovesOn(VARIANTS.sharedFullBack, 'Side').length).toBeGreaterThan(0)
    const per = pieces(VARIANTS.sharedPerSection).find((p) => p.name === 'Partition').part.machining_ops.filter((o) => o.type === 'GROOVE')
    expect(per.map((o) => o.face).sort()).toEqual(['BOTTOM', 'TOP'])
  })

  it('keeps every Confirmat edge hole at least the standard edge distance from the panel ends', () => {
    Object.values(VARIANTS).forEach((d) => {
      pieces(d).forEach((p) => (p.part?.machining_ops || []).filter(edge).forEach((o) => {
        expect(o.y).toBeGreaterThanOrEqual(STD.minConfirmatEdge - 0.01)
        expect(p.width - o.y).toBeGreaterThanOrEqual(STD.minConfirmatEdge - 0.01)
      }))
    })
    const tight = { ...STD, minConfirmatEdge: 40 }
    pieces(VARIANTS.sharedNoBack, tight).forEach((p) => (p.part?.machining_ops || []).filter(edge).forEach((o) => expect(o.y).toBeGreaterThanOrEqual(40)))
  })

  it('builds a split run as two carcasses with full panels and connectors', () => {
    const design = { ...base, width: 3000, construction: 'shared' }
    const ps = pieces(design)
    const tops = ps.filter((p) => p.name === 'Top' && !p.code.startsWith('L'))
    expect(tops.map((p) => p.length).sort((a, b) => a - b)).toEqual([964, 1964])
    tops.forEach((t) => {
      const e = t.part.machining_ops.filter(edge)
      expect(e.filter((o) => o.face === 'LEFT')).toHaveLength(3)
      expect(e.filter((o) => o.face === 'RIGHT')).toHaveLength(3)
    })
    const dbl = ps.filter((p) => p.name === 'Double partition' && !p.code.startsWith('L'))
    expect(dbl.map((p) => p.code)).toEqual(['DP1', 'DP2'])
    const con = (p) => p.part.machining_ops.filter((o) => o.rule === 'carcass_connector').map((o) => [o.x, o.y])
    expect(con(dbl[0])).toEqual(con(dbl[1]))
    expect(con(dbl[0])).toEqual([[100, 50], [100, 550], [1900, 50], [1900, 550]])
    expect(dbl[0].part.machining_ops.find((o) => o.rule === 'carcass_connector')).toEqual(expect.objectContaining({ diameter: STD.connectorDiameter, through: true }))
  })

  it('prices the extra panels and connectors of a split run', () => {
    const short = computeDesign({ ...base, width: 2400, construction: 'shared' }, STD)
    const long = computeDesign({ ...base, width: 3000, construction: 'shared' }, STD)
    expect(short.hardware.carcassConnector).toBeUndefined()
    const line = priceWardrobe(long, STD).hardware.find((h) => h.key === 'carcassConnector')
    expect(line).toEqual(expect.objectContaining({ qty: 8, unit: STD.priceCarcassConnector }))
  })

  it('keeps every top within a sheet on a very long run', () => {
    const d = { ...base, width: 6000, construction: 'shared', sections: Array.from({ length: 6 }, () => base.sections[0]) }
    const r = computeDesign(d, STD)
    r.rawParts.filter((p) => p.name === 'Top').forEach((p) => expect(p.L).toBeLessThanOrEqual(STD.sheetL))
    expect(r.rawParts.filter((p) => p.name === 'Double partition' && !p.loft)).toHaveLength(6)
    expect(r.warnings.map((w) => w.code)).not.toContain('panelTooLong')
  })

  it('staggers back rails vertically on shared partitions and keeps their normal hole positions', () => {
    const ps = pieces(VARIANTS.sharedNoBack)
    const rail = ps.find((p) => p.name === 'Back rail' && p.cabinet === 'S2')
    expect(rail.part.machining_ops.filter(edge).map((o) => o.y)).toEqual([30, 70, 30, 70])
    const r = computeDesign(VARIANTS.sharedNoBack, STD)
    const rails = r.geometry.filter((g) => g.kind === 'backRail' && g.y < 2100)
    const ys = (x0, x1) => rails.filter((g) => g.x > x0 && g.x < x1).map((g) => g.y).sort((a, b) => a - b)
    expect(ys(0, 800)).toEqual([118, 1982])
    expect(ys(800, 1600)).toEqual([118 + STD.railStagger, 1982 - STD.railStagger])
    const p1 = ps.find((p) => p.id === 'WO1-R1-00-P1')
    const face = (f) => p1.part.machining_ops.filter((o) => thru(o) && o.face === f)
    face('TOP').forEach((a) => face('BOTTOM').forEach((b) => expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(STD.minConfirmatSpacing)))
  })

  it('warns when the rail stagger brings holes too close', () => {
    const codes = (std) => computeDesign(VARIANTS.sharedNoBack, std).warnings.map((w) => w.code)
    expect(codes({ ...STD, railStagger: 0 })).toContain('railStaggerSmall')
    expect(codes({ ...STD, railStagger: 20 })).toContain('railStaggerSmall')
    expect(codes(STD)).not.toContain('railStaggerSmall')
  })

  it('staggers the back groove of every other section on shared partitions', () => {
    const ps = pieces(VARIANTS.sharedPerSection)
    const p1 = ps.find((p) => p.id === 'WO1-R1-00-P1')
    const g = (face) => p1.part.machining_ops.find((o) => o.type === 'GROOVE' && o.face === face)
    expect(g('TOP').y - g('BOTTOM').y).toBe(STD.grooveStagger)
    expect(Math.abs(g('TOP').y - g('BOTTOM').y)).toBeGreaterThanOrEqual(g('TOP').width)
    expect(p1.thickness - g('TOP').depth).toBeGreaterThanOrEqual(STD.minGrooveBacking)
    const top = ps.find((p) => p.name === 'Top' && !p.code.startsWith('L'))
    const segs = top.part.machining_ops.filter((o) => o.type === 'GROOVE')
    expect(segs.map((o) => [o.x, o.x2, o.y])).toEqual([[0, 782, 577.5], [782, 1582, 557.5], [1582, 2364, 577.5]])
  })

  it('makes the shifted section shallower so its shelves clear the forward back', () => {
    const r = computeDesign(VARIANTS.sharedPerSection, STD)
    const fixed = Object.fromEntries(r.rawParts.filter((p) => p.name === 'Fixed shelf').map((p) => [p.section, p.W]))
    expect(fixed).toEqual({ S1: 573, S2: 553 })
    expect(r.rawParts.find((p) => p.name === 'Shelf' && p.section === 'S2').W).toBe(544 - STD.grooveStagger)
    const backs = r.geometry.filter((g) => g.kind === 'back' && g.y < 2000)
    expect(backs.map((b) => b.z)).toEqual([18, 38, 18])
  })

  it('warns when the groove stagger is too small or the groove leaves too little board', () => {
    const codes = (std) => computeDesign(VARIANTS.sharedPerSection, std).warnings.map((w) => w.code)
    expect(codes({ ...STD, grooveStagger: 5 })).toContain('grooveStaggerSmall')
    expect(codes({ ...STD, grooveDepth: 10 })).toContain('grooveBackingThin')
    expect(codes(STD)).not.toContain('grooveStaggerSmall')
  })

  it('exports one DXF per piece for a wardrobe work order', () => {
    const design = VARIANTS.sharedNoBack
    const result = computeWardrobe(design, STD)
    const planner_data = JSON.parse(JSON.stringify(buildWardrobePlannerData({ design, std: STD, price: priceWardrobe(result, STD), result, picked: {} })))
    const out = cncExport({ order_number: 'WO7' }, { room_type: 'wardrobe', room_number: 3, planner_data })
    expect(out.errors).toEqual([])
    expect(out.files).toHaveLength(out.pieces.length + 1)
    const side = out.files.find((f) => f.name === 'WO7-R3-00-SD1.dxf')
    expect(side.data).toContain('HOLE_BOTTOM_D7_THRU')
    expect(out.files.find((f) => f.name === 'parts.csv').data).toContain('WO7-R3-00-P1')
  })
})
