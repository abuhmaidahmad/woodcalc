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
export function cabTextLayout(cab, scale, showDimensions, pivotAt = null, fontScale = 1) {
  const { w, h } = cabSize(cab, scale)
  const label = cab.label || ''
  // Catalog names already end in the width ("Wall 450"), so skip the repeat.
  const nameNum = /\s(\d+)(mm)?$/.exec(label)
  const nameHasWidth = nameNum && Number(nameNum[1]) === Number(cab.width)
  const dims = showDimensions && !nameHasWidth ? `${cab.width}mm` : null
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
    lines = one ? [{ ...one, weight: 700, y: 3 }] : []
  } else {
    const l = fit(label, LABEL_FONT, 700), d = fit(dims, DIMS_FONT, 400)
    lines = [l && { ...l, weight: 700, y: -3 }, d && { ...d, weight: 400, y: 7 }].filter(Boolean)
  }
  // A smaller size asked for by layoutPlan (to clear a stacked item's label), never below MIN_FONT.
  if (fontScale < 1) {
    lines = lines.map(ln => {
      const k = Math.max(fontScale, MIN_FONT / ln.size)
      return { ...ln, size: ln.size * k, width: ln.width * k, y: ln.y * k }
    })
  }
  const baseAngle = along ? -90 : 0
  const angle = baseAngle + (needsFlip((cab.rotation || 0) + baseAngle) ? 180 : 0)
  // Two stacked lines sit 3px below center (label baseline on the centerline); a single
  // line running along the depth pivots on the true center so it stays within the item.
  const defaultPivot = along ? [w / 2, h / 2] : [w / 2, h / 2 + 3]
  const pivot = pivotAt || defaultPivot
  const rad = angle * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad)
  const toLocal = (tx, ty) => [pivot[0] + tx * cos - ty * sin, pivot[1] + tx * sin + ty * cos]
  // Full font box (ascent ~0.95em, descent ~0.25em), the extent the browser reports for
  // the text, so clearance checks hold against what's actually drawn.
  const boxes = lines.map(ln => [
    [-ln.width / 2, ln.y - ln.size * 0.95], [ln.width / 2, ln.y - ln.size * 0.95],
    [ln.width / 2, ln.y + ln.size * 0.25], [-ln.width / 2, ln.y + ln.size * 0.25],
  ].map(([tx, ty]) => toLocal(tx, ty)))
  return {
    lines, boxes, angle, pivot, defaultPivot, along, omitted: lines.length === 0 || !lines.some(l => l.weight === 700),
    transform: `translate(${pivot[0]}, ${pivot[1]}) rotate(${angle})`,
  }
}

// Text color for a label drawn over `fill` (a hex or rgb() color): light on dark fills
// such as the black oven tower, dark on light ones. Anything unparseable counts as light.
export function isDarkFill(fill) {
  let r, g, b
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(fill || '')
  if (hex) {
    const v = hex[1].length === 3 ? hex[1].split('').map(c => c + c).join('') : hex[1]
    ;[r, g, b] = [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16))
  } else {
    const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(fill || '')
    if (!rgb) return false
    ;[r, g, b] = rgb.slice(1, 4).map(Number)
  }
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) < 0.18
}
export function labelColors(onDark) {
  return onDark ? { label: '#f2f2f2', dims: '#c8c8c8' } : { label: '#333', dims: '#666' }
}

function frontStrip(cab, scale) {
  const isFrontPanel = cab.subtype === 'Side Panel' || cab.subtype === 'Top Panel'
  return isFrontPanel ? 0 : (cab.frontMaterialThickness || 18) * scale
}

const isElevated = cab => cab.category === 'wall' || (cab.elevation || 0) > 0

