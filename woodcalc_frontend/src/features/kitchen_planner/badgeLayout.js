// Plan-view text and position-badge layout for cabinets on the room canvas.
//
// Labels are laid out per cabinet (cabTextLayout) so CabinetShape2D can draw them,
// and the same boxes feed placeBadges, which places every cabinet's numbered badge
// in canvas coordinates so no badge covers another badge, a label/dimension text,
// or a wall. Kept free of React/DOM (text width falls back to an estimate outside a
// browser) so it can be unit-tested directly.

export const BADGE_R = 7
const BADGE_GAP = 1 // min clearance between a badge and anything it must avoid
const LEADER_STEP = 16

const LABEL_FONT = 8
const DIMS_FONT = 7
const MIN_FONT = 5

let measureCtx
const widthCache = new Map()
export function measureTextWidth(text, fontSize, fontWeight = 400) {
  const key = `${fontWeight}|${fontSize}|${text}`
  if (widthCache.has(key)) return widthCache.get(key)
  let width
  try {
    if (measureCtx === undefined) {
      measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null
    }
    if (measureCtx) {
      const family = getComputedStyle(document.body).fontFamily || 'sans-serif'
      measureCtx.font = `${fontWeight} ${fontSize}px ${family}`
      width = measureCtx.measureText(text).width
    }
  } catch { /* fall through to the estimate */ }
  if (width == null) width = text.length * fontSize * 0.6
  widthCache.set(key, width)
  return width
}

const norm360 = a => ((a % 360) + 360) % 360

// Text should read left-to-right or bottom-to-top: anything whose on-screen
// direction lands in [90, 270) is turned another 180°.
export function needsFlip(screenAngle) {
  const e = norm360(screenAngle)
  return e >= 90 && e < 270
}

function cabSize(cab, scale) {
  return { w: cab.width * scale, h: cab.depth * scale }
}

// Local (cabinet-frame) point -> canvas point, matching CabinetShape2D's
// `translate(x,y) rotate(rot, w/2, h/2)`.
export function cabLocalToWorld(cab, scale, lx, ly) {
  const { w, h } = cabSize(cab, scale)
  const r = (cab.rotation || 0) * Math.PI / 180
  const dx = lx - w / 2, dy = ly - h / 2
  return [cab.x * scale + w / 2 + dx * Math.cos(r) - dy * Math.sin(r),
          cab.y * scale + h / 2 + dx * Math.sin(r) + dy * Math.cos(r)]
}

// Lines of plan text for one cabinet, in a "text frame" centered on the cabinet and
// placed by `transform` (local coords). A label that doesn't fit across the item but
// would along its depth (side panels, end panels) runs along the depth as a single
// "label · width" line; anything still too long shrinks down to MIN_FONT and is
// dropped past that, so it never spills onto a neighbour's label.
export function cabTextLayout(cab, scale, showDimensions) {
  const { w, h } = cabSize(cab, scale)
  const label = cab.label || ''
  const dims = showDimensions ? `${cab.width}mm` : null
  const labelW = measureTextWidth(label, LABEL_FONT, 700)
  const along = labelW > w - 2 && h > w
  const avail = (along ? h : w) - 2
  const fit = (text, size, weight) => {
    if (!text) return null
    const tw = measureTextWidth(text, size, weight)
    if (tw <= avail) return { text, size, width: tw }
    const s = size * avail / tw
    if (s < MIN_FONT) return null
    return { text, size: s, width: tw * s / size }
  }
  let lines
  if (along) {
    const one = fit(dims ? `${label} · ${dims}` : label, LABEL_FONT, 700) || fit(label, LABEL_FONT, 700)
    lines = one ? [{ ...one, weight: 700, fill: '#333', y: 3 }] : []
  } else {
    const l = fit(label, LABEL_FONT, 700), d = fit(dims, DIMS_FONT, 400)
    lines = [l && { ...l, weight: 700, fill: '#333', y: -3 }, d && { ...d, weight: 400, fill: '#666', y: 7 }].filter(Boolean)
  }
  const baseAngle = along ? -90 : 0
  const angle = baseAngle + (needsFlip((cab.rotation || 0) + baseAngle) ? 180 : 0)
  // Two stacked lines sit 3px below center (label baseline on the centerline); a single
  // line running along the depth pivots on the true center so it stays within the item.
  const pivot = along ? [w / 2, h / 2] : [w / 2, h / 2 + 3]
  const rad = angle * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad)
  const toLocal = (tx, ty) => [pivot[0] + tx * cos - ty * sin, pivot[1] + tx * sin + ty * cos]
  const boxes = lines.map(ln => [
    [-ln.width / 2, ln.y - ln.size * 0.75], [ln.width / 2, ln.y - ln.size * 0.75],
    [ln.width / 2, ln.y + ln.size * 0.25], [-ln.width / 2, ln.y + ln.size * 0.25],
  ].map(([tx, ty]) => toLocal(tx, ty)))
  return {
    lines, boxes, omitted: lines.length === 0 || !lines.some(l => l.weight === 700),
    transform: `translate(${pivot[0]}, ${pivot[1]}) rotate(${angle})`,
  }
}

function frontStrip(cab, scale) {
  const isFrontPanel = cab.subtype === 'Side Panel' || cab.subtype === 'Top Panel'
  return isFrontPanel ? 0 : (cab.frontMaterialThickness || 18) * scale
}

