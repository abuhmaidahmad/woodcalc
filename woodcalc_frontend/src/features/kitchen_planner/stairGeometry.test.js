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

const MIDDLE_FLIGHT_STEPS = 1, U_STEPS_BEFORE_TURN = 4

function makeUStair(turnDirection, flip, overrides = {}) {
  return {
    x: 0, y: 0, rotation: 0, width: WIDTH, going: GOING, maxRiser: MAX_RISER, totalRise: TOTAL_RISE,
    shape: 'U-winder', windersPerTurn: WINDERS, stepsBeforeTurn: U_STEPS_BEFORE_TURN,
    middleFlightSteps: MIDDLE_FLIGHT_STEPS,
    turnDirection, flip, pivotOffset: 0, walklineOffset: 450,
    ...overrides,
  }
}

describe.each([
  ['left', false], ['right', false], ['left', true], ['right', true],
])('computeStairSteps U-winder (turn=%s, flip=%s)', (turnDirection, flip) => {
  const stair = makeUStair(turnDirection, flip)
  const data = computeStairSteps(stair)
  const steps = data.steps
  const turn1Start = U_STEPS_BEFORE_TURN
  const turn2Start = U_STEPS_BEFORE_TURN + WINDERS + MIDDLE_FLIGHT_STEPS
  const upperStart = turn2Start + WINDERS

  it('has 16 risers and 15 treads, all accounted for (lower + turn1 + middle + turn2 + upper)', () => {
    expect(data.riserCount).toBe(16)
    expect(data.treadCount).toBe(15)
    expect(steps.length).toBe(15)
    expect(upperStart + data.upperFlightTreads).toBe(15)
  })

  it('returns steps in walking order with strictly increasing, evenly-spaced top heights', () => {
    for (let i = 0; i < steps.length; i++) {
      const expected = (i + 1) * EXPECTED_RISER_HEIGHT
      expect(steps[i].topHeight).toBeCloseTo(expected, 6)
      if (i > 0) expect(steps[i].topHeight - steps[i - 1].topHeight).toBeCloseTo(EXPECTED_RISER_HEIGHT, 6)
    }
  })

  it('both turns tile their own width x width square with no overlap, and every winder is simple with positive area', () => {
    for (const start of [turn1Start, turn2Start]) {
      const polys = steps.slice(start, start + WINDERS).map(s => s.footprint)
      polys.forEach(p => {
        expect(polygonArea(p)).toBeGreaterThan(0)
        expect(isSimplePolygon(p)).toBe(true)
      })
      const totalArea = polys.reduce((s, p) => s + polygonArea(p), 0)
      expect(totalArea).toBeCloseTo(WIDTH * WIDTH, 0)
      for (let i = 0; i < polys.length; i++) {
        for (let j = i + 1; j < polys.length; j++) {
          expect(polysOverlapArea(polys[i], polys[j])).toBe(false)
        }
      }
    }
  })

  it('turn 1 shares a full width edge with the last lower-flight tread', () => {
    expect(sharedEdgeLength(steps[turn1Start - 1].footprint, steps[turn1Start].footprint)).toBeCloseTo(WIDTH, 0)
  })

  it('turn 1 shares a full width edge with the first middle-flight tread', () => {
    expect(sharedEdgeLength(steps[turn1Start + WINDERS - 1].footprint, steps[turn1Start + WINDERS].footprint)).toBeCloseTo(WIDTH, 0)
  })

  it('turn 2 shares a full width edge with the first upper-flight tread', () => {
    expect(sharedEdgeLength(steps[turn2Start + WINDERS - 1].footprint, steps[upperStart].footprint)).toBeCloseTo(WIDTH, 0)
  })

  it('each turn radiates from its own inner-corner pivot and its kite contains the outer corner', () => {
    for (const start of [turn1Start, turn2Start]) {
      const winders = steps.slice(start, start + WINDERS).map(s => s.footprint)
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
    }
  })

  it('the upper flight walks anti-parallel to the lower flight (a true 180 degree U, not a 360 loop)', () => {
    const lower = steps[0].footprint
    const upper = steps[upperStart].footprint
    const lowerDir = [lower[1][0] - lower[0][0], lower[1][1] - lower[0][1]]
    const upperDir = [upper[1][0] - upper[0][0], upper[1][1] - upper[0][1]]
    const lowerLen = Math.hypot(...lowerDir), upperLen = Math.hypot(...upperDir)
    const dot = (lowerDir[0] * upperDir[0] + lowerDir[1] * upperDir[1]) / (lowerLen * upperLen)
    expect(dot).toBeCloseTo(-1, 6)
  })

  it('the lower and upper flights are separated by exactly middleFlightSteps*going (the well width) along their shared width axis', () => {
    const lower = steps[0].footprint
    const upper = steps[upperStart].footprint
    const widthAxis = [lower[3][0] - lower[0][0], lower[3][1] - lower[0][1]]
    const axisLen = Math.hypot(...widthAxis)
    const unit = [widthAxis[0] / axisLen, widthAxis[1] / axisLen]
    const project = (p) => p[0] * unit[0] + p[1] * unit[1]
    const lowerProj = lower.map(project), upperProj = upper.map(project)
    const lowerMin = Math.min(...lowerProj), lowerMax = Math.max(...lowerProj)
    const upperMin = Math.min(...upperProj), upperMax = Math.max(...upperProj)
    const gap = Math.max(upperMin - lowerMax, lowerMin - upperMax)
    expect(gap).toBeCloseTo(MIDDLE_FLIGHT_STEPS * GOING, 0)
    expect(data.wellWidth).toBeCloseTo(MIDDLE_FLIGHT_STEPS * GOING, 6)
  })

  it('every footprint winds consistently (same sign of signed area throughout, matching the L-winder convention)', () => {
    const signs = steps.map(s => signedArea(s.footprint) >= 0)
    expect(signs.every(s => s === signs[0])).toBe(true)
  })

  it('every straight segment has the same basis determinant (matching side): turns never flip chirality mid-chain', () => {
    // Infer each segment's own (dir, perp) directly from its footprint's edges
    // (footprint = [p0,p1,w1,w0], so p1-p0 is the walking direction and
    // w0-p0 is the width direction) -- determinant sign is scale-invariant,
    // so this is a black-box check of the actual geometry produced, not of
    // applyTurn's internals.
    const basisDet = (fp) => {
      const dir = [fp[1][0] - fp[0][0], fp[1][1] - fp[0][1]]
      const perp = [fp[3][0] - fp[0][0], fp[3][1] - fp[0][1]]
      return Math.sign(dir[0] * perp[1] - perp[0] * dir[1])
    }
    const expectedSign = flip ? -1 : 1
    const lowerDet = basisDet(steps[0].footprint)
    const middleDet = basisDet(steps[turn1Start + WINDERS].footprint)
    const upperDet = basisDet(steps[upperStart].footprint)
    expect(lowerDet).toBe(expectedSign)
    expect(middleDet).toBe(expectedSign)
    expect(upperDet).toBe(expectedSign)
  })

  it("both turns' pivots sit on the well side, between the two parallel flights", () => {
    const lower = steps[0].footprint
    const widthAxis = [lower[3][0] - lower[0][0], lower[3][1] - lower[0][1]]
    const axisLen = Math.hypot(...widthAxis)
    const unit = [widthAxis[0] / axisLen, widthAxis[1] / axisLen]
    const project = (p) => p[0] * unit[0] + p[1] * unit[1]
    const lowerMax = Math.max(...lower.map(project))
    const upper = steps[upperStart].footprint
    const upperMin = Math.min(...upper.map(project))
    const wellMin = Math.min(lowerMax, upperMin), wellMax = Math.max(lowerMax, upperMin)
    for (const start of [turn1Start, turn2Start]) {
      const winders = steps.slice(start, start + WINDERS).map(s => s.footprint)
      const [first, mid, last] = winders
      const pivot = first.find(v => findVertex(mid, v) && findVertex(last, v))
      const p = project(pivot)
      expect(p).toBeGreaterThanOrEqual(wellMin - 0.5)
      expect(p).toBeLessThanOrEqual(wellMax + 0.5)
    }
  })
})

describe('computeStairSteps U-winder with middleFlightSteps=0', () => {
  it('turn 1 and turn 2 sit immediately adjacent, sharing a full width edge', () => {
    const stair = makeUStair('left', false, { middleFlightSteps: 0 })
    const data = computeStairSteps(stair)
    const turn1Start = U_STEPS_BEFORE_TURN
    const turn2Start = U_STEPS_BEFORE_TURN + WINDERS
    expect(sharedEdgeLength(data.steps[turn1Start + WINDERS - 1].footprint, data.steps[turn2Start].footprint)).toBeCloseTo(WIDTH, 0)
  })
})
