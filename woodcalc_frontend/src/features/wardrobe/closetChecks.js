import { computeWallBodies, getWallBodyPolygon, PLANNER_SCALE } from '../kitchen_planner/wallGeometry'
import { add, dot, sub, framePolygon, slabPolygon, polysOverlap, polyDistance, gapInFront } from './unitGeometry'

const num = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
const r0 = (n) => Math.round(n)
const ANTI = -0.9
const PARALLEL = 0.9

export function wallPolygons(room) {
  const walls = room?.walls || []
  if (!walls.length) return []
  const bodies = computeWallBodies(walls, PLANNER_SCALE)
  return bodies.map((b, i) => {
    const face = [[walls[i].x1 / PLANNER_SCALE, walls[i].y1 / PLANNER_SCALE], [walls[i].x2 / PLANNER_SCALE, walls[i].y2 / PLANNER_SCALE]]
    const d = sub(face[1], face[0])
    const len = Math.hypot(d[0], d[1]) || 1
    const left = [-d[1] / len, d[0] / len]
    const out = [(b.outerStart.x + b.outerEnd.x - b.faceStart.x - b.faceEnd.x) / 2, (b.outerStart.y + b.outerEnd.y - b.faceStart.y - b.faceEnd.y) / 2]
    const inward = dot(left, out) > 0 ? [-left[0] || 0, -left[1] || 0] : left
    return { index: i, wall: walls[i], poly: getWallBodyPolygon(b).map((p) => [p.x / PLANNER_SCALE, p.y / PLANNER_SCALE]), face, inward }
  })
}

export function columnPolygon(el) {
  const rad = (num(el.rotation) * Math.PI) / 180
  const u = [Math.cos(rad), Math.sin(rad)]
  const n = [-u[1], u[0]]
  const c = [num(el.x), num(el.y)]
  const w = num(el.w) / 2
  const h = num(el.h) / 2
  return [[-w, -h], [w, -h], [w, h], [-w, h]].map(([a, b]) => add(add(c, u, a), n, b))
}

export function openingRegion(el, wallPoly, depth) {
  const [p1, p2] = wallPoly.face
  const d = sub(p2, p1)
  const len = Math.hypot(d[0], d[1]) || 1
  const u = [d[0] / len, d[1] / len]
  const inward = wallPoly.inward
  const t = dot(sub([num(el.x), num(el.y)], p1), u)
  const w = num(el.w)
  const a = add(p1, u, t - w / 2)
  const b = add(p1, u, t + w / 2)
  return [a, b, add(b, inward, depth), add(a, inward, depth)]
}

function footprints(units) {
  return units.map((u) => ({ unit: u, poly: framePolygon(u.frame) }))
}

function fronts(u) {
  if (u.kind === 'island') {
    if (u.halves.length < 2) return [u.frame]
    const f = u.frame
    const half = f.depth / 2
    return u.halves.map((h) => ({ origin: h.place.origin, u: h.place.u, n: h.place.n, length: f.length, depth: half }))
  }
  return [u.frame]
}

function swingDepth(u) {
  if (u.kind !== 'wardrobe') return 0
  return (u.result.geometry || []).filter((g) => g.kind === 'door').reduce((m, g) => Math.max(m, num(g.w)), 0)
}

function isNeighbour(a, b, std) {
  const facing = dot(a.frame.n, b.frame.n) < ANTI
  return !facing && polyDistance(framePolygon(a.frame), framePolygon(b.frame)) <= num(std.closetCornerGap) + 5
}

function cornerFix(a, b) {
  const perpendicular = Math.abs(dot(a.frame.u, b.frame.u)) < 0.1
  return perpendicular && a.kind === 'wardrobe' && b.kind === 'wardrobe' ? { type: 'corner', a: a.id, b: b.id } : null
}