// Badge spots to try for one cabinet, in local coords, best first. The first is the
// usual spot: elevated items on the back edge, floor items just in front of their own
// label block wherever it ended up (flipped or not; clear of a toe kick under the
// front), a Top Panel back-right (it shares its footprint with the cabinet under it),
// and anything shallower than the badge just outside on the room side. Then the other
// corners/edges, then just outside the front (room side) and the two ends.
// `labelBottom` is the local y of the front-most edge of the item's label, or null.
function candidateSpots(cab, scale, labelBottom) {
  const { w, h } = cabSize(cab, scale)
  const r = BADGE_R, front = h + frontStrip(cab, scale)
  const outFront = Math.max(front, h / 2 + 12) + r + 2
  const spots = []
  if (h < 2 * r) spots.push([w / 2, outFront])
  else if (cab.subtype === 'Top Panel') spots.push([Math.max(r, w - r), r])
  else if (isElevated(cab)) spots.push([w / 2, r])
  else {
    const below = (labelBottom ?? h / 2 + 12) + r + 2
    spots.push(below + r <= h ? [w / 2, below] : [w / 2, Math.max(r, h - r)])
  }
  if (w >= 2 * r && h >= 2 * r) {
    spots.push([w / 2, r], [w / 2, h - r], [r, r], [w - r, r], [r, h - r], [w - r, h - r], [r, h / 2], [w - r, h / 2])
  }
  // The front-edge ends leave room for a shallow item's label moved out in front of it.
  spots.push([w / 2, outFront], [w / 2 - 2 * r - 2, outFront], [w / 2 + 2 * r + 2, outFront], [r, outFront], [w - r, outFront],
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

// Pivot spots to try for one cabinet's label block, in local coords, best first: its
// usual centered spot, then pushed to the back, front, left and right inside the item,
// then just outside its front (room side) and past either end. The block keeps its
// orientation; only its position changes, falling back to a 2px scan through and then
// past the item's depth, and then to the same spots at 85% and 70% size. A label running along a narrow item's depth
// (side panel, filler) only slides along the item: moved past either end it would stick
// out into the room or onto the neighbouring run, which reads worse than where it was.
// Returns [pivot, fontScale] pairs; an along-the-depth label also tries smaller sizes
// pushed to either end, so a shorter label can clear the one next to it.
function labelCandidates(cab, scale, showDimensions, layout) {
  const { w, h } = cabSize(cab, scale)
  const extents = fs => {
    const local = cabTextLayout(cab, scale, showDimensions, [0, 0], fs).boxes.flat()
    return [Math.min(...local.map(p => p[0])), Math.max(...local.map(p => p[0])),
            Math.min(...local.map(p => p[1])), Math.max(...local.map(p => p[1]))]
  }
  const [x0, x1, y0, y1] = extents(1)
  const cx = w / 2 - (x0 + x1) / 2
  const front = h + frontStrip(cab, scale)
  if (layout.along) {
    const spots = [[layout.defaultPivot, 1], [[cx, 2 - y0], 1], [[cx, h - 2 - y1], 1]]
    for (const fs of [0.85, 0.7, 0.55]) {
      const [a0, a1, b0, b1] = extents(fs), ax = w / 2 - (a0 + a1) / 2
      spots.push([[ax, 2 - b0], fs], [[ax, h - 2 - b1], fs])
    }
    return spots
  }
  const spots = [[layout.defaultPivot, 1]]
  // Every position at full size first, then all again at smaller sizes for a tight stack.
  for (const fs of [1, 0.85, 0.7]) {
    const [a0, a1, b0, b1] = extents(fs)
    const ax = w / 2 - (a0 + a1) / 2, ay = h / 2 - (b0 + b1) / 2
    const pos = [
      [ax, 2 - b0], [ax, h - 2 - b1], [2 - a0, ay], [w - 2 - a1, ay],
      [ax, front + 2 - b0], [-2 - a1, ay], [w + 2 - a0, ay],
    ]
    // Then a finer search: every 2px through the item's depth, then on out past its
    // front (room side), for stacks where the coarse spots are all taken.
    for (let y = 2 - b0; y <= h - 2 - b1; y += 2) pos.push([ax, y], [2 - a0, y])
    for (let y = front + 2 - b0; y <= front + 42 - b0; y += 2) pos.push([ax, y], [2 - a0, y])
    pos.forEach(p => spots.push([p, fs]))
  }
  return spots
}

function segsCross([ax, ay], [bx, by], [cx, cy], [dx, dy]) {
  const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax)
  const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx)
  return d1 * d2 < 0 && d3 * d4 < 0
}
// Whether a text box's centre line (through the middle of the glyphs, end to end) enters
// polygon P. Boxes are [start-top, end-top, end-bottom, start-bottom].
function textLineHitsPoly(box, P) {
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  const a = mid(box[0], box[3]), b = mid(box[1], box[2])
  return pointInPoly(a, P) || pointInPoly(b, P) || P.some((p, i) => segsCross(a, b, p, P[(i + 1) % P.length]))
}
function polysOverlap(A, B, gap) {
  // Separating-axis test for convex polygons, treating them as touching within `gap`.
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]
      const nx = y1 - y2, ny = x2 - x1, len = Math.hypot(nx, ny) || 1
      const pa = A.map(([x, y]) => (x * nx + y * ny) / len), pb = B.map(([x, y]) => (x * nx + y * ny) / len)
      if (Math.max(...pa) + gap <= Math.min(...pb) || Math.max(...pb) + gap <= Math.min(...pa)) return false
    }
  }
  return true
}

