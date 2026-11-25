import { describe, it, expect } from 'vitest'
import { DEFAULT_WARDROBE_STANDARD as STD } from './wardrobeStandard'
import { defaultDesign } from './wardrobeEngine'
import { defaultCloset, computeDesign } from './closetEngine'
import { priceWardrobe } from './wardrobePricing'
import { piecesFromParts } from './wardrobePieces'
import { outlineWalls, outlineRoom, closetRoom, withClosetRoom, isOutlineRoom, syncRoomToOutline, validRoom } from './closetRoom'
import { computeWallBodies, PLANNER_SCALE } from '../kitchen_planner/wallGeometry'

const base = defaultDesign(STD)
const oldCloset = (extra = {}) => ({ ...base, mode: 'closet', closet: { ...defaultCloset(STD), ...extra } })

describe('closet room from the old outline', () => {
  it('builds walls B, A and C around the closet with the entrance open', () => {
    const c = defaultCloset(STD)
    const s = PLANNER_SCALE
    expect(outlineWalls(c).map((w) => [w.id, w.x1 / s, w.y1 / s, w.x2 / s, w.y2 / s])).toEqual([
      ['closet-B', 0, 2600, 0, 0],
      ['closet-A', 0, 0, 3000, 0],
      ['closet-C', 3000, 0, 3000, 2600],
    ])
    const room = outlineRoom(c)
    expect(room.elements).toEqual([])
    expect(room.room).toEqual({ width: 3000, depth: 2600, ceilingHeight: 2700 })
  })

  it('puts every wall\'s thickness outside the closet', () => {
    const bodies = computeWallBodies(outlineWalls(defaultCloset(STD)), PLANNER_SCALE)
    const outer = bodies.map((b) => [b.outerStart.x / PLANNER_SCALE, b.outerStart.y / PLANNER_SCALE, b.outerEnd.x / PLANNER_SCALE, b.outerEnd.y / PLANNER_SCALE].map(Math.round))
    expect(outer[0][0]).toBe(-120)
    expect(outer[1][1]).toBe(-120)
    expect(outer[2][0]).toBe(3120)
  })

  it('adds a room to closets saved without one and leaves the rest alone', () => {
    const d = oldCloset()
    const loaded = withClosetRoom(JSON.parse(JSON.stringify(d)))
    expect(validRoom(loaded.closet.room)).toBe(true)
    expect(isOutlineRoom(loaded.closet)).toBe(true)
    expect(withClosetRoom(loaded)).toBe(loaded)
    expect(withClosetRoom(base)).toBe(base)
    expect(closetRoom(d.closet)).toEqual(outlineRoom(d.closet))
  })

  it('gives converted closets identical parts, hardware, geometry, warnings, price and pieces', () => {
    const shapes = [
      {},
      { shape: 'L', corners: { AB: 'side', AC: 'empty' } },
      { shape: 'straight' },
      { island: { ...defaultCloset(STD).island, enabled: true } },
    ]
    shapes.forEach((extra) => {
      const d = oldCloset(extra)
      const a = computeDesign(d, STD)
      const b = computeDesign(withClosetRoom(d), STD)
      const strip = (r) => JSON.stringify({ ...r, runs: r.runs.map((x) => ({ ...x, design: undefined })) })
      expect(strip(b)).toBe(strip(a))
      expect(priceWardrobe(b, STD)).toEqual(priceWardrobe(a, STD))
      expect(JSON.stringify(piecesFromParts(b.rawParts))).toBe(JSON.stringify(piecesFromParts(a.rawParts)))
    })
  })
})

describe('keeping the room in step with the outline', () => {
  const start = withClosetRoom(oldCloset()).closet

  it('moves the walls when the outline changes and the walls were never edited', () => {
    const door = { id: 1, type: 'door', embeddedInWall: true, wallIndex: 2, x: 3000, y: 1200, w: 900 }
    const win = { id: 2, type: 'window', embeddedInWall: true, wallIndex: 1, x: 1500, y: 0, w: 900 }
    const prev = { ...start, room: { ...start.room, elements: [door, win] } }
    const next = syncRoomToOutline(prev, { ...prev, width: 3400, roomDepth: 2800 })
    expect(next.room.walls).toEqual(outlineWalls({ width: 3400, roomDepth: 2800 }))
    expect(next.room.room).toMatchObject({ width: 3400, depth: 2800, ceilingHeight: 2700 })
    expect(next.room.elements).toEqual([{ ...door, x: 3400 }, win])
  })

  it('keeps walls the user drew', () => {
    const drawn = { ...start, room: { ...start.room, walls: start.room.walls.map((w, i) => (i === 1 ? { ...w, y1: -20, y2: -20 } : w)) } }
    const next = syncRoomToOutline(drawn, { ...drawn, width: 3400 })
    expect(next.room).toBe(drawn.room)
  })

  it('does nothing when the outline did not change', () => {
    const next = { ...start, loft: true }
    expect(syncRoomToOutline(start, next)).toBe(next)
  })
})