const isElevated = cab => cab.category === 'wall' || (cab.elevation || 0) > 0

// Badge spots to try for one cabinet, in local coords, best first. The first is the
// usual spot: elevated items on the back edge, floor items just below their dimension
// text (clear of a toe kick under the front), a Top Panel back-right (it shares its
// footprint with the cabinet under it), and anything shallower than the badge just
// outside on the room side. Then the other corners/edges, then just outside the front
// (room side) and the two ends.
function candidateSpots(cab, scale) {
  const { w, h } = cabSize(cab, scale)
  const r = BADGE_R, front = h + frontStrip(cab, scale)
  const outFront = Math.max(front, h / 2 + 12) + r + 2
  const spots = []
  if (h < 2 * r) spots.push([w / 2, outFront])
  else if (cab.subtype === 'Top Panel') spots.push([Math.max(r, w - r), r])
  else if (isElevated(cab)) spots.push([w / 2, r])
  else spots.push(h / 2 + 28 <= h ? [w / 2, h / 2 + 21] : [w / 2, Math.max(r, h - r)])
  if (w >= 2 * r && h >= 2 * r) {
    spots.push([w / 2, r], [w / 2, h - r], [r, r], [w - r, r], [r, h - r], [w - r, h - r], [r, h / 2], [w - r, h / 2])
  }
  spots.push([w / 2, outFront], [w / 2 - 2 * r - 2, outFront], [w / 2 + 2 * r + 2, outFront],
             [-r - 2, h / 2], [w + r + 2, h / 2], [-r - 2, h - r], [w + r + 2, h - r])
  return spots
}

// Farther-out spots, reached with a leader line from the front edge's center.
function leaderSpots(cab, scale) {
  const { w, h } = cabSize(cab, scale)
  const front = Math.max(h + frontStrip(cab, scale), h / 2 + 12) + BADGE_R + 2
  const spots = []
  for (let k = 1; k <= 6; k++) {
    for (const dx of [0, -LEADER_STEP, LEADER_STEP, -2 * LEADER_STEP, 2 * LEADER_STEP]) {
      spots.push([w / 2 + dx, front + k * LEADER_STEP])
    }
    spots.push([-BADGE_R - 2 - k * LEADER_STEP, h / 2], [w + BADGE_R + 2 + k * LEADER_STEP, h / 2])
  }
  return spots
}

function pointInPoly([px, py], P) {
  let inside = false
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j]
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
function segDist([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}
export function circleHitsPoly(c, r, P) {
  return pointInPoly(c, P) || P.some((a, i) => segDist(c, a, P[(i + 1) % P.length]) < r)
}
const polyBounds = P => {
  const xs = P.map(p => p[0]), ys = P.map(p => p[1])
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

// Places every cabinet's badge in canvas coordinates. Narrowest items go first (they
// have the fewest usable spots); each takes the first candidate that clears all badges
// placed so far, every label/dimension box and every wall body, else the first clear
// leader spot, else its usual spot regardless. Returns Map(id -> { x, y, leader }),
// where `leader` is the [x, y] the line starts from, or null.
export function placeBadges(cabinets, scale, showDimensions, wallPolys = []) {
  const textPolys = []
  cabinets.forEach(cab => {
    cabTextLayout(cab, scale, showDimensions).boxes.forEach(box => {
      const P = box.map(([lx, ly]) => cabLocalToWorld(cab, scale, lx, ly))
      textPolys.push({ P, b: polyBounds(P) })
    })
  })
  const walls = wallPolys.map(P => ({ P, b: polyBounds(P) }))
  const placed = []
  const clear = ([x, y]) => {
    const r = BADGE_R + BADGE_GAP
    if (placed.some(p => Math.hypot(p.x - x, p.y - y) < 2 * BADGE_R + BADGE_GAP)) return false
    const near = o => x + r > o.b[0] && x - r < o.b[2] && y + r > o.b[1] && y - r < o.b[3]
    return !textPolys.some(o => near(o) && circleHitsPoly([x, y], r, o.P)) &&
           // Walls only need to keep the badge from being drawn inside them, so a badge
           // may sit flush against the wall face (a wall cabinet's back edge).
           !walls.some(o => near(o) && circleHitsPoly([x, y], BADGE_R - 2, o.P))
  }
  const order = cabinets.map((cab, i) => ({ cab, i }))
    .sort((a, b) => Math.min(a.cab.width, a.cab.depth) - Math.min(b.cab.width, b.cab.depth) || a.i - b.i)
  const result = new Map()
  for (const { cab } of order) {
    const toWorld = ([lx, ly]) => cabLocalToWorld(cab, scale, lx, ly)
    const spots = candidateSpots(cab, scale).map(toWorld)
    let pos = spots.find(clear), leader = null
    if (!pos) {
      pos = leaderSpots(cab, scale).map(toWorld).find(clear)
      if (pos) {
        const { w, h } = cabSize(cab, scale)
        leader = toWorld([w / 2, h])
      } else {
        pos = spots[0]
      }
    }
    placed.push({ x: pos[0], y: pos[1] })
    result.set(cab.id, { x: pos[0], y: pos[1], leader })
  }
  return result
}
