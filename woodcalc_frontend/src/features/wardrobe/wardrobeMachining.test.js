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

  it('screws a continuous top down into each partition, and a split top from both pieces', () => {
    const ps = pieces({ ...base, width: 3000, construction: 'shared' })
    const tops = ps.filter((p) => p.name === 'Top' && !p.code.startsWith('L'))
    expect(tops.map((p) => p.length).sort((a, b) => a - b)).toEqual([982, 1982])
    const long = tops.find((p) => p.length === 1982)
    expect(long.part.machining_ops.filter(thru).map((o) => o.x)).toEqual(expect.arrayContaining([982, 1982 - 4.5]))
    const short = tops.find((p) => p.length === 982)
    expect(short.part.machining_ops.filter(thru).map((o) => o.x)).toEqual(expect.arrayContaining([4.5]))
    const splitPartition = ps.filter((p) => p.name === 'Partition' && !p.code.startsWith('L'))[1]
    expect(new Set(splitPartition.part.machining_ops.filter(edge).filter((o) => o.face === 'RIGHT').map((o) => o.z))).toEqual(new Set([4.5, 13.5]))
  })

  it('grooves only where a back sits in a groove', () => {
    const groovesOn = (d, name) => pieces(d).filter((p) => p.name === name).flatMap((p) => p.part?.machining_ops.filter((o) => o.type === 'GROOVE') || [])
    expect(groovesOn(VARIANTS.sharedNoBack, 'Side')).toHaveLength(0)
    expect(groovesOn(VARIANTS.sharedFullBack, 'Partition')).toHaveLength(0)
    expect(groovesOn(VARIANTS.sharedFullBack, 'Side').length).toBeGreaterThan(0)
    const per = pieces(VARIANTS.sharedPerSection).find((p) => p.name === 'Partition').part.machining_ops.filter((o) => o.type === 'GROOVE')
    expect(per.map((o) => o.face).sort()).toEqual(['BOTTOM', 'TOP'])
  })

  it('fixes back rails with two screws into each wall, offset on the far face of a partition', () => {
    const rails = pieces(VARIANTS.sharedNoBack).filter((p) => p.name === 'Back rail' && p.cabinet === 'S2')
    const e = rails[0].part.machining_ops.filter(edge)
    expect(e.filter((o) => o.face === 'LEFT').map((o) => o.y)).toEqual([46, 86])
    expect(e.filter((o) => o.face === 'RIGHT').map((o) => o.y)).toEqual([30, 70])
  })

  it('offsets short joints that cannot move up by moving them down', async () => {
    const { staggered } = await import('./wardrobeMachining')
    expect(staggered([30, 70], 100, 16)).toEqual([46, 86])
    expect(staggered([30, 70], 85, 16)).toEqual([14, 54])
    expect(staggered([50, 300, 550], 600, 16)).toEqual([66, 316, 566])
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
