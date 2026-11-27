import { describe, it, expect } from 'vitest'
import { DEFAULT_WARDROBE_STANDARD as STD } from './wardrobeStandard'
import { defaultDesign } from './wardrobeEngine'
import { defaultCloset, computeDesign, withUnits } from './closetEngine'
import { outlineRoom, withClosetRoom } from './closetRoom'
import { unitFrame } from './unitGeometry'
import { wallInfo, wallDistances, moveAlongWall, addWardrobeOnWall, addFreeUnit, stopAtFace, nextLabel, resizeUnit } from './unitOps'
import { contractRows } from './wardrobeRoom'

const room = outlineRoom({ width: 3000, roomDepth: 2600 })
const empty = { height: 2400, units: [], room }
const round = (p) => p.map((v) => Math.round(v))

describe('adding closets', () => {
  it('puts a closet on each wall with its back on the inner face, facing into the room', () => {
    const want = { 0: { o: [0, 2600], n: [1, 0], l: 2600 }, 1: { o: [0, 0], n: [0, 1], l: 3000 }, 2: { o: [3000, 0], n: [-1, 0], l: 2600 } }
    Object.entries(want).forEach(([i, w]) => {
      const c = addWardrobeOnWall(empty, room, Number(i), STD)
      const u = c.units[0]
      const f = unitFrame(u)
      expect(u.label).toBe('U1')
      expect(round(f.origin)).toEqual(w.o)
      expect(f.n).toEqual(w.n)
      expect(f.length).toBe(w.l)
      expect(u.design.height).toBe(2400)
      expect(wallDistances(wallInfo(room, Number(i)), u)).toEqual({ start: 0, end: 0 })
    })
  })

  it('gives the next closet on the same wall the free length that is left', () => {
    let c = addWardrobeOnWall(empty, room, 1, STD)
    c = { ...c, units: [resizeUnit(c.units[0], { width: 1800 }, STD)] }
    c = addWardrobeOnWall(c, room, 1, STD)
    expect(c.units.map((u) => u.label)).toEqual(['U1', 'U2'])
    expect(wallDistances(wallInfo(room, 1), c.units[1])).toEqual({ start: 1800, end: 0 })
    expect(c.units[1].design.width).toBe(1200)
  })

  it('moves a closet along its wall by distance', () => {
    const c = addFreeUnit(empty, room, 'wardrobe', STD)
    const info = wallInfo(room, 1)
    const moved = moveAlongWall(c.units[0], info, 500)
    expect(wallDistances(info, moved)).toEqual({ start: 500, end: 500 })
  })

  it('adds free-standing closets and islands in the middle of the room', () => {
    const c = addFreeUnit(addFreeUnit(empty, room, 'wardrobe', STD), room, 'island', STD)
    expect(c.units.map((u) => [u.kind, u.label, u.rotation])).toEqual([['wardrobe', 'U1', 0], ['island', 'U2', 0]])
    expect(round(unitFrame(c.units[1]).center)).toEqual([1500, 1300])
    expect(c.units[1].design).not.toHaveProperty('enabled')
    expect(nextLabel([{ label: 'A' }, { label: 'U4' }])).toBe('U5')
  })
})

describe('inside corners', () => {
  it('stops one closet at the other one\'s face plus the corner gap', () => {
    let c = addWardrobeOnWall(empty, room, 1, STD)
    c = addWardrobeOnWall(c, room, 0, STD)
    const [a, b] = c.units
    const base = { ...defaultDesign(STD), mode: 'closet', closet: c }
    const before = computeDesign(base, STD)
    expect(before.warnings.find((w) => w.code === 'unitsOverlap').fix).toEqual({ type: 'corner', a: a.id, b: b.id })
    const fixed = stopAtFace(c, a.id, b.id, STD)
    const lb = fixed.units[1]
    expect(lb.design.width).toBe(2600 - 600 - STD.closetCornerGap)
    expect(wallDistances(wallInfo(room, 0), lb)).toEqual({ start: 0, end: 600 + STD.closetCornerGap })
    const after = computeDesign({ ...base, closet: fixed }, STD)
    expect(after.warnings.filter((w) => w.code === 'unitsOverlap')).toEqual([])
  })
})

describe('contract rows from units', () => {
  it('names converted closets by wall and new ones by label', () => {
    const conv = withUnits(withClosetRoom({ ...defaultDesign(STD), mode: 'closet', closet: { ...defaultCloset(STD), island: { ...defaultCloset(STD).island, enabled: true } } }), STD)
    const added = { ...conv, closet: addFreeUnit(conv.closet, conv.closet.room, 'wardrobe', STD) }
    const rows = contractRows(added, computeDesign(added, STD), [], (k, p) => (p ? `${k}:${JSON.stringify(p)}` : k), 'White')
    expect(rows.map((r) => r.id)).toEqual(['B', 'A', 'C', 'I', 'U1'])
    expect(rows[4].label.startsWith('U1 · ')).toBe(true)
    expect(rows[0].label.startsWith('wardrobe.closet.wall.B · ')).toBe(true)
  })
})