// Lays out every cabinet's label and position badge across the whole plan, in canvas
// coordinates. Labels go first: floor-standing items in list order, then elevated ones
// from lowest to highest, so where items are stacked (a wall cabinet over a base, a top
// panel over a wall cabinet) the upper item's label is the one that moves. Each label
// takes the first of its spots that clears the labels placed so far and doesn't sit in
// a wall, else stays put. Badges follow (narrowest items first), each taking the first
// spot clear of every badge so far, every label and every wall, else a leader-line spot
// farther out, else its usual spot. Returns { labels: Map(id -> { pivot, fontScale, onItem }),
// badges: Map(id -> { x, y, leader }) }. `bounds` ([x0, y0, x1, y1], canvas coords) is the
// plan area; nothing is moved outside it, where the canvas would clip it.
export function layoutPlan(cabinets, scale, showDimensions, wallPolys = [], bounds = null) {
  const walls = wallPolys.map(P => ({ P, b: polyBounds(P) }))
  const inBounds = P => !bounds || P.every(([x, y]) => x >= bounds[0] && x <= bounds[2] && y >= bounds[1] && y <= bounds[3])
  const textPolys = []
  const labels = new Map(), labelBottoms = new Map()
  const labelOrder = cabinets.map((cab, i) => ({ cab, i }))
    .sort((a, b) => (isElevated(a.cab) - isElevated(b.cab)) ||
      (isElevated(a.cab) ? (a.cab.elevation || 0) - (b.cab.elevation || 0) : 0) || a.i - b.i)
  for (const { cab } of labelOrder) {
    const toWorld = ([lx, ly]) => cabLocalToWorld(cab, scale, lx, ly)
    const base = cabTextLayout(cab, scale, showDimensions)
    if (!base.lines.length) { labels.set(cab.id, { pivot: base.pivot, fontScale: 1, onItem: true }); continue }
    const tryAt = (pivot, fs) => {
      const polys = cabTextLayout(cab, scale, showDimensions, pivot, fs).boxes.map(b => b.map(toWorld))
      const ok = polys.every(P => {
        const b = polyBounds(P)
        const near = o => b[0] < o.b[2] + 1 && b[2] > o.b[0] - 1 && b[1] < o.b[3] + 1 && b[3] > o.b[1] - 1
        // A label may graze a wall face (a side panel standing against a wall) as long as
        // its centre line stays out of the wall; it must stay inside the plan.
        return inBounds(P) && !textPolys.some(o => near(o) && polysOverlap(P, o.P, 1)) &&
               !walls.some(o => near(o) && textLineHitsPoly(P, o.P))
      })
      return ok ? polys : null
    }
    const spots = labelCandidates(cab, scale, showDimensions, base)
    let [pivot, fontScale] = spots[0], polys = null
    for (const [p, fs] of spots) { polys = tryAt(p, fs); if (polys) { pivot = p; fontScale = fs; break } }
    if (!polys) polys = cabTextLayout(cab, scale, showDimensions, pivot, fontScale).boxes.map(b => b.map(toWorld))
    polys.forEach(P => textPolys.push({ P, b: polyBounds(P) }))
    // Whether the block still lies within the item's own outline, i.e. drawn over its fill.
    const { w, h } = cabSize(cab, scale)
    const onItem = cabTextLayout(cab, scale, showDimensions, pivot, fontScale).boxes.flat()
      .every(([x, y]) => x >= -0.5 && x <= w + 0.5 && y >= -0.5 && y <= h + 0.5)
    labels.set(cab.id, { pivot, fontScale, onItem })
    labelBottoms.set(cab.id, onItem ? Math.max(...cabTextLayout(cab, scale, showDimensions, pivot, fontScale).boxes.flat().map(p => p[1])) : null)
  }

  const placed = []
  const clear = ([x, y]) => {
    const r = BADGE_R + BADGE_GAP
    if (bounds && (x - BADGE_R < bounds[0] || x + BADGE_R > bounds[2] || y - BADGE_R < bounds[1] || y + BADGE_R > bounds[3])) return false
    if (placed.some(p => Math.hypot(p.x - x, p.y - y) < 2 * BADGE_R + BADGE_GAP)) return false
    const near = o => x + r > o.b[0] && x - r < o.b[2] && y + r > o.b[1] && y - r < o.b[3]
    return !textPolys.some(o => near(o) && circleHitsPoly([x, y], r, o.P)) &&
           // Walls only need to keep the badge from being drawn inside them, so a badge
           // may sit flush against the wall face (a wall cabinet's back edge).
           !walls.some(o => near(o) && circleHitsPoly([x, y], BADGE_R - 2, o.P))
  }
  const order = cabinets.map((cab, i) => ({ cab, i }))
    .sort((a, b) => Math.min(a.cab.width, a.cab.depth) - Math.min(b.cab.width, b.cab.depth) || a.i - b.i)
  const badges = new Map()
  for (const { cab } of order) {
    const toWorld = ([lx, ly]) => cabLocalToWorld(cab, scale, lx, ly)
    const spots = candidateSpots(cab, scale, labelBottoms.get(cab.id) ?? null).map(toWorld)
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
    badges.set(cab.id, { x: pos[0], y: pos[1], leader })
  }
  return { labels, badges }
}

export function placeBadges(cabinets, scale, showDimensions, wallPolys = [], bounds = null) {
  return layoutPlan(cabinets, scale, showDimensions, wallPolys, bounds).badges
}
