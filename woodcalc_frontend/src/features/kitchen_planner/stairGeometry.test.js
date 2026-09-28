import { describe, it, expect } from 'vitest'
import { computeStairSteps } from './stairGeometry'

function signedArea(poly) {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]
    s += x1 * y2 - x2 * y1
  }
  return s / 2
}

function polygonArea(poly) {
  return Math.abs(signedArea(poly))
}

function segmentsProperlyIntersect(p1, p2, p3, p4) {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

function isSimplePolygon(poly) {
  const n = poly.length
  if (n < 4) return true
  for (let i = 0; i < n; i++) {
    const a1 = poly[i], a2 = poly[(i + 1) % n]
    for (let j = i + 1; j < n; j++) {
      if (j === i || (j + 1) % n === i) continue
      const b1 = poly[j], b2 = poly[(j + 1) % n]
      if (segmentsProperlyIntersect(a1, a2, b1, b2)) return false
    }
  }
  return true
}

function samePoint(a, b, tol = 0.5) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol
}

function findVertex(poly, point, tol = 0.5) {
  return poly.some(v => samePoint(v, point, tol))
}

function sharedEdgeLength(polyA, polyB, tol = 0.5) {
  const shared = []
  polyA.forEach(va => {
    if (polyB.some(vb => samePoint(va, vb, tol)) && !shared.some(s => samePoint(s, va, tol))) shared.push(va)
  })
  if (shared.length < 2) return 0
  let maxDist = 0
  for (let i = 0; i < shared.length; i++) {
    for (let j = i + 1; j < shared.length; j++) {
      maxDist = Math.max(maxDist, Math.hypot(shared[i][0] - shared[j][0], shared[i][1] - shared[j][1]))
    }
  }
  return maxDist
}

function polysOverlapArea(polyA, polyB) {
  const inside = (poly, [px, py]) => {
    let in_ = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j]
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) in_ = !in_
    }
    return in_
  }
  const centroid = (poly) => poly.reduce((acc, p) => [acc[0] + p[0] / poly.length, acc[1] + p[1] / poly.length], [0, 0])
  const ca = centroid(polyA), cb = centroid(polyB)
  return inside(polyB, ca) || inside(polyA, cb)
}

const WIDTH = 900, GOING = 280, TOTAL_RISE = 2800, MAX_RISER = 180, WINDERS = 3, STEPS_BEFORE_TURN = 6
const EXPECTED_RISER_HEIGHT = TOTAL_RISE / 16

function makeStair(turnDirection, flip) {
  return {
    x: 0, y: 0, rotation: 0, width: WIDTH, going: GOING, maxRiser: MAX_RISER, totalRise: TOTAL_RISE,
    shape: 'L-winder', windersPerTurn: WINDERS, stepsBeforeTurn: STEPS_BEFORE_TURN,
    turnDirection, flip, pivotOffset: 0, walklineOffset: 450,
  }
}

