export const UNIT_KINDS = ['wardrobe', 'island', 'desk']

const num = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
const r3 = (n) => (Math.round(n * 1000) / 1000) || 0
const neg = (n) => -n || 0

export const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k]
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1]

export function normRotation(deg) {
  const r = ((Math.round(num(deg) * 1000) / 1000) % 360 + 360) % 360
  return r === 360 ? 0 : r
}

export function unitSize(unit) {
  return { length: num(unit?.design?.width), depth: num(unit?.design?.depth) }
}

export function unitHeight(unit) {
  return num(unit?.design?.height)
}

export function frameOf(x, y, rotation, length, depth) {
  const rad = (num(rotation) * Math.PI) / 180
  const u = [r3(Math.cos(rad)), r3(Math.sin(rad))]
  const n = [neg(u[1]), u[0]]
  const center = [num(x) + length / 2, num(y) + depth / 2]
  const origin = add(add(center, u, -length / 2), n, -depth / 2)
  return { origin, u, n, length, depth, rotation: normRotation(rotation), angle: -rad, center }
}

export function unitFrame(unit) {
  const { length, depth } = unitSize(unit)
  return frameOf(unit.x, unit.y, unit.rotation, length, depth)
}

export function placementFrom(origin, u, length, depth) {
  const n = [neg(u[1]), u[0]]
  const center = add(add(origin, u, length / 2), n, depth / 2)
  const rotation = normRotation((Math.atan2(u[1], u[0]) * 180) / Math.PI)
  return { x: r3(center[0] - length / 2), y: r3(center[1] - depth / 2), rotation }
}

export function framePolygon(f) {
  const a = f.origin
  const b = add(a, f.u, f.length)
  const c = add(b, f.n, f.depth)
  const d = add(a, f.n, f.depth)
  return [a, b, c, d]
}

export function slabPolygon(f, from, to) {
  const a = add(f.origin, f.n, from)
  const b = add(a, f.u, f.length)
  return [a, b, add(b, f.n, to - from), add(a, f.n, to - from)]
}

export function islandHalves(f, doubleSided) {
  if (!doubleSided) return [{ origin: f.origin, angle: f.angle, u: f.u, n: f.n }]
  const back = [neg(f.u[0]), neg(f.u[1])]
  return [
    { origin: add(f.origin, f.n, f.depth / 2), angle: f.angle, u: f.u, n: f.n },
    { origin: add(add(f.origin, f.u, f.length), f.n, f.depth / 2), angle: f.angle + Math.PI, u: back, n: [neg(f.n[0]), neg(f.n[1])] },
  ]
}

function axes(poly) {
  return poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length]
    const e = sub(q, p)
    const len = Math.hypot(e[0], e[1]) || 1
    return [-e[1] / len, e[0] / len]
  })
}

function project(poly, ax) {
  let min = Infinity
  let max = -Infinity
  poly.forEach((p) => {
    const v = dot(p, ax)
    if (v < min) min = v
    if (v > max) max = v
  })
  return [min, max]
}

export function overlapDepth(a, b) {
  let best = Infinity
  for (const ax of [...axes(a), ...axes(b)]) {
    const [a0, a1] = project(a, ax)
    const [b0, b1] = project(b, ax)
    const o = Math.min(a1, b1) - Math.max(a0, b0)
    if (o <= 0) return 0
    if (o < best) best = o
  }
  return best
}

export function polysOverlap(a, b, tol = 1) {
  return overlapDepth(a, b) > tol
}

function segDist(p, a, b) {
  const ab = sub(b, a)
  const len2 = dot(ab, ab) || 1
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / len2))
  const q = add(a, ab, t)
  return Math.hypot(p[0] - q[0], p[1] - q[1])
}

export function polyDistance(a, b) {
  if (overlapDepth(a, b) > 0) return 0
  let best = Infinity
  const edges = (poly) => poly.map((p, i) => [p, poly[(i + 1) % poly.length]])
  edges(b).forEach(([p, q]) => a.forEach((v) => { best = Math.min(best, segDist(v, p, q)) }))
  edges(a).forEach(([p, q]) => b.forEach((v) => { best = Math.min(best, segDist(v, p, q)) }))
  return best
}

function clip(poly, inside, cross) {
  const out = []
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length]
    const pin = inside(p)
    const qin = inside(q)
    if (pin) out.push(p)
    if (pin !== qin) out.push(cross(p, q))
  })
  return out
}

export function gapInFront(f, poly) {
  const local = poly.map((p) => {
    const d = sub(p, f.origin)
    return [dot(d, f.u), dot(d, f.n) - f.depth]
  })
  const cut = (axis, value, keepAbove) => (pts) => clip(pts,
    (p) => (keepAbove ? p[axis] >= value : p[axis] <= value),
    (p, q) => {
      const t = (value - p[axis]) / (q[axis] - p[axis])
      return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
    })
  let pts = local
  pts = cut(0, 0.5, true)(pts)
  pts = cut(0, f.length - 0.5, false)(pts)
  pts = cut(1, -0.5, true)(pts)
  if (!pts.length) return null
  return Math.max(0, Math.min(...pts.map((p) => p[1])))
}
