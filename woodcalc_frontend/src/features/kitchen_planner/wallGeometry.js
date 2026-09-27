export const DEFAULT_WALL_THICKNESS = 120
export const DEFAULT_JOIN_THRESHOLD = 60

// Beyond this many multiples of thickness, a mitered corner would spike out
// absurdly far (near-parallel or reflex angles) -- bevel instead, same idea
// as SVG's stroke-miterlimit.
const MITER_LIMIT = 6

const ptDist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by)

function normalize(dx, dy) {
  const len = Math.hypot(dx, dy) || 1
  return { dx: dx / len, dy: dy / len }
}

function wallDir(wall) {
  return normalize(wall.x2 - wall.x1, wall.y2 - wall.y1)
}

function polygonSignedArea(vertices) {
  let sum = 0
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length]
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

function outwardNormal(dx, dy, sign) {
  return sign >= 0 ? { nx: dy, ny: -dx } : { nx: -dy, ny: dx }
}

function lineIntersect(p1, d1, p2, d2) {
  const denom = d1.dx * d2.dy - d1.dy * d2.dx
  if (Math.abs(denom) < 1e-9) return null
  const t = ((p2.x - p1.x) * d2.dy - (p2.y - p1.y) * d2.dx) / denom
  return { x: p1.x + d1.dx * t, y: p1.y + d1.dy * t }
}

function offsetVertex(dirA, normalA, thicknessA, dirB, normalB, thicknessB, sharedVertex) {
  const cross = dirA.dx * dirB.dy - dirA.dy * dirB.dx
  const dot = dirA.dx * dirB.dx + dirA.dy * dirB.dy
  const pA = { x: sharedVertex.x + normalA.nx * thicknessA, y: sharedVertex.y + normalA.ny * thicknessA }
  const pB = { x: sharedVertex.x + normalB.nx * thicknessB, y: sharedVertex.y + normalB.ny * thicknessB }
  if (Math.abs(cross) < 1e-4 && Math.abs(dot) > 0.999) return { a: pA, b: pB }
  const hit = lineIntersect(pA, dirA, pB, dirB)
  const maxT = MITER_LIMIT * Math.max(thicknessA, thicknessB)
  if (!hit || ptDist(hit.x, hit.y, sharedVertex.x, sharedVertex.y) > maxT) return { a: pA, b: pB }
  return { a: hit, b: hit }
}

function findEndpointMatch(walls, wallIndex, end, threshold) {
  const wall = walls[wallIndex]
  const vx = end === 0 ? wall.x1 : wall.x2
  const vy = end === 0 ? wall.y1 : wall.y2
  let best = null, bestDist = threshold
  walls.forEach((w, i) => {
    if (i === wallIndex) return
    ;[[w.x1, w.y1, 0], [w.x2, w.y2, 1]].forEach(([x, y, e]) => {
      const d = ptDist(vx, vy, x, y)
      if (d < bestDist) { bestDist = d; best = { wallIndex: i, end: e } }
    })
  })
  return best
}

