import { defaultDesign, withSectionCount, autoSectionCount } from './wardrobeEngine'
import { defaultDeskDesign } from './deskEngine'
import { defaultCloset, runSectionCount } from './closetEngine'
import { wallPolygons } from './closetChecks'
import { add, sub, dot, unitFrame, placementFrom, framePolygon } from './unitGeometry'

const num = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
const r1 = (n) => Math.round(n * 10) / 10

export function nextLabel(units) {
  const used = units.map((u) => /^U(\d+)$/.exec(u.label || '')).filter(Boolean).map((m) => Number(m[1]))
  return `U${(used.length ? Math.max(...used) : 0) + 1}`
}

export function newUnitId() {
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function wardrobeUnitDesign(std, length, height, depth = 600) {
  const d = { ...defaultDesign(std), width: r1(length), height: num(height, 2400), depth, loft: false, fillerLeft: 0, fillerRight: 0, topFiller: 0 }
  return withSectionCount(d, Math.max(autoSectionCount(d, std), runSectionCount(length, std)), std)
}

export function islandUnitDesign(std) {
  const island = { ...defaultCloset(std).island }
  ;['enabled', 'dx', 'dy'].forEach((k) => { delete island[k] })
  return island
}

export function wallInfo(room, index) {
  const w = wallPolygons(room).find((p) => p.index === index)
  if (!w) return null
  const [p1, p2] = w.face
  const d = sub(p2, p1)
  const length = Math.hypot(d[0], d[1])
  if (!length) return null
  const dir = [d[0] / length, d[1] / length]
  const inward = w.inward
  const flip = dot([-dir[1], dir[0]], inward) < 0
  return { index, p1, p2, length, dir, inward, flip, u: flip ? [-dir[0], -dir[1]] : dir }
}

function wallInterval(info, unit) {
  const f = unitFrame(unit)
  if (dot(f.u, info.u) < 0.99) return null
  const back = dot(sub(f.origin, info.p1), info.inward)
  if (Math.abs(back) > 5) return null
  const a = dot(sub(f.origin, info.p1), info.dir)
  const b = dot(sub(add(f.origin, f.u, f.length), info.p1), info.dir)
  return [Math.min(a, b), Math.max(a, b)]
}

export function freeSpan(info, units, skipId = null) {
  const taken = units.filter((u) => u.id !== skipId).map((u) => wallInterval(info, u)).filter(Boolean).sort((a, b) => a[0] - b[0])
  let best = [0, 0]
  let at = 0
  taken.concat([[info.length, info.length]]).forEach(([s, e]) => {
    if (s - at > best[1] - best[0]) best = [at, s]
    at = Math.max(at, e)
  })
  return best
}

export function placeOnWall(info, start, length, depth) {
  const s = Math.max(0, start)
  const origin = info.flip ? add(info.p1, info.dir, s + length) : add(info.p1, info.dir, s)
  return placementFrom(origin, info.u, length, depth)
}

export function wallDistances(info, unit) {
  const iv = wallInterval(info, unit)
  if (!iv) return null
  return { start: r1(iv[0]), end: r1(info.length - iv[1]) }
}

export function moveAlongWall(unit, info, start) {
  const { length, depth } = { length: num(unit.design?.width), depth: num(unit.design?.depth) }
  return { ...unit, ...placeOnWall(info, start, length, depth) }
}

export function addWardrobeOnWall(closet, room, index, std) {
  const info = wallInfo(room, index)
  if (!info) return closet
  const units = closet.units || []
  const [s, e] = freeSpan(info, units)
  const length = Math.max(e - s, num(std.minSectionW, 300))
  const design = wardrobeUnitDesign(std, length, closet.height)
  const unit = { id: newUnitId(), kind: 'wardrobe', label: nextLabel(units), wallIndex: index, ...placeOnWall(info, s, length, design.depth), design }
  return { ...closet, units: [...units, unit] }
}

function roomCenter(room) {
  const ws = wallPolygons(room)
  if (!ws.length) return [num(room?.room?.width, 3000) / 2, num(room?.room?.depth, 2600) / 2]
  const xs = ws.flatMap((w) => w.face.map((p) => p[0]))
  const ys = ws.flatMap((w) => w.face.map((p) => p[1]))
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
}

export function addFreeUnit(closet, room, kind, std) {
  const units = closet.units || []
  const design = kind === 'island' ? islandUnitDesign(std) : kind === 'desk' ? defaultDeskDesign(std) : wardrobeUnitDesign(std, 2000, closet.height)
  const [cx, cy] = roomCenter(room)
  const L = num(design.width)
  const D = num(design.depth)
  const unit = { id: newUnitId(), kind, label: nextLabel(units), wallIndex: null, x: r1(cx - L / 2), y: r1(cy - D / 2), rotation: 0, design }
  return { ...closet, units: [...units, unit] }
}

export function resizeUnit(unit, patch, std) {
  const f = unitFrame(unit)
  const design = { ...unit.design, ...patch }
  const length = num(design.width)
  const depth = num(design.depth)
  if (unit.kind === 'wardrobe' && patch.width != null && patch.width !== unit.design.width) {
    Object.assign(design, { sections: withSectionCount({ ...design }, design.sections.length, std).sections })
  }
  return { ...unit, ...placementFrom(f.origin, f.u, length, depth), design }
}

export function stopAtFace(closet, winnerId, loserId, std) {
  const units = closet.units || []
  const winner = units.find((u) => u.id === winnerId)
  const loser = units.find((u) => u.id === loserId)
  if (!winner || !loser) return closet
  const f = unitFrame(loser)
  const along = framePolygon(unitFrame(winner)).map((p) => dot(sub(p, f.origin), f.u))
  const wmin = Math.min(...along)
  const wmax = Math.max(...along)
  const gap = num(std.closetCornerGap)
  let start = 0
  let end = f.length
  if (wmin <= f.length - wmax) start = Math.max(0, wmax + gap)
  else end = Math.min(f.length, wmin - gap)
  const length = r1(end - start)
  if (length <= 0) return closet
  const origin = add(f.origin, f.u, start)
  const design = loser.kind === 'wardrobe'
    ? { ...loser.design, width: length, sections: withSectionCount({ ...loser.design, width: length }, runSectionCount(length, std), std).sections }
    : { ...loser.design, width: length }
  const next = { ...loser, ...placementFrom(origin, f.u, length, f.depth), design }
  return { ...closet, units: units.map((u) => (u.id === loserId ? next : u)) }
}
