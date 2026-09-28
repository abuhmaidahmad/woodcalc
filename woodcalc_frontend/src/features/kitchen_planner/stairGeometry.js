export const DEFAULT_STAIR_WIDTH = 900
export const DEFAULT_GOING = 280
export const DEFAULT_MAX_RISER = 180
export const DEFAULT_NOSING = 0
export const DEFAULT_TOTAL_RISE = 2800

export function makeStairId() {
  return `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function computeStairDerived(stair) {
  const totalRise = stair.totalRise || DEFAULT_TOTAL_RISE
  const maxRiser = stair.maxRiser || DEFAULT_MAX_RISER
  const riserCount = Math.max(1, Math.ceil(totalRise / maxRiser))
  const riserHeight = totalRise / riserCount
  const treadCount = Math.max(0, riserCount - 1)
  const going = stair.going || DEFAULT_GOING
  const runLength = treadCount * going

  const warnings = []
  const comfortSum = 2 * riserHeight + going
  if (comfortSum < 600 || comfortSum > 650) warnings.push({ code: 'comfort', value: Math.round(comfortSum) })
  if (riserHeight < 150 || riserHeight > 190) warnings.push({ code: 'riser', value: Math.round(riserHeight) })
  if (going < 250 || going > 300) warnings.push({ code: 'going', value: Math.round(going) })

  return { totalRise, maxRiser, riserCount, riserHeight, treadCount, going, runLength, warnings }
}

export function goingFromRunLength(stair, runLength) {
  const totalRise = stair.totalRise || DEFAULT_TOTAL_RISE
  const maxRiser = stair.maxRiser || DEFAULT_MAX_RISER
  const riserCount = Math.max(1, Math.ceil(totalRise / maxRiser))
  const treadCount = Math.max(1, riserCount - 1)
  return runLength / treadCount
}

function signedArea(poly) {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]
    s += x1 * y2 - x2 * y1
  }
  return s / 2
}

// Every footprint must wind the same way (matching `side`, the same +-1
// flip already used for the width axis) regardless of which code path built
// it -- the turn's canonical-to-real conversion is a reflection for one
// turnDirection but not the other, which otherwise leaves the winder/upper-
// flight footprints wound opposite to the lower flight's. Consumers that
// rely on consistent winding (3D face normals, signed-area area checks)
// would otherwise silently break for exactly one turnDirection.
function normalizeWinding(steps, side) {
  const expectPositive = side >= 0
  return steps.map(step => {
    const area = signedArea(step.footprint)
    if ((area >= 0) === expectPositive) return step
    return { ...step, footprint: [...step.footprint].reverse() }
  })
}

function straightFlightSteps(startIndex, treadCount, going, riserHeight, originX, originY, dirX, dirY, perpX, perpY, width) {
  const steps = []
  for (let i = 0; i < treadCount; i++) {
    const d0 = i * going, d1 = (i + 1) * going
    const p0x = originX + dirX * d0, p0y = originY + dirY * d0
    const p1x = originX + dirX * d1, p1y = originY + dirY * d1
    const w0x = p0x + perpX * width, w0y = p0y + perpY * width
    const w1x = p1x + perpX * width, w1y = p1y + perpY * width
    steps.push({
      index: startIndex + i,
      topHeight: (startIndex + i + 1) * riserHeight,
      footprint: [[p0x, p0y], [p1x, p1y], [w1x, w1y], [w0x, w0y]],
    })
  }
  return steps
}

function computeStraightSteps(stair) {
  const derived = computeStairDerived(stair)
  const { treadCount, going, riserHeight } = derived
  const width = stair.width || DEFAULT_STAIR_WIDTH
  const side = stair.flip ? -1 : 1
  const rad = ((stair.rotation || 0) * Math.PI) / 180
  const dirX = Math.cos(rad), dirY = Math.sin(rad)
  const perpX = -dirY * side, perpY = dirX * side

  const steps = normalizeWinding(straightFlightSteps(0, treadCount, going, riserHeight, stair.x, stair.y, dirX, dirY, perpX, perpY, width), side)

  return { ...derived, width, flip: !!stair.flip, rotation: stair.rotation || 0, steps }
}

export const DEFAULT_TURN_DIRECTION = 'left'
export const DEFAULT_WINDERS_PER_TURN = 3
export const DEFAULT_PIVOT_OFFSET = 0
export const DEFAULT_WALKLINE_OFFSET = 450
export const MIN_WINDER_NARROW_MM = 50

export function getWalklineOffset(stair) {
  const width = stair.width || DEFAULT_STAIR_WIDTH
  return Math.min(stair.walklineOffset || DEFAULT_WALKLINE_OFFSET, width / 2)
}

// One 90 degree turn's tread footprints, in a canonical local (p,q) frame
// centered on the pivot at (0,0): q=width (p=0) is the straight-line
// continuation of the LAST LOWER-FLIGHT tread's own far edge (so phi=0
// walks that same edge out to the square's boundary), and p=width (q=0) is
// the continuation of the FIRST UPPER-FLIGHT tread's own near edge (so
// phi=90 walks that edge) -- phi sweeps between them. windersPerTurn treads
// split that 90 degrees into EQUAL angles -- equal angles is what makes
// every winder's walkline going equal (arc length is proportional to angle
// at the walkline's constant radius from that same pivot), not an
// assumption made in place of checking the walkline. pivotOffset only
// chamfers the two outermost boundaries (the ones that coincide with the
// pre-existing wall lines) -- interior boundaries between winders always
// meet exactly at the pivot.
function winderTurnLocalPolygons(width, windersPerTurn, pivotOffset) {
  const rayHit = (phiDeg) => {
    const phi = (phiDeg * Math.PI) / 180
    const t = Math.tan(phi)
    if (phiDeg <= 45) return [width * t, width]
    return [width, width / t]
  }
  const angleStep = 90 / windersPerTurn
  const polygons = []
  for (let w = 0; w < windersPerTurn; w++) {
    const phiA = w * angleStep, phiB = (w + 1) * angleStep
    const innerA = w === 0 ? [0, pivotOffset] : [0, 0]
    const innerB = w === windersPerTurn - 1 ? [pivotOffset, 0] : [0, 0]
    const outerA = rayHit(phiA)
    const outerB = rayHit(phiB)
    const points = [innerA]
    if (phiA < 45 && phiB > 45) points.push(outerA, [width, width], outerB)
    else points.push(outerA, outerB)
    if (innerB[0] !== innerA[0] || innerB[1] !== innerA[1]) points.push(innerB)
    polygons.push({ points, phiA, phiB })
  }
  return polygons
}

// Maps a turn-canonical q (0 at the true inner-corner pivot, increasing
// toward the outer/kite corner) onto the SAME real q axis the straight
// flights already use (0..width, matching the lower flight's own width
// side) -- so the turn square always sits flush with the lower flight
// instead of mirroring to the far side. Which real edge (q=0 or q=width)
// the pivot actually falls on depends on turnDirection: a left turn's
// pivot is the lower flight's FAR (q=width) edge, a right turn's pivot is
// its NEAR (q=0) edge -- verified against the actual solid L-shaped
// footprint (the pivot is wherever the lower flight's, turn square's, and
// upper flight's solid regions all meet, leaving only one quadrant empty).
function qRealFromCanon(qCanon, width, turnSign) {
  return turnSign > 0 ? width - qCanon : qCanon
}

function computeWinderSteps(stair) {
  const derived = computeStairDerived(stair)
  const { treadCount, going, riserHeight } = derived
  const width = stair.width || DEFAULT_STAIR_WIDTH
  const side = stair.flip ? -1 : 1
  const rad = ((stair.rotation || 0) * Math.PI) / 180
  const dirX = Math.cos(rad), dirY = Math.sin(rad)
  const perpX = -dirY * side, perpY = dirX * side

  const windersPerTurn = stair.windersPerTurn || DEFAULT_WINDERS_PER_TURN
  const pivotOffset = stair.pivotOffset || DEFAULT_PIVOT_OFFSET
  const turnDirection = stair.turnDirection || DEFAULT_TURN_DIRECTION
  const turnSign = turnDirection === 'left' ? 1 : -1
  const walklineOffset = getWalklineOffset(stair)

  const warnings = [...derived.warnings]
  const maxStepsBeforeTurn = Math.max(0, treadCount - windersPerTurn)
  const requestedStepsBeforeTurn = stair.stepsBeforeTurn ?? maxStepsBeforeTurn
  const stepsBeforeTurn = Math.min(Math.max(0, requestedStepsBeforeTurn), maxStepsBeforeTurn)
  if (requestedStepsBeforeTurn !== stepsBeforeTurn) warnings.push({ code: 'stepsBeforeTurnClamped', value: stepsBeforeTurn, level: 'warning' })
  const upperFlightTreads = Math.max(0, treadCount - stepsBeforeTurn - windersPerTurn)

  const angleStepRad = ((90 / windersPerTurn) * Math.PI) / 180
  const walklineGoing = walklineOffset * angleStepRad
  warnings.push({ code: 'walklineGoing', value: Math.round(walklineGoing), target: Math.round(going), level: 'info' })
  const winderComfort = 2 * riserHeight + walklineGoing
  if (winderComfort < 550 || winderComfort > 700) warnings.push({ code: 'winderComfort', value: Math.round(winderComfort), level: 'warning' })

  const toWorld = (pCanon, qCanon) => {
    const realP = stepsBeforeTurn * going + pCanon
    const realQ = qRealFromCanon(qCanon, width, turnSign)
    return [stair.x + realP * dirX + realQ * perpX, stair.y + realP * dirY + realQ * perpY]
  }

  const steps = straightFlightSteps(0, stepsBeforeTurn, going, riserHeight, stair.x, stair.y, dirX, dirY, perpX, perpY, width)

  const winderPolys = winderTurnLocalPolygons(width, windersPerTurn, pivotOffset)
  winderPolys.forEach((poly, w) => {
    const footprint = poly.points.map(([p, q]) => toWorld(p, q))
    const isEndWinder = w === 0 || w === winderPolys.length - 1
    const narrowEndMm = isEndWinder ? pivotOffset : 0
    if (narrowEndMm < MIN_WINDER_NARROW_MM) warnings.push({ code: 'winderNarrowEnd', value: Math.round(narrowEndMm), index: w, level: 'warning' })
    steps.push({
      index: stepsBeforeTurn + w,
      topHeight: (stepsBeforeTurn + w + 1) * riserHeight,
      footprint,
    })
  })

  for (let j = 0; j < upperFlightTreads; j++) {
    const q0 = -(j * going), q1 = -((j + 1) * going)
    const a = toWorld(0, q0), b = toWorld(0, q1), c = toWorld(width, q1), d = toWorld(width, q0)
    steps.push({
      index: stepsBeforeTurn + windersPerTurn + j,
      topHeight: (stepsBeforeTurn + windersPerTurn + j + 1) * riserHeight,
      footprint: [a, b, c, d],
    })
  }

  return {
    ...derived, width, flip: !!stair.flip, rotation: stair.rotation || 0, steps: normalizeWinding(steps, side),
    turnDirection, windersPerTurn, stepsBeforeTurn, pivotOffset, walklineOffset,
    upperFlightTreads, walklineGoing,
    warnings,
  }
}

// Single source of truth for a stair's stepped shape: one solid volume per
// tread, stacked along the walking path from the start point (straight,
// L-winder, or -- once added -- U-winder). Every consumer (2D preview/
// symbol, 3D mesh, SAT collision, cabinet top_profile sampling) reads this
// instead of deriving the geometry itself.
export function computeStairSteps(stair) {
  if (stair.shape === 'L-winder') return computeWinderSteps(stair)
  return computeStraightSteps(stair)
}

// A polyline through the middle of the walking surface, offset walklineOffset
// from the inner side of the stair, following the path through any turn --
// used for the 2D walkline overlay and its UP arrow/label. For a straight
// stair this is just its centerline-ish offset line; for a winder it follows
// the same canonical (p,q) turn frame computeWinderSteps uses, arcing around
// the pivot at radius walklineOffset.
export function computeWalklinePath(stair) {
  const width = stair.width || DEFAULT_STAIR_WIDTH
  const side = stair.flip ? -1 : 1
  const rad = ((stair.rotation || 0) * Math.PI) / 180
  const dirX = Math.cos(rad), dirY = Math.sin(rad)
  const perpX = -dirY * side, perpY = dirX * side
  const walklineOffset = getWalklineOffset(stair)

  if (stair.shape !== 'L-winder') {
    const derived = computeStairDerived(stair)
    const p0x = stair.x + perpX * walklineOffset, p0y = stair.y + perpY * walklineOffset
    const p1x = p0x + dirX * derived.runLength, p1y = p0y + dirY * derived.runLength
    return [[p0x, p0y], [p1x, p1y]]
  }

  const derived = computeStairDerived(stair)
  const windersPerTurn = stair.windersPerTurn || DEFAULT_WINDERS_PER_TURN
  const maxStepsBeforeTurn = Math.max(0, derived.treadCount - windersPerTurn)
  const stepsBeforeTurn = Math.min(Math.max(0, stair.stepsBeforeTurn ?? maxStepsBeforeTurn), maxStepsBeforeTurn)
  const upperFlightTreads = Math.max(0, derived.treadCount - stepsBeforeTurn - windersPerTurn)
  const turnSign = (stair.turnDirection || DEFAULT_TURN_DIRECTION) === 'left' ? 1 : -1
  const going = stair.going || DEFAULT_GOING

  const toWorld = (pCanon, qCanon) => {
    const realP = stepsBeforeTurn * going + pCanon
    const realQ = qRealFromCanon(qCanon, width, turnSign)
    return [stair.x + realP * dirX + realQ * perpX, stair.y + realP * dirY + realQ * perpY]
  }

  const points = []
  points.push(toWorld(-stepsBeforeTurn * going, walklineOffset), toWorld(0, walklineOffset))
  const ARC_STEPS = 12
  for (let i = 1; i <= ARC_STEPS; i++) {
    const phi = (i / ARC_STEPS) * (Math.PI / 2)
    points.push(toWorld(Math.sin(phi) * walklineOffset, Math.cos(phi) * walklineOffset))
  }
  points.push(toWorld(walklineOffset, -(upperFlightTreads * going)))

  return points
}

function pointInPolygon(px, py, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside
  }
  return inside
}

export const STAIR_TOP_PROFILE_SEGMENTS = 8
export const STAIR_TOP_PROFILE_CLEARANCE_MM = 5

// Samples the stair's step top-heights across a cabinet's plan footprint,
// divided into segmentCount slices along the cabinet's own width axis. Each
// segment's capHeight is the lowest step ceiling found anywhere within that
// width slice (sampled across the full depth too), in absolute floor-based
// mm -- or null where no step overhangs that slice at all. This is the one
// place that maps "a stair sits over this cabinet" into a height constraint;
// resolveSteppedCabinetProfile (formulaEngine.js) turns it into an actual
// carcass height, and Stair3D-adjacent rendering/BOM code both read from
// that, so nobody re-derives this sampling independently.
export function computeStairTopProfile(stair, cab, segmentCount = STAIR_TOP_PROFILE_SEGMENTS) {
  const rad = ((cab.rotation || 0) * Math.PI) / 180
  const cos = Math.cos(rad), sin = Math.sin(rad)
  const toWorld = (lx, ly) => ({ x: cab.x + lx * cos - ly * sin, y: cab.y + lx * sin + ly * cos })
  const steps = computeStairSteps(stair).steps
  const DEPTH_SAMPLES = 4
  const segments = []
  let overlaps = false
  for (let i = 0; i < segmentCount; i++) {
    const x0 = (i / segmentCount) * cab.width
    const x1 = ((i + 1) / segmentCount) * cab.width
    const xc = (x0 + x1) / 2
    let capHeight = null
    for (let j = 0; j <= DEPTH_SAMPLES; j++) {
      const yc = (j / DEPTH_SAMPLES) * cab.depth
      const world = toWorld(xc, yc)
      steps.forEach(step => {
        if (!pointInPolygon(world.x, world.y, step.footprint)) return
        overlaps = true
        const h = step.topHeight - STAIR_TOP_PROFILE_CLEARANCE_MM
        if (capHeight == null || h < capHeight) capHeight = h
      })
    }
    segments.push({ x0, x1, capHeight })
  }
  return { overlaps, segments }
}

// Finds the first stair (in draw order) whose profile actually overlaps this
// cabinet's footprint -- the common case is at most one stair near any given
// tall unit, so first-match is enough rather than combining several.
export function findOverlappingStairProfile(cab, stairs, segmentCount = STAIR_TOP_PROFILE_SEGMENTS) {
  for (const stair of stairs) {
    const profile = computeStairTopProfile(stair, cab, segmentCount)
    if (profile.overlaps) return { stair, profile }
  }
  return null
}