export function makeWallId() {
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function getWallThickness(wall) {
  return wall?.thickness || DEFAULT_WALL_THICKNESS
}

export function getWallLength(wall) {
  return ptDist(wall.x1, wall.y1, wall.x2, wall.y2)
}

export function traceClosedPolygon(walls, threshold = DEFAULT_JOIN_THRESHOLD) {
  const n = walls.length
  if (n < 3) return null
  const steps = [{ wallIndex: 0, reversed: false }]
  const visited = new Set([0])
  let currentIndex = 0, currentEnd = 1
  for (let i = 1; i < n; i++) {
    const match = findEndpointMatch(walls, currentIndex, currentEnd, threshold)
    if (!match || visited.has(match.wallIndex)) return null
    visited.add(match.wallIndex)
    const reversed = match.end === 1
    steps.push({ wallIndex: match.wallIndex, reversed })
    currentIndex = match.wallIndex
    currentEnd = reversed ? 0 : 1
  }
  const closingMatch = findEndpointMatch(walls, currentIndex, currentEnd, threshold)
  if (!closingMatch || closingMatch.wallIndex !== 0 || closingMatch.end !== 0) return null
  return steps
}

function stepEndpoints(walls, step) {
  const w = walls[step.wallIndex]
  const start = step.reversed ? { x: w.x2, y: w.y2 } : { x: w.x1, y: w.y1 }
  const end = step.reversed ? { x: w.x1, y: w.y1 } : { x: w.x2, y: w.y2 }
  return { start, end, ...normalize(end.x - start.x, end.y - start.y) }
}

function offsetClosedLoop(walls, loop, thicknessOf, signMultiplier) {
  const n = loop.length
  const dirs = loop.map(step => stepEndpoints(walls, step))
  const vertexLoop = dirs.map(d => d.start)
  const outwardSign = (polygonSignedArea(vertexLoop) >= 0 ? 1 : -1) * signMultiplier
  const results = {}
  for (let i = 0; i < n; i++) {
    const nextIdx = (i + 1) % n
    const prevStep = loop[i], nextStep = loop[nextIdx]
    const prevDir = dirs[i], nextDir = dirs[nextIdx]
    const prevThickness = thicknessOf(walls[prevStep.wallIndex], prevStep.wallIndex)
    const nextThickness = thicknessOf(walls[nextStep.wallIndex], nextStep.wallIndex)
    const normalA = outwardNormal(prevDir.dx, prevDir.dy, outwardSign)
    const normalB = outwardNormal(nextDir.dx, nextDir.dy, outwardSign)
    const shared = nextDir.start
    const { a, b } = offsetVertex(prevDir, normalA, prevThickness, nextDir, normalB, nextThickness, shared)
    results[prevStep.wallIndex] = { ...(results[prevStep.wallIndex] || {}), [prevStep.reversed ? 'outerStart' : 'outerEnd']: a }
    results[nextStep.wallIndex] = { ...(results[nextStep.wallIndex] || {}), [nextStep.reversed ? 'outerEnd' : 'outerStart']: b }
  }
  return results
}

function offsetOpenChain(walls, thicknessOf, normalOf, threshold) {
  const results = {}
  const processed = new Set()
  walls.forEach((w, i) => {
    ;[0, 1].forEach(end => {
      const key = `${i}:${end}`
      if (processed.has(key)) return
      processed.add(key)
      const thickness = thicknessOf(w, i)
      const dir = wallDir(w)
      const normal = normalOf(w, i, dir)
      const match = findEndpointMatch(walls, i, end, threshold)
      if (!match) {
        const facePoint = end === 0 ? { x: w.x1, y: w.y1 } : { x: w.x2, y: w.y2 }
        const pt = { x: facePoint.x + normal.nx * thickness, y: facePoint.y + normal.ny * thickness }
        results[i] = { ...(results[i] || {}), [end === 0 ? 'outerStart' : 'outerEnd']: pt }
        return
      }
      processed.add(`${match.wallIndex}:${match.end}`)
      const ow = walls[match.wallIndex]
      const oThickness = thicknessOf(ow, match.wallIndex)
      const oDir = wallDir(ow)
      const oNormal = normalOf(ow, match.wallIndex, oDir)
      const shared = end === 0 ? { x: w.x1, y: w.y1 } : { x: w.x2, y: w.y2 }
      const { a, b } = offsetVertex(oDir, oNormal, oThickness, dir, normal, thickness, shared)
      results[match.wallIndex] = { ...(results[match.wallIndex] || {}), [match.end === 0 ? 'outerStart' : 'outerEnd']: a }
      results[i] = { ...(results[i] || {}), [end === 0 ? 'outerStart' : 'outerEnd']: b }
    })
  })
  return results
}

// Walls store x1/y1/x2/y2 in scaled px (mm * scale) but thickness in raw mm --
// every offset computed here has to happen in the same px space as the
// coordinates, so thickness is converted with `scale` before use.
export function computeWallBodies(walls, scale = 1, threshold = DEFAULT_JOIN_THRESHOLD) {
  const bodies = walls.map(w => ({
    faceStart: { x: w.x1, y: w.y1 },
    faceEnd: { x: w.x2, y: w.y2 },
    outerStart: null,
    outerEnd: null,
    thickness: getWallThickness(w) * scale,
    closed: false,
  }))
  const loop = traceClosedPolygon(walls, threshold)
  const thicknessOf = (w) => getWallThickness(w) * scale
  let results
  if (loop) {
    results = offsetClosedLoop(walls, loop, thicknessOf, 1)
    loop.forEach(step => { bodies[step.wallIndex].closed = true })
  } else {
    const signOf = (w) => (w.thicknessSide === 'left' ? -1 : 1)
    results = offsetOpenChain(walls, thicknessOf, (w, i, dir) => outwardNormal(dir.dx, dir.dy, signOf(w)), threshold)
  }
  Object.keys(results).forEach(idx => Object.assign(bodies[idx], results[idx]))
  return bodies
}

export function getWallBodyPolygon(body) {
  return [body.faceStart, body.faceEnd, body.outerEnd, body.outerStart]
}

// A brand-new wall isn't connected to anything yet, so there's no polygon
// orientation to derive its outward side from -- guess by pointing thickness
// away from the centroid of whatever's already drawn, which is right far
// more often than a fixed default when a room is built as several
// disconnected open runs (each wall's own draw direction can point either
// way, unlike a fully closed loop where orientation is unambiguous).
export function chooseDefaultThicknessSide(x1, y1, x2, y2, existingWalls) {
  if (!existingWalls || existingWalls.length === 0) return 'right'
  let cx = 0, cy = 0, n = 0
  existingWalls.forEach(w => { cx += w.x1 + w.x2; cy += w.y1 + w.y2; n += 2 })
  cx /= n; cy /= n
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const dir = normalize(x2 - x1, y2 - y1)
  const normalRight = outwardNormal(dir.dx, dir.dy, 1)
  const dot = (mx - cx) * normalRight.nx + (my - cy) * normalRight.ny
  return dot >= 0 ? 'right' : 'left'
}

// Element (window/door) wall-embed anchors sit on the wall's face line by
// projection, but the element itself should be centered across the wall's
// actual thickness, not sitting half in the room -- offset by half the
// interpolated outward vector at that point along the wall.
export function getWallMidlinePoint(body, faceX, faceY, t) {
  const os = { x: body.outerStart.x - body.faceStart.x, y: body.outerStart.y - body.faceStart.y }
  const oe = { x: body.outerEnd.x - body.faceEnd.x, y: body.outerEnd.y - body.faceEnd.y }
  const ox = os.x + t * (oe.x - os.x), oy = os.y + t * (oe.y - os.y)
  return { x: faceX + ox / 2, y: faceY + oy / 2 }
}

function legacyWindingSign(walls) {
  if (walls.length < 3) return 1
  let sum = 0
  walls.forEach(w => { sum += (w.x2 - w.x1) * (w.y2 + w.y1) })
  return sum > 0 ? 1 : -1
}

// Old model always rendered a wall body symmetric around its stored centerline
// (+/- halfThickness), regardless of lengthMode -- lengthMode only ever changed
// a displayed number and a cosmetic stroke trim, never the real geometry. So the
// room face a legacy project's cabinets are actually snapped against is simply
// the centerline moved halfThickness towards the room interior, independent of
// whatever lengthMode was set -- migration ignores lengthMode entirely.
export function migrateLegacyWalls(walls, legacyThickness = DEFAULT_WALL_THICKNESS, scale = 1, threshold = DEFAULT_JOIN_THRESHOLD) {
  if (!walls || walls.length === 0) return walls
  const alreadyMigrated = walls.every(w => w.thickness != null && w.lengthMode === undefined)
  if (alreadyMigrated) return walls
  const halfT = (legacyThickness * scale) / 2
  const thicknessOf = () => halfT
  const loop = traceClosedPolygon(walls, threshold)
  let results
  if (loop) {
    results = offsetClosedLoop(walls, loop, thicknessOf, -1)
  } else {
    const sign = legacyWindingSign(walls)
    results = offsetOpenChain(walls, thicknessOf, (w, i, dir) => {
      const { dx, dy } = dir
      return { nx: dy * sign, ny: -dx * sign }
    }, threshold)
  }
  return walls.map((w, i) => {
    const r = results[i]
    const faceStart = r?.outerStart ? { x: r.outerStart.x, y: r.outerStart.y } : { x: w.x1, y: w.y1 }
    const faceEnd = r?.outerEnd ? { x: r.outerEnd.x, y: r.outerEnd.y } : { x: w.x2, y: w.y2 }
    const dir = wallDir(w)
    const sign = legacyWindingSign(walls)
    const normal = outwardNormal(dir.dx, dir.dy, sign)
    const thicknessSide = (normal.nx * dir.dy - normal.ny * dir.dx) >= 0 ? 'right' : 'left'
    return {
      id: w.id || `w${i}-${Date.now()}`,
      x1: faceStart.x, y1: faceStart.y, x2: faceEnd.x, y2: faceEnd.y,
      thickness: legacyThickness,
      thicknessSide: loop ? undefined : thicknessSide,
    }
  })
}