export function closetChecks(units, room, std) {
  const out = []
  const minWalk = num(std.minWalkway)
  const fps = footprints(units)
  const walls = wallPolygons(room)
  const elements = room?.elements || []
  const columns = elements.filter((e) => e.type === 'column').map((e) => ({ el: e, poly: columnPolygon(e) }))

  for (let i = 0; i < fps.length; i++) {
    for (let j = i + 1; j < fps.length; j++) {
      if (polysOverlap(fps[i].poly, fps[j].poly)) {
        out.push({ code: 'unitsOverlap', level: 'error', params: { a: fps[i].unit.label, b: fps[j].unit.label }, fix: cornerFix(fps[i].unit, fps[j].unit) })
      }
    }
  }
  fps.forEach(({ unit, poly }) => {
    walls.forEach((w) => {
      if (polysOverlap(poly, w.poly)) out.push({ code: 'unitInWall', level: 'error', params: { unit: unit.label, wall: w.index + 1 } })
    })
    columns.forEach((c) => {
      if (polysOverlap(poly, c.poly)) out.push({ code: 'unitHitsColumn', level: 'error', params: { unit: unit.label } })
    })
  })

  elements.filter((e) => (e.type === 'door' || e.type === 'window') && e.embeddedInWall).forEach((el) => {
    const w = walls[el.wallIndex]
    if (!w) return
    if (el.type === 'door') {
      const swing = openingRegion(el, w, num(el.w))
      fps.forEach(({ unit, poly }) => {
        if (polysOverlap(poly, swing)) out.push({ code: 'unitBlocksDoor', level: 'warn', params: { unit: unit.label } })
      })
    } else {
      const front = openingRegion(el, w, 300)
      const sill = num(el.elevation, 900)
      fps.forEach(({ unit, poly }) => {
        const h = num(unit.design?.height)
        if (h > sill && polysOverlap(poly, front)) out.push({ code: 'unitCoversWindow', level: 'warn', params: { unit: unit.label, h: r0(h), sill: r0(sill) } })
      })
    }
  })

  const reported = new Set()
  units.forEach((u) => {
    fronts(u).forEach((f) => {
      let gap = null
      units.forEach((o) => {
        if (o === u || isNeighbour(u, o, std)) return
        const g = gapInFront(f, framePolygon(o.frame))
        if (g != null && (gap == null || g < gap)) gap = g
      })
      walls.forEach((w) => {
        const d = sub(w.face[1], w.face[0])
        const len = Math.hypot(d[0], d[1]) || 1
        if (Math.abs(dot([d[0] / len, d[1] / len], f.u)) < PARALLEL) return
        const g = gapInFront(f, w.poly)
        if (g != null && (gap == null || g < gap)) gap = g
      })
      columns.forEach((c) => {
        const g = gapInFront(f, c.poly)
        if (g != null && (gap == null || g < gap)) gap = g
      })
      if (gap != null && gap < minWalk) {
        const key = `${u.label}:${r0(gap)}`
        if (!reported.has(key)) {
          reported.add(key)
          out.push({ code: 'unitWalkway', level: gap <= 0 ? 'error' : 'warn', params: { unit: u.label, w: r0(gap), min: minWalk } })
        }
      }
    })
  })

  units.forEach((u) => {
    const reach = swingDepth(u)
    if (!reach) return
    const swing = slabPolygon(u.frame, u.frame.depth, u.frame.depth + reach)
    units.forEach((o) => {
      if (o === u || isNeighbour(u, o, std)) return
      const hitsBody = polysOverlap(swing, framePolygon(o.frame))
      const otherReach = swingDepth(o)
      const hitsDoors = otherReach > 0 && dot(u.frame.n, o.frame.n) < ANTI && polysOverlap(swing, slabPolygon(o.frame, o.frame.depth, o.frame.depth + otherReach))
      const pair = hitsDoors ? [u.label, o.label].sort().join('|') : `${u.label}>${o.label}`
      if ((hitsBody || hitsDoors) && !reported.has(pair)) {
        reported.add(pair)
        out.push({ code: 'doorsHitUnit', level: 'warn', params: { unit: u.label, other: o.label } })
      }
    })
  })

  return out
}