describe.each([
  ['left', false], ['right', false], ['left', true], ['right', true],
])('computeStairSteps L-winder (turn=%s, flip=%s)', (turnDirection, flip) => {
  const stair = makeStair(turnDirection, flip)
  const data = computeStairSteps(stair)
  const steps = data.steps

  it('has 16 risers and 15 treads', () => {
    expect(data.riserCount).toBe(16)
    expect(data.treadCount).toBe(15)
    expect(steps.length).toBe(15)
  })

  it('returns steps in walking order with strictly increasing, evenly-spaced top heights', () => {
    for (let i = 0; i < steps.length; i++) {
      const expected = (i + 1) * EXPECTED_RISER_HEIGHT
      expect(steps[i].topHeight).toBeCloseTo(expected, 6)
      if (i > 0) expect(steps[i].topHeight - steps[i - 1].topHeight).toBeCloseTo(EXPECTED_RISER_HEIGHT, 6)
    }
  })

  it('last step top height equals totalRise minus one riser', () => {
    expect(steps[steps.length - 1].topHeight).toBeCloseTo(TOTAL_RISE - EXPECTED_RISER_HEIGHT, 6)
  })

  it('winder polygons (indices 6,7,8) each have positive area and are simple (non-self-intersecting)', () => {
    for (let i = STEPS_BEFORE_TURN; i < STEPS_BEFORE_TURN + WINDERS; i++) {
      expect(polygonArea(steps[i].footprint)).toBeGreaterThan(0)
      expect(isSimplePolygon(steps[i].footprint)).toBe(true)
    }
  })

  it('the 3 winder polygons exactly tile the width x width turn square with no overlap', () => {
    const winderPolys = steps.slice(STEPS_BEFORE_TURN, STEPS_BEFORE_TURN + WINDERS).map(s => s.footprint)
    const totalArea = winderPolys.reduce((s, p) => s + polygonArea(p), 0)
    expect(totalArea).toBeCloseTo(WIDTH * WIDTH, 0)
    for (let i = 0; i < winderPolys.length; i++) {
      for (let j = i + 1; j < winderPolys.length; j++) {
        expect(polysOverlapArea(winderPolys[i], winderPolys[j])).toBe(false)
      }
    }
  })

  it('the first winder shares a full width edge with the last lower-flight tread', () => {
    const lastLower = steps[STEPS_BEFORE_TURN - 1].footprint
    const firstWinder = steps[STEPS_BEFORE_TURN].footprint
    expect(sharedEdgeLength(lastLower, firstWinder)).toBeCloseTo(WIDTH, 0)
  })

  it('the last winder shares a full width edge with the first upper-flight tread', () => {
    const lastWinder = steps[STEPS_BEFORE_TURN + WINDERS - 1].footprint
    const firstUpper = steps[STEPS_BEFORE_TURN + WINDERS].footprint
    expect(sharedEdgeLength(lastWinder, firstUpper)).toBeCloseTo(WIDTH, 0)
  })

  it('all winders radiate from a single shared inner-corner pivot vertex, and the middle (kite) winder contains the outer corner', () => {
    const winders = steps.slice(STEPS_BEFORE_TURN, STEPS_BEFORE_TURN + WINDERS).map(s => s.footprint)
    const [first, mid, last] = winders
    const pivotCandidates = first.filter(v => findVertex(mid, v) && findVertex(last, v))
    expect(pivotCandidates.length).toBeGreaterThanOrEqual(1)
    const pivot = pivotCandidates[0]
    const kite = winders.reduce((a, b) => (b.length > a.length ? b : a))
    expect(kite.length).toBe(4)
    const outerCorner = kite.reduce((farthest, v) => {
      const d = Math.hypot(v[0] - pivot[0], v[1] - pivot[1])
      return d > farthest.d ? { v, d } : farthest
    }, { v: null, d: -1 }).v
    expect(Math.hypot(outerCorner[0] - pivot[0], outerCorner[1] - pivot[1])).toBeCloseTo(WIDTH * Math.SQRT2, 0)
    expect(findVertex(first, outerCorner)).toBe(false)
    expect(findVertex(last, outerCorner)).toBe(false)
  })

  it('the upper flight leaves the square perpendicular to the lower flight', () => {
    const lower = steps[0].footprint
    const upper = steps[STEPS_BEFORE_TURN + WINDERS].footprint
    const lowerDir = [lower[1][0] - lower[0][0], lower[1][1] - lower[0][1]]
    const upperDir = [upper[1][0] - upper[0][0], upper[1][1] - upper[0][1]]
    const lowerLen = Math.hypot(...lowerDir), upperLen = Math.hypot(...upperDir)
    const dot = (lowerDir[0] * upperDir[0] + lowerDir[1] * upperDir[1]) / (lowerLen * upperLen)
    expect(Math.abs(dot)).toBeLessThan(1e-6)
  })

  it('every footprint winds consistently (same sign of signed area throughout)', () => {
    const signs = steps.map(s => signedArea(s.footprint) >= 0)
    expect(signs.every(s => s === signs[0])).toBe(true)
  })
})
