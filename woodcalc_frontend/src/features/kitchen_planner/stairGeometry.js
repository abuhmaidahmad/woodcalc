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

// Single source of truth for a stair's stepped shape: one solid box per tread,
// stacked along the walking direction from the start point. Every consumer
// (2D preview/symbol, 3D mesh, SAT collision, cabinet top_profile sampling)
// reads this instead of deriving the geometry itself.
export function computeStairSteps(stair) {
  const derived = computeStairDerived(stair)
  const { treadCount, going, riserHeight } = derived
  const width = stair.width || DEFAULT_STAIR_WIDTH
  const side = stair.flip ? -1 : 1
  const rad = ((stair.rotation || 0) * Math.PI) / 180
  const dirX = Math.cos(rad), dirY = Math.sin(rad)
  const perpX = -dirY * side, perpY = dirX * side

  const steps = []
  for (let i = 0; i < treadCount; i++) {
    const d0 = i * going, d1 = (i + 1) * going
    const p0x = stair.x + dirX * d0, p0y = stair.y + dirY * d0
    const p1x = stair.x + dirX * d1, p1y = stair.y + dirY * d1
    const w0x = p0x + perpX * width, w0y = p0y + perpY * width
    const w1x = p1x + perpX * width, w1y = p1y + perpY * width
    steps.push({
      index: i,
      topHeight: (i + 1) * riserHeight,
      footprint: [[p0x, p0y], [p1x, p1y], [w1x, w1y], [w0x, w0y]],
    })
  }

  return { ...derived, width, flip: !!stair.flip, rotation: stair.rotation || 0, steps }
}

// Overall plan-view bounding rectangle (start face, end face, both sides) --
// used for the drawing preview and for click/drag hit targets, without
// needing every individual step footprint.
export function getStairOutline(stair) {
  const derived = computeStairDerived(stair)
  const width = stair.width || DEFAULT_STAIR_WIDTH
  const side = stair.flip ? -1 : 1
  const rad = ((stair.rotation || 0) * Math.PI) / 180
  const dirX = Math.cos(rad), dirY = Math.sin(rad)
  const perpX = -dirY * side, perpY = dirX * side
  const runLength = derived.runLength
  const p0x = stair.x, p0y = stair.y
  const p1x = stair.x + dirX * runLength, p1y = stair.y + dirY * runLength
  const w0x = p0x + perpX * width, w0y = p0y + perpY * width
  const w1x = p1x + perpX * width, w1y = p1y + perpY * width
  return [[p0x, p0y], [p1x, p1y], [w1x, w1y], [w0x, w0y]]
}
