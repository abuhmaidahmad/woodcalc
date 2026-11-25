import { DEFAULT_WALL_THICKNESS, PLANNER_SCALE } from '../kitchen_planner/wallGeometry'

export const CLOSET_ROOM_ELEMENT_TYPES = ['window', 'door', 'column']
export const OUTLINE_WALL_IDS = ['closet-B', 'closet-A', 'closet-C']

const num = (v, d = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

export function defaultCeiling(closet) {
  return Math.max(2700, num(closet?.height, 2400) + 100)
}

export function outlineWalls(closet) {
  const W = num(closet.width) * PLANNER_SCALE
  const D = num(closet.roomDepth) * PLANNER_SCALE
  const wall = (id, x1, y1, x2, y2) => ({ id, x1, y1, x2, y2, thickness: DEFAULT_WALL_THICKNESS, thicknessSide: 'right' })
  return [
    wall(OUTLINE_WALL_IDS[0], 0, D, 0, 0),
    wall(OUTLINE_WALL_IDS[1], 0, 0, W, 0),
    wall(OUTLINE_WALL_IDS[2], W, 0, W, D),
  ]
}

export function outlineRoom(closet) {
  return {
    walls: outlineWalls(closet),
    elements: [],
    room: { width: num(closet.width), depth: num(closet.roomDepth), ceilingHeight: defaultCeiling(closet) },
  }
}

export function validRoom(room) {
  return !!room && typeof room === 'object' && Array.isArray(room.walls) && Array.isArray(room.elements) && !!room.room && typeof room.room === 'object'
}

export function closetRoom(closet) {
  return validRoom(closet?.room) ? closet.room : outlineRoom(closet || {})
}

export function withClosetRoom(design) {
  if (!design || design.mode !== 'closet' || !design.closet || validRoom(design.closet.room)) return design
  return { ...design, closet: { ...design.closet, room: outlineRoom(design.closet) } }
}

const sameWall = (a, b) => a && b && a.id === b.id && ['x1', 'y1', 'x2', 'y2'].every((k) => Math.abs(num(a[k]) - num(b[k])) < 1e-6)
  && num(a.thickness, DEFAULT_WALL_THICKNESS) === num(b.thickness, DEFAULT_WALL_THICKNESS) && (a.thicknessSide || 'right') === (b.thicknessSide || 'right')

export function isOutlineRoom(closet) {
  const walls = closet?.room?.walls
  const want = outlineWalls(closet)
  return Array.isArray(walls) && walls.length === want.length && walls.every((w, i) => sameWall(w, want[i]))
}

export function syncRoomToOutline(prev, next) {
  if (!validRoom(next?.room) || !isOutlineRoom(prev)) return next
  if (num(prev.width) === num(next.width) && num(prev.roomDepth) === num(next.roomDepth)) return next
  const dx = num(next.width) - num(prev.width)
  const elements = next.room.elements.map((el) => (el.embeddedInWall && el.wallIndex === 2 ? { ...el, x: num(el.x) + dx } : el))
  return {
    ...next,
    room: { ...next.room, walls: outlineWalls(next), elements, room: { ...next.room.room, width: num(next.width), depth: num(next.roomDepth) } },
  }
}
