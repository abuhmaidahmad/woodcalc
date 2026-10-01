import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { BLIND_PANEL_WIDTH } from './formulaEngine'
import { useTranslation } from '../../i18n/LanguageContext'
import {
  computeWallBodies, getWallThickness, getWallLength, makeWallId,
  chooseDefaultThicknessSide, getWallMidlinePoint,
} from './wallGeometry'
import {
  computeStairDerived, computeStairSteps, computeWalklinePath, goingFromRunLength, makeStairId,
  getStairSupportSegments, DEFAULT_STAIR_WIDTH, DEFAULT_GOING, DEFAULT_MAX_RISER, DEFAULT_NOSING, DEFAULT_TOTAL_RISE,
  DEFAULT_WINDERS_PER_TURN, DEFAULT_PIVOT_OFFSET, DEFAULT_WALKLINE_OFFSET, DEFAULT_SUPPORT_SIDE,
} from './stairGeometry'

const ACCENT = '#C8902A'
const BULK_ACCENT = '#2AC87A'
const EMPTY_BULK_IDS = new Set()
const GRID = 50
// Screen/view-space mouse-snap radius for the draw/drag UI -- a UX concern
// about cursor proximity, unrelated to wallGeometry's mm-based join
// tolerance used for loop-tracing and offset mitering.
export const ENDPOINT_SNAP_DIST = 60
// Element types that can snap onto a wall's centerline while dragging. Windows/doors
// become wall cutouts (EmbeddedElement); the point types just get wall-relative
// positioning while still rendering as icons — see the element drag handler and
// the "in wall N" toolbar badge below.
const WALL_SNAPPABLE_TYPES = new Set(['window', 'door', 'electric', 'water', 'drain', 'gas'])

const snap = v => Math.round(v / GRID) * GRID
const degToRad = d => d * Math.PI / 180
const radToDeg = r => r * 180 / Math.PI
const ptDist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by)

// Standard ray-casting point-in-polygon test, used to figure out which cabinets
// a click actually falls inside of (see pickCabinetsAt / startElementDrag) —
// cabinets that occupy the same plan footprint at different elevations (e.g. a
// wall unit directly above a base unit) all report a hit here, since this only
// looks at the 2D top-down outline.
function pointInPolygon(px, py, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside
  }
  return inside
}

// ---- Cabinet/wall SAT collision -- shared by the live collidingIds check
// (collision highlighting) and the wall-edit cabinet guard below, so both
// always agree on what counts as overlapping. ----
function getCabCorners(cab) {
  const x = cab.x, y = cab.y, w = cab.width, h = cab.depth
  const cx = x + w / 2, cy = y + h / 2
  const rad = ((cab.rotation || 0) * Math.PI) / 180
  const cos = Math.cos(rad), sin = Math.sin(rad)
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) => [
    cx + (px - cx) * cos - (py - cy) * sin,
    cy + (px - cx) * sin + (py - cy) * cos,
  ])
}
function getCabElevRange(cab) {
  if (cab.category === 'wall' || (cab.elevation || 0) > 0) {
    const bottom = cab.elevation ?? 1450
    return [bottom, bottom + (cab.height || 0)]
  }
  return [0, cab.height || 0]
}
const rangesOverlap = (a, b) => a[0] < b[1] && b[0] < a[1]
// One axis per edge (not just the first two) -- a rectangle only needs two
// since its far edges are parallel to the near ones, but a stair step can
// be a triangle, kite, or pentagon (winder treads), whose edges aren't all
// parallel to just two directions.
function polyAxes(poly) {
  const axes = []
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]
    axes.push([-(y2 - y1), x2 - x1])
  }
  return axes
}
function project(poly, axis) {
  let min = Infinity, max = -Infinity
  poly.forEach(([x, y]) => {
    const d = x * axis[0] + y * axis[1]
    if (d < min) min = d
    if (d > max) max = d
  })
  return [min, max]
}
function polysIntersect(polyA, polyB) {
  // Small tolerance (mm) so cabinets snapped flush edge-to-edge don't register as overlapping
  const EPS = 2
  const axes = [...polyAxes(polyA), ...polyAxes(polyB)]
  return axes.every(axis => {
    const axisLen = Math.hypot(axis[0], axis[1]) || 1
    const eps = EPS * axisLen
    const [aMin, aMax] = project(polyA, axis)
    const [bMin, bMax] = project(polyB, axis)
    return aMin < bMax - eps && bMin < aMax - eps
  })
}
// Same SAT projection as polysIntersect but the mirror-image tolerance --
// widens each shape's bounds instead of shrinking them, so it also catches
// two polygons that are merely close (flush or a small gap), not just truly
// overlapping ones. Used to tell whether a cabinet is sitting flush against
// a wall (a legitimate, intentional design state) as distinct from actually
// colliding with it.
function polysNear(polyA, polyB, gapMm) {
  const axes = [...polyAxes(polyA), ...polyAxes(polyB)]
  return axes.every(axis => {
    const axisLen = Math.hypot(axis[0], axis[1]) || 1
    const g = gapMm * axisLen
    const [aMin, aMax] = project(polyA, axis)
    const [bMin, bMax] = project(polyB, axis)
    return aMin < bMax + g && bMin < aMax + g
  })
}
// A wall's true rendered footprint -- the mitered body polygon from
// computeWallBodies, converted to mm -- so cabinets overlapping a wall get
// flagged the same way cabinets overlapping each other do.
function getWallCorners(body, scale) {
  if (!body) return null
  const toMm = (p) => [p.x / scale, p.y / scale]
  return [toMm(body.faceStart), toMm(body.faceEnd), toMm(body.outerEnd), toMm(body.outerStart)]
}

// A cabinet is considered "touching" a wall if it's within this many mm of
// it -- generous enough to cover ordinary flush-snapped placement (which
// lands at 0mm) plus a little float/rounding slack, tight enough that a
// cabinet merely nearby with a real gap doesn't count.
const WALL_TOUCH_GAP_MM = 5

// Before committing a wall edit (length/angle change, drag, thickness/side
// change, or a brand-new wall), compares the room's cabinet-collision state
// under the wall's OLD geometry against its PROPOSED new geometry, using the
// exact same SAT test collidingIds already uses. Returns every (wall,
// cabinet) pair where the edit would either create a new overlap that
// didn't exist before, or pull the wall away from a cabinet it used to sit
// flush against -- both signs the edit did something the user didn't
// intend, per the room's actual cabinet layout rather than just its wall
// topology.
function checkWallEditAgainstCabinets(oldWalls, newWalls, cabinets, scale) {
  const oldBodies = computeWallBodies(oldWalls, scale)
  const newBodies = computeWallBodies(newWalls, scale)
  const cabCorners = cabinets.map(getCabCorners)
  const violations = []
  const n = Math.max(oldWalls.length, newWalls.length)
  for (let wi = 0; wi < n; wi++) {
    const oldCorners = getWallCorners(oldBodies[wi], scale)
    const newCorners = getWallCorners(newBodies[wi], scale)
    if (!oldCorners && !newCorners) continue
    const wallId = (newWalls[wi] || oldWalls[wi])?.id
    cabinets.forEach((cab, ci) => {
      const overlapOld = oldCorners ? polysIntersect(cabCorners[ci], oldCorners) : false
      const overlapNew = newCorners ? polysIntersect(cabCorners[ci], newCorners) : false
      const touchOld = oldCorners ? polysNear(cabCorners[ci], oldCorners, WALL_TOUCH_GAP_MM) : false
      const touchNew = newCorners ? polysNear(cabCorners[ci], newCorners, WALL_TOUCH_GAP_MM) : false
      if (!overlapOld && overlapNew) {
        violations.push({ type: 'newOverlap', wallIndex: wi, wallId, cabinetId: cab.id, cabinetLabel: cab.label })
      } else if (touchOld && !overlapOld && !touchNew) {
        violations.push({ type: 'pulledAway', wallIndex: wi, wallId, cabinetId: cab.id, cabinetLabel: cab.label })
      }
    })
  }
  return violations
}

function findNearestEndpoint(px, py, walls, skipIndex, threshold) {
  let best = null, bestDist = threshold
  walls.forEach((w, i) => {
    if (i === skipIndex) return
    ;[{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }].forEach(pt => {
      const d = ptDist(px, py, pt.x, pt.y)
      if (d < bestDist) { bestDist = d; best = { x: pt.x, y: pt.y } }
    })
  })
  return best
}

function findWallSnap(px, py, walls, wallThickness, scale, threshold) {
  let best = null, bestDist = threshold
  walls.forEach((w, wi) => {
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) return
    const t = Math.max(0, Math.min(1, ((px - w.x1) * dx + (py - w.y1) * dy) / lenSq))
    const cx = w.x1 + t * dx, cy = w.y1 + t * dy
    const d = ptDist(px, py, cx, cy)
    if (d < bestDist) {
      bestDist = d
      best = { wallIndex: wi, t, centerX: cx, centerY: cy, wallAngle: radToDeg(Math.atan2(dy, dx)), dx: dx / Math.sqrt(lenSq), dy: dy / Math.sqrt(lenSq) }
    }
  })
  return best
}

function findNearestWallAngle(px, py, walls, threshold) {
  let best = null, bestDist = threshold
  walls.forEach(w => {
    const d = distToSegment(px, py, w.x1, w.y1, w.x2, w.y2)
    if (d < bestDist) { bestDist = d; best = radToDeg(Math.atan2(w.y2 - w.y1, w.x2 - w.x1)) }
  })
  return best
}

// Snaps a raw direction angle onto the nearest of a candidate set (0/90/180/270
// plus, when a wall is nearby, the four directions parallel/perpendicular to
// it) as long as it's within thresholdDeg -- otherwise returns null so the
// caller falls back to the unsnapped angle.
function snapAngleToCandidates(angleDeg, candidates, thresholdDeg) {
  let best = null, bestDiff = thresholdDeg
  const norm = ((angleDeg % 360) + 360) % 360
  candidates.forEach(c => {
    const cn = ((c % 360) + 360) % 360
    let diff = Math.abs(norm - cn)
    if (diff > 180) diff = 360 - diff
    if (diff < bestDiff) { bestDiff = diff; best = cn }
  })
  return best
}

// A stair dropped with no other cues should sit on the side of its walking
// path that faces into the room, not out through the nearest wall -- using
// the room's own center as a stand-in for "the interior" is far simpler than
// tracing wall polygons and is right in every normal rectangular-room case.
function chooseDefaultStairSide(xMm, yMm, angleDeg, room) {
  const cx = (room?.width || 0) / 2, cy = (room?.depth || 0) / 2
  const rad = degToRad(angleDeg)
  const dirX = Math.cos(rad), dirY = Math.sin(rad)
  const perpX = -dirY, perpY = dirX
  const dot = (cx - xMm) * perpX + (cy - yMm) * perpY
  return dot < 0
}

// Returns the world-space px endpoints of one edge ('top'|'bottom'|'left'|'right')
// of a cabinet's rectangular footprint, accounting for its rotation. Cabinet
// coords are in mm; output is in scaled px to match the x1/y1/x2/y2 convention
// used by walls and backsplash segments.
function getCabinetEdgePx(cab, side, scale) {
  const cx = cab.x + cab.width / 2, cy = cab.y + cab.depth / 2
  const rad = ((cab.rotation || 0) * Math.PI) / 180
  const cos = Math.cos(rad), sin = Math.sin(rad)
  const rot = (px, py) => {
    const dx = px - cx, dy = py - cy
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
  }
  let p1mm, p2mm
  if (side === 'top') { p1mm = { x: cab.x, y: cab.y }; p2mm = { x: cab.x + cab.width, y: cab.y } }
  else if (side === 'bottom') { p1mm = { x: cab.x, y: cab.y + cab.depth }; p2mm = { x: cab.x + cab.width, y: cab.y + cab.depth } }
  else if (side === 'left') { p1mm = { x: cab.x, y: cab.y }; p2mm = { x: cab.x, y: cab.y + cab.depth } }
  else { p1mm = { x: cab.x + cab.width, y: cab.y }; p2mm = { x: cab.x + cab.width, y: cab.y + cab.depth } }
  const p1 = rot(p1mm.x, p1mm.y), p2 = rot(p2mm.x, p2mm.y)
  return { x1: p1.x * scale, y1: p1.y * scale, x2: p2.x * scale, y2: p2.y * scale }
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return ptDist(px, py, x1, y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
  const cx = x1 + t * dx, cy = y1 + t * dy
  return ptDist(px, py, cx, cy)
}

function findNearestCabinetEdge(px, py, cabinets, scale, threshold) {
  let best = null, bestDist = threshold
  cabinets.forEach(cab => {
    // Corner/blind and vanity units, plus a freestanding dishwasher, carry a
    // countertop just like a regular base cabinet does (see isBase in
    // KitchenPlanner3D's Cabinet component) — they should be eligible for
    // backsplash too, not just category === 'base'.
    if (!['base', 'vanity', 'corner'].includes(cab.category) && cab.subtype !== 'Freestanding Dishwasher') return
    ;['top', 'bottom', 'left', 'right'].forEach(side => {
      const edge = getCabinetEdgePx(cab, side, scale)
      const d = distToSegment(px, py, edge.x1, edge.y1, edge.x2, edge.y2)
      if (d < bestDist) { bestDist = d; best = { cab, side, edge } }
    })
  })
  return best
}

// Corners of a cabinet's (possibly rotated) rectangular footprint, in scaled px —
// the measure tool's snap targets, computed the same way getCabinetEdgePx derives
// its edge endpoints.
function findNearestCabinetCorner(px, py, cabinets, scale, threshold) {
  let best = null, bestDist = threshold
  cabinets.forEach(cab => {
    const ccx = cab.x + cab.width / 2, ccy = cab.y + cab.depth / 2
    const rad = ((cab.rotation || 0) * Math.PI) / 180
    const cos = Math.cos(rad), sin = Math.sin(rad)
    const rot = (x, y) => {
      const dx = x - ccx, dy = y - ccy
      return { x: (ccx + dx * cos - dy * sin) * scale, y: (ccy + dx * sin + dy * cos) * scale }
    }
    ;[
      rot(cab.x, cab.y), rot(cab.x + cab.width, cab.y),
      rot(cab.x, cab.y + cab.depth), rot(cab.x + cab.width, cab.y + cab.depth),
    ].forEach(pt => {
      const d = ptDist(px, py, pt.x, pt.y)
      if (d < bestDist) { bestDist = d; best = pt }
    })
  })
  return best
}

// Snap point for the measure tool's click points: cabinet corners first (the
// most common thing you'd want to measure between), then wall endpoints, then
// the nearest point on a wall's centerline — falling back to the raw click.
function findMeasureSnapPoint(px, py, walls, cabinets, wallThickness, scale, threshold) {
  const corner = findNearestCabinetCorner(px, py, cabinets, scale, threshold)
  if (corner) return corner
  const endpoint = findNearestEndpoint(px, py, walls, -1, threshold)
  if (endpoint) return endpoint
  const wallSnap = findWallSnap(px, py, walls, wallThickness, scale, threshold)
  if (wallSnap) return { x: wallSnap.centerX, y: wallSnap.centerY }
  return null
}

function WallBody({ body, index, selected, onSelect, onDragStart, onEndpointDragStart }) {
  const { faceStart: p1, faceEnd: p2, outerStart: o1, outerEnd: o2, thickness } = body
  const bodyPoints = `${p1.x},${p1.y} ${p2.x},${p2.y} ${o2.x},${o2.y} ${o1.x},${o1.y}`
  return (
    <g>
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent"
        strokeWidth={Math.max(thickness + 12, 20)} strokeLinecap="square"
        onMouseDown={e => { e.stopPropagation(); onSelect(); onDragStart(e, index) }}
        style={{ cursor: 'move' }} />
      <polygon points={bodyPoints}
        fill={selected ? ACCENT : '#2c3e50'} stroke={selected ? ACCENT : '#2c3e50'} strokeWidth={1}
        style={{ pointerEvents: 'none' }} />
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
        stroke={selected ? '#fff' : '#88888855'} strokeWidth={1}
        strokeDasharray="4,3" style={{ pointerEvents: 'none' }} />
      {selected && [{ x: p1.x, y: p1.y, ep: 0 }, { x: p2.x, y: p2.y, ep: 1 }].map(({ x, y, ep }) => (
        <g key={ep} onMouseDown={e => { e.stopPropagation(); onEndpointDragStart(e, index, ep) }} style={{ cursor: 'crosshair' }}>
          <circle cx={x} cy={y} r={10} fill="transparent" />
          <circle cx={x} cy={y} r={5} fill="#fff" stroke={ACCENT} strokeWidth={2.5} />
        </g>
      ))}
    </g>
  )
}

// Rendered in its own pass, after windows/doors/cabinets, so an opening or
// cabinet centered on the wall can never paint over the length label (it
// used to be drawn inline with the wall body, which sits earlier in SVG
// paint order than those elements and so could get covered by them).
function WallLabel({ body, selected, lengthMm, onLabelClick, editingLength, onLengthChange, onLengthConfirm, editingAngleVal, onAngleChange }) {
  const { t } = useTranslation()
  const { faceStart: p1, faceEnd: p2, outerStart: o1, outerEnd: o2 } = body
  const angle = radToDeg(Math.atan2(p2.y - p1.y, p2.x - p1.x))
  const cx = (p1.x + p2.x) / 2, cy = (p1.y + p2.y) / 2
  const ocx = (o1.x + o2.x) / 2, ocy = (o1.y + o2.y) / 2
  const labelX = cx + (ocx - cx) * 0.5
  const labelY = cy + (ocy - cy) * 0.5
  return (
    <g transform={`translate(${labelX},${labelY}) rotate(${angle})`}
      onClick={e => { e.stopPropagation(); onLabelClick() }}
      style={{ cursor: 'text' }}>
      <rect x={editingLength ? -46 : -30} y={-11} width={editingLength ? 92 : 60} height={18} rx={4}
        fill={selected ? ACCENT : 'white'} stroke={selected ? ACCENT : '#ddd'} strokeWidth={1} />
      {editingLength ? (
        <foreignObject x={-44} y={-10} width={88} height={16}>
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            <input autoFocus type="number" defaultValue={lengthMm}
              onChange={e => onLengthChange(+e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onLengthConfirm(); e.stopPropagation() }}
              title={t('roomCanvas.lengthAngleTitle')}
              style={{ width: '50%', border: 'none', outline: 'none', borderRight: `1px solid ${selected ? 'rgba(255,255,255,0.4)' : '#ddd'}`, fontSize: 9, textAlign: 'center', background: 'transparent', color: selected ? '#fff' : '#333', fontFamily: 'Inter,sans-serif', fontWeight: 600 }} />
            <input type="number" defaultValue={editingAngleVal}
              onChange={e => onAngleChange(+e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onLengthConfirm(); e.stopPropagation() }}
              title={t('roomCanvas.angleTitle')}
              style={{ width: '50%', border: 'none', outline: 'none', fontSize: 9, textAlign: 'center', background: 'transparent', color: selected ? '#fff' : '#333', fontFamily: 'Inter,sans-serif', fontWeight: 600 }} />
          </div>
        </foreignObject>
      ) : (
        <text x={0} y={3} textAnchor="middle" fontSize={9}
          fill={selected ? '#fff' : '#555'} fontFamily="Inter,sans-serif" fontWeight={600}>
          {lengthMm}mm
        </text>
      )}
    </g>
  )
}

function EmbeddedElement({ el, scale, selected, onMouseDown }) {
  const x = el.x * scale, y = el.y * scale
  const w = el.w * scale
  const h = (el.wallThickness || 120) * scale
  const angle = el.wallAngle || 0
  const isWindow = el.type === 'window'
  const isDoor = el.type === 'door'
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`}
      onMouseDown={onMouseDown} style={{ cursor: 'move' }}>
      <rect x={-w/2} y={-h/2} width={w} height={h} fill="white" stroke="none" />
      <rect x={-w/2} y={-h/2} width={w} height={h}
        fill="none" stroke={selected ? ACCENT : el.color} strokeWidth={selected ? 2 : 1.5} />
      {isWindow && <>
        <line x1={-w/2} y1={0} x2={w/2} y2={0} stroke={selected ? ACCENT : el.color} strokeWidth={1} />
        <line x1={0} y1={-h/2} x2={0} y2={h/2} stroke={selected ? ACCENT : el.color} strokeWidth={0.5} strokeDasharray="2,2" />
      </>}
      {isDoor && <>
        <line x1={-w/2} y1={-h/2} x2={-w/2} y2={h/2} stroke={selected ? ACCENT : el.color} strokeWidth={2} />
        <path d={`M ${-w/2} ${h/2} Q ${w/2} ${h/2} ${w/2} ${-h/2}`}
          stroke={selected ? ACCENT : el.color} strokeWidth={1} fill={el.color + '22'} strokeDasharray="3,2" />
      </>}
      <text x={0} y={h/2 + 10} textAnchor="middle" fontSize={7}
        fill={selected ? ACCENT : '#555'} fontFamily="Inter,sans-serif"
        style={{ pointerEvents: 'none', userSelect: 'none' }}>{el.w}mm</text>
    </g>
  )
}

const APPLIANCE_2D_COLORS = {
  'Freestanding Oven': '#2b2b2b',
  'Freestanding Fridge': '#d7dadd',
  'Freestanding Dishwasher': '#d7dadd',
  'Freestanding Hood': '#c9cccf',
  'Fridge': '#d7dadd',
  'Oven Tower': '#2b2b2b',
  'Double Oven': '#2b2b2b',
  'Hob + Oven': '#2b2b2b',
}

// Memoized: with 50+ cabinets on the plan, this whole SVG list used to get
// rebuilt from scratch on every drag-position commit and every property-panel
// edit, since it all lived inline in RoomCanvas's own render — moving or
// editing one cabinet meant re-diffing all 50 <g> subtrees every time. `cab`
// keeps a stable object reference for every cabinet except the one actually
// being changed, so memoizing here turns that into a per-cabinet no-op for
// everything untouched. `onMouseDown` must be a referentially stable callback
// (see handleCabinetMouseDown in RoomCanvas) or this memoization is defeated.
// Position and rotation both live on this outer <g>'s `transform` -- every
// child below is drawn in LOCAL coordinates (0,0 at the cabinet's own
// top-left) that never change for a given width/height. That means a plain
// drag, which only changes cab.x/cab.y, now touches exactly one attribute on
// one element instead of x/y on several rects and two text nodes. SVG/browser
// engines generally treat a group's `transform` as compositable (like a CSS
// transform: no layout recalculation of the shapes inside it), whereas
// changing x/y attributes on individual shapes is a layout-affecting change
// -- so with 50 cabinets on screen, this is a materially cheaper repaint per
// drag frame than the previous absolute-coordinate version, on top of being
// cheaper for React to diff. (translate() then rotate() in the transform list
// rotates around the LOCAL center (w/2,h/2) first, which lands on the same
// absolute center point as the old rotate(rot, cx, cy) did -- purely a
// coordinate-system change, not a behavior change.)
const CabinetShape2D = React.memo(function CabinetShape2D({ cab, isSelected, isBulkSelected, isColliding, scale, showDimensions, onMouseDown }) {
  const x = cab.x * scale, y = cab.y * scale, w = cab.width * scale, h = cab.depth * scale
  const rot = cab.rotation || 0
  const outlineColor = isBulkSelected ? BULK_ACCENT : (isSelected ? ACCENT : '#888')
  // cab.applianceFinish ('black'|'silver', set in the properties panel) overrides the
  // subtype's default plan color -- keeps the top-view fill in sync with the body color
  // chosen for the 3D render (see applianceFinish() in KitchenPlanner3D.jsx).
  const isApplianceSubtype = cab.subtype in APPLIANCE_2D_COLORS || (cab.category === 'wall' && cab.subtype === 'Appliance')
  const applianceFill = isApplianceSubtype
    ? (cab.applianceFinish === 'black' ? '#2b2b2b' : cab.applianceFinish === 'silver' ? '#d7dadd' : (APPLIANCE_2D_COLORS[cab.subtype] || '#c9cccf'))
    : null
  const fill = applianceFill || (cab.subtype === 'Side Panel' ? cab.frontColor : cab.carcassColor)
  return (
    <g transform={`translate(${x},${y}) rotate(${rot}, ${w / 2}, ${h / 2})`}
      onMouseDown={e => onMouseDown(e, cab.id)}
      style={{ cursor: 'move', opacity: (cab.category === 'wall' || cab.subtype === 'Freestanding Hood') ? 0.6 : 1 }}>
      {(w < 8 || h < 8) && (
        // Zero/near-zero width or depth (e.g. a mistyped 0mm dimension) would
        // otherwise render no visible area, making the cabinet unclickable and
        // permanently stuck. This invisible rect guarantees a minimum hit area.
        <rect x={-Math.max(0, 8 - w) / 2} y={-Math.max(0, 8 - h) / 2}
          width={Math.max(w, 8)} height={Math.max(h, 8)}
          fill="transparent" style={{ pointerEvents: 'all' }} />
      )}
      <rect x={0} y={0} width={w} height={h} fill={fill} stroke={outlineColor} strokeWidth={isSelected || isBulkSelected ? 2.5 : 1.5} strokeDasharray={(cab.category === 'wall' || cab.subtype === 'Freestanding Hood') ? '5,3' : undefined} rx={2} />
      {cab.subtype === 'Freestanding Hood' && (() => {
        // Plan-view extractor symbol (inset duct outline + fan cross) so a hood
        // reads as a hood from above, not a generic labeled box -- dashed edge
        // above already signals it's suspended, not floor-standing.
        const cx = w / 2, cy = h / 2
        const r = Math.min(w, h) * 0.26
        return (
          <g style={{ pointerEvents: 'none' }}>
            <rect x={w * 0.12} y={h * 0.12} width={w * 0.76} height={h * 0.76} fill="none" stroke={outlineColor} strokeWidth={1} strokeDasharray="3,2" rx={2} />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={outlineColor} strokeWidth={1.25} />
            {[0, 45, 90, 135].map(a => {
              const rad = a * Math.PI / 180
              return <line key={a} x1={cx - r * Math.cos(rad)} y1={cy - r * Math.sin(rad)} x2={cx + r * Math.cos(rad)} y2={cy + r * Math.sin(rad)} stroke={outlineColor} strokeWidth={1} />
            })}
          </g>
        )
      })()}
      {cab.subtype === 'Blind' && (() => {
        const blindWpx = BLIND_PANEL_WIDTH * scale
        const side = cab.blindSide || 'left'
        const blindX = side === 'left' ? 0 : w - blindWpx
        const lineX = side === 'left' ? blindWpx : w - blindWpx
        return (
          <>
            <rect x={blindX} y={0} width={blindWpx} height={h} fill="rgba(0,0,0,0.08)" style={{ pointerEvents: 'none' }} />
            <line x1={lineX} y1={0} x2={lineX} y2={h} stroke="#2c3e50" strokeWidth={1.25} style={{ pointerEvents: 'none' }} />
          </>
        )
      })()}
      {isColliding && (
        <rect x={0} y={0} width={w} height={h} fill="url(#collisionHatch)" stroke="#DC3232" strokeWidth={2} rx={2} style={{ pointerEvents: 'none' }} />
      )}
      {cab.subtype !== 'Side Panel' && <rect x={0} y={h} width={w} height={(cab.frontMaterialThickness || 18) * scale} fill={cab.frontColor} stroke={outlineColor} strokeWidth={0.75} />}
      <text x={w / 2} y={h / 2} textAnchor="middle" fontSize={8} fontWeight={700} fill="#333" style={{ userSelect: 'none', pointerEvents: 'none' }}>{cab.label}</text>
      {showDimensions && <text x={w / 2} y={h / 2 + 10} textAnchor="middle" fontSize={7} fill="#666" style={{ pointerEvents: 'none' }}>{cab.width}mm</text>}
    </g>
  )
})

// Standard drafting-convention stair plan symbol: a line at every tread edge,
// stringer outlines down both sides, an UP arrow from the bottom step, and a
// diagonal break line at the step whose top height first reaches 1200mm --
// everything above that break is drawn dashed (it's above the plan's cut
// plane). All of it reads from computeStairSteps, so 3D/collision/top_profile
// consumers built on the same function stay pixel-for-pixel consistent with
// what's drawn here.
const STAIR_BREAK_HEIGHT_MM = 1200
const StairShape2D = React.memo(function StairShape2D({ stair, scale, selected, onMouseDown }) {
  const { t } = useTranslation()
  const data = useMemo(() => computeStairSteps(stair), [stair])
  const isWinder = stair.shape === 'L-winder' || stair.shape === 'U-winder'
  const isFloating = data.constructionStyle === 'floating'
  const walklinePts = useMemo(() => (isWinder ? computeWalklinePath(stair).map(([px, py]) => [px * scale, py * scale]) : null), [stair, isWinder, scale])
  const supportSegments = useMemo(() => (isFloating ? getStairSupportSegments(stair) : []), [stair, isFloating])
  const color = selected ? ACCENT : '#333'
  const breakIdx = data.steps.findIndex(s => s.topHeight >= STAIR_BREAK_HEIGHT_MM)

  if (isWinder) {
    const pts = walklinePts
    const last = pts[pts.length - 1], prev = pts[pts.length - 2]
    const arrowDir = Math.atan2(last[1] - prev[1], last[0] - prev[0])
    return (
      <g onMouseDown={onMouseDown} style={{ cursor: 'move' }}>
        {data.steps.map((step, i) => {
          const isAboveBreak = breakIdx >= 0 && i >= breakIdx
          const poly = step.footprint.map(([px, py]) => `${px * scale},${py * scale}`).join(' ')
          return (
            <polygon key={i} points={poly}
              fill={selected ? ACCENT + '14' : '#fafafa'} stroke={color} strokeWidth={1}
              strokeDasharray={isAboveBreak ? '4,3' : undefined} />
          )
        })}
        {stair.showWalkline && (
          <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={1} strokeDasharray="4,3" />
        )}
        <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={1.5} />
        <path d={`M ${last[0]} ${last[1]} L ${last[0] - 10 * Math.cos(arrowDir - 0.4)} ${last[1] - 10 * Math.sin(arrowDir - 0.4)} L ${last[0] - 10 * Math.cos(arrowDir + 0.4)} ${last[1] - 10 * Math.sin(arrowDir + 0.4)} Z`}
          fill={color} stroke={color} />
        <text x={pts[0][0]} y={pts[0][1] - 8} textAnchor="middle" fontSize={10} fontWeight={700} fill={color}
          style={{ pointerEvents: 'none', userSelect: 'none' }}>{t('roomCanvas.stairUpLabel')}</text>
        <circle cx={stair.x * scale} cy={stair.y * scale} r={4} fill="#2AC87A" stroke="#fff" strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
        {supportSegments.map((seg, i) => (
          <line key={`sup${i}`} x1={seg[0][0] * scale} y1={seg[0][1] * scale} x2={seg[1][0] * scale} y2={seg[1][1] * scale}
            stroke={color} strokeWidth={4} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
        ))}
        {stair.showStepNumbers && data.steps.map((step, i) => {
          const cx = step.footprint.reduce((s, p) => s + p[0], 0) / step.footprint.length * scale
          const cy = step.footprint.reduce((s, p) => s + p[1], 0) / step.footprint.length * scale
          return (
            <text key={`n${i}`} x={cx} y={cy} textAnchor="middle" fontSize={9} fontWeight={700} fill="#C0392B"
              style={{ pointerEvents: 'none', userSelect: 'none' }}>{step.index} · {Math.round(step.topHeight)}</text>
          )
        })}
      </g>
    )
  }

  const x = stair.x * scale, y = stair.y * scale
  const rot = stair.rotation || 0
  const wpx = data.width * scale * (data.flip ? -1 : 1)
  const runPx = data.runLength * scale
  const goingPx = data.going * scale

  const breakX = breakIdx > 0 ? breakIdx * goingPx : null

  const midY = wpx / 2
  const arrowStartX = Math.min(runPx * 0.15, goingPx)
  const arrowEndX = Math.max(arrowStartX + goingPx, runPx - goingPx * 0.6)

  const stringerLine = (ya, thick = false) => {
    const w = thick ? 4 : 1.5
    return breakX == null
      ? <line x1={0} y1={ya} x2={runPx} y2={ya} stroke={color} strokeWidth={w} />
      : (
        <>
          <line x1={0} y1={ya} x2={breakX} y2={ya} stroke={color} strokeWidth={w} />
          <line x1={breakX} y1={ya} x2={runPx} y2={ya} stroke={color} strokeWidth={w} strokeDasharray="5,3" />
        </>
      )
  }
  const supportIsNear = (data.supportSide || DEFAULT_SUPPORT_SIDE) === 'left'

  return (
    <g transform={`translate(${x},${y}) rotate(${rot})`}
      onMouseDown={onMouseDown} style={{ cursor: 'move' }}>
      <rect x={0} y={Math.min(0, wpx)} width={runPx} height={Math.abs(wpx)}
        fill={selected ? ACCENT + '14' : '#fafafa'} stroke="none" />

      {data.steps.map((step, i) => {
        const xPos = (i + 1) * goingPx
        const isAboveBreak = breakIdx >= 0 && i >= breakIdx
        return (
          <line key={i} x1={xPos} y1={0} x2={xPos} y2={wpx} stroke={color} strokeWidth={1}
            strokeDasharray={isAboveBreak ? '4,3' : undefined} />
        )
      })}
      <line x1={0} y1={0} x2={0} y2={wpx} stroke={color} strokeWidth={1.5} />

      {(!isFloating || supportIsNear) && stringerLine(0, isFloating && supportIsNear)}
      {(!isFloating || !supportIsNear) && stringerLine(wpx, isFloating && !supportIsNear)}

      {breakX != null && (() => {
        const jog = goingPx * 0.3
        const yq = wpx * 0.35, yh = wpx * 0.65
        return (
          <path d={`M ${breakX - jog} 0 L ${breakX + jog} ${yq} L ${breakX - jog} ${yh} L ${breakX + jog} ${wpx}`}
            stroke={color} strokeWidth={1.25} fill="none" />
        )
      })()}

      <g stroke={color} fill={color}>
        <line x1={arrowStartX} y1={midY} x2={arrowEndX} y2={midY} strokeWidth={1.5} />
        <path d={`M ${arrowEndX} ${midY} L ${arrowEndX - 10} ${midY - 5} L ${arrowEndX - 10} ${midY + 5} Z`} />
      </g>
      <text x={(arrowStartX + arrowEndX) / 2} y={midY - 6} textAnchor="middle" fontSize={10} fontWeight={700}
        fill={color} style={{ pointerEvents: 'none', userSelect: 'none' }}>{t('roomCanvas.stairUpLabel')}</text>

      <circle cx={0} cy={0} r={4} fill="#2AC87A" stroke="#fff" strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
      {stair.showStepNumbers && data.steps.map((step, i) => (
        <text key={`n${i}`} x={(i + 0.5) * goingPx} y={midY} textAnchor="middle" fontSize={9} fontWeight={700} fill="#C0392B"
          style={{ pointerEvents: 'none', userSelect: 'none' }}>{step.index} · {Math.round(step.topHeight)}</text>
      ))}
    </g>
  )
})

export default function RoomCanvas({
  room, scale, showGrid, showDimensions,
  elements, setElements, cabinets, setCabinets,
  selected, setSelected, selectedType, setSelectedType,
  wallThickness, setWallThickness,
  walls, setWalls,
  stairs = [], setStairs = () => {},
  backsplashSegments = [], setBacksplashSegments = () => {},
  readOnly,
  hideToolbar,
  hideBacksplashTool,
  hideWallsElements,
  bulkIds = EMPTY_BULK_IDS, onToggleBulk,
}) {
  const { t } = useTranslation()
  // Stale bulk-selected ids (e.g. a cabinet deleted after being shift-selected)
  // must not inflate the displayed count.
  const bulkCount = useMemo(() => cabinets.filter(c => bulkIds.has(c.id)).length, [cabinets, bulkIds])
  const [mode, setMode] = useState('select')
  const [startPoint, setStartPoint] = useState(null)
  const [mousePos, setMousePos] = useState(null)
  const [endpointSnap, setEndpointSnap] = useState(null)
  const [selectedWall, setSelectedWall] = useState(null)
  const [editingWall, setEditingWall] = useState(null)
  const [editingLenVal, setEditingLenVal] = useState(null)
  const [editingAngleVal, setEditingAngleVal] = useState(null)
  const [inputVal, setInputVal] = useState('')
  const [inputMode, setInputMode] = useState(null)
  const [lockedLength, setLockedLength] = useState(null)
  const [lockedAngle, setLockedAngle] = useState(null)
  const [history, setHistory] = useState([{ walls: [], stairs: [] }])
  const [dragging, setDragging] = useState(null)
  const [dragStart, setDragStart] = useState(null)
  const [wallSnapPreview, setWallSnapPreview] = useState(null)
  const [measureStart, setMeasureStart] = useState(null)
  const [measureEnd, setMeasureEnd] = useState(null)
  const [measureSnap, setMeasureSnap] = useState(null)

  // Zoom & Pan
  const [vx, setVx] = useState(0)
  const [vy, setVy] = useState(0)
  const [vw, setVw] = useState(null)
  const [vh, setVh] = useState(null)

  // Refs for always-current viewBox values
  const vwRef = useRef(null)
  const vhRef = useRef(null)

  const isPanningRef = useRef(false)
  const panLastRef = useRef(null)
  const zoomBoxActiveRef = useRef(false)
  const [zoomBox, setZoomBox] = useState(null)
  const wallClickedRef = useRef(false)
  const svgRef = useRef(null)

  // Remembers where the last cabinet click landed, so a repeated click at (roughly)
  // the same spot can be told apart from a fresh click elsewhere — see startElementDrag.
  const cabClickRef = useRef({ pos: null })

  const dragOriginScreenRef = useRef(null)
  const dragThresholdMetRef = useRef(false)
  const DRAG_THRESHOLD_PX = 4

  // Dragging (wall/element/cabinet) recomputes a new position on every raw
  // mousemove event, which can fire far more often than the screen repaints
  // (high-poll-rate mice/trackpads). Committing setWalls/setElements/setCabinets
  // on every single one of those events was forcing a full re-render of the
  // whole planner — including the always-mounted 3D view — many times more
  // often than the display can even show, which is what made dragging or
  // selecting a different cabinet feel heavy with a larger cabinet count.
  // Coalescing to one commit per animation frame keeps the same end result
  // (the state setter still receives the freshest computed position) while
  // capping the render rate to what the screen can actually display.
  const dragRafRef = useRef(null)
  const pendingDragCommitRef = useRef(null)
  const commitDragThrottled = useCallback((updater) => {
    pendingDragCommitRef.current = updater
    if (dragRafRef.current == null) {
      dragRafRef.current = requestAnimationFrame(() => {
        dragRafRef.current = null
        const fn = pendingDragCommitRef.current
        pendingDragCommitRef.current = null
        if (fn) fn()
      })
    }
  }, [])
  useEffect(() => () => { if (dragRafRef.current != null) cancelAnimationFrame(dragRafRef.current) }, [])

  useEffect(() => { if (hideToolbar) setMode('select') }, [hideToolbar])

  const W = room.width * scale
  const H = room.depth * scale
  const wallBodies = useMemo(() => computeWallBodies(walls, scale), [walls, scale])

  const cvw = vw ?? W
  const cvh = vh ?? H
  const zoom = W / cvw

  // Keep refs in sync
  vwRef.current = cvw
  vhRef.current = cvh

  // getScreenCTM() (like getBoundingClientRect()) forces the browser to
  // synchronously flush any pending layout before it can answer -- and since
  // every drag frame writes a cabinet's new position into this same SVG,
  // calling it fresh on every mousemove created a read-after-write layout-
  // thrashing loop: mousemove events fire far more often than the rAF-throttled
  // position commits, so most of them were forcing a full layout flush of the
  // whole SVG (walls, elements, all cabinets) for no reason. That's what kept
  // drags feeling like "lag then catch up" even after the render-side fixes.
  // The CTM only actually changes when the SVG's viewBox or on-screen size
  // changes, so it's computed once and cached instead (see the effects below).
  const ctmRef = useRef(null)
  const rectRef = useRef(null)
  const refreshCTM = useCallback(() => {
    const svg = svgRef.current
    ctmRef.current = svg ? (svg.getScreenCTM()?.inverse() || null) : null
    rectRef.current = svg ? svg.getBoundingClientRect() : null
  }, [])
  useEffect(() => { refreshCTM() }, [refreshCTM, vx, vy, cvw, cvh])
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(refreshCTM)
    ro.observe(svg)
    return () => ro.disconnect()
  }, [refreshCTM])

  // THE KEY FIX: use browser-native SVG matrix to convert screen → SVG coords
  // This automatically handles preserveAspectRatio letterboxing, zoom, pan, CSS transforms
  const getSVGPos = useCallback((e) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const inverse = ctmRef.current || svg.getScreenCTM()?.inverse()
    if (!inverse) return { x: 0, y: 0 }
    const svgP = pt.matrixTransform(inverse)
    return { x: svgP.x, y: svgP.y }
  }, [])

  // Zoom toward a point in screen coords
  const zoomAt = useCallback((screenX, screenY, factor) => {
    const svg = svgRef.current
    if (!svg) return
    // Convert zoom center to SVG coords using the matrix
    const pt = svg.createSVGPoint()
    pt.x = screenX
    pt.y = screenY
    const inverse = ctmRef.current || svg.getScreenCTM()?.inverse()
    if (!inverse) return
    const svgP = pt.matrixTransform(inverse)
    const _cvw = vwRef.current
    // Clamp the factor ONCE so vw/vh scale uniformly (aspect change = drift)
    let f = factor
    const minW = 50
    const maxW = W * 100
    if (_cvw * f < minW) f = minW / _cvw
    if (_cvw * f > maxW) f = maxW / _cvw
    if (f === 1) return
    // Keep the SVG point under the cursor fixed while scaling the viewBox
    setVx(v => svgP.x - (svgP.x - v) * f)
    setVy(v => svgP.y - (svgP.y - v) * f)
    setVw(_cvw * f)
    setVh(vhRef.current * f)
  }, [W, H])

  // Mouse wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 1.18 : 0.85
    zoomAt(e.clientX, e.clientY, factor)
  }, [zoomAt])

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Undoable actions on the Room tab all funnel through one combined
  // walls+stairs snapshot -- stair placement/deletion/drag needs Ctrl+Z to
  // work exactly like it does for walls, and a single history stack (rather
  // than two independent ones) keeps interleaved wall/stair edits undoing in
  // the actual order they happened.
  const pushHistory = useCallback((newWalls, newStairsArg) => {
    const newStairs = newStairsArg !== undefined ? newStairsArg : stairs
    setHistory(h => [...h.slice(-20), { walls: newWalls, stairs: newStairs }])
    setWalls(newWalls)
    if (newStairsArg !== undefined) setStairs(newStairs)
  }, [setWalls, setStairs, stairs])

  const undo = useCallback(() => {
    setHistory(h => {
      if (h.length <= 1) return h
      const prev = h[h.length - 2]
      setWalls(prev.walls)
      setStairs(prev.stairs)
      return h.slice(0, -1)
    })
  }, [setWalls, setStairs])

  // Keeping a constant on-screen snap radius by dividing by zoom is right most
  // of the time, but zoomed far out that turns into a huge world-space radius
  // that snaps to corners nowhere near the cursor -- cap it so zooming out
  // never makes drawing feel like it's grabbing distant, unrelated corners.
  const snapThreshold = Math.min(ENDPOINT_SNAP_DIST * 2 / zoom, ENDPOINT_SNAP_DIST * 5)

  const getPreviewEnd = useCallback(() => {
    if (!startPoint || !mousePos) return null
    const snapPt = findNearestEndpoint(mousePos.x, mousePos.y, walls, -1, snapThreshold)
    if (snapPt && !lockedLength && !lockedAngle) {
      const len = ptDist(startPoint.x, startPoint.y, snapPt.x, snapPt.y)
      const angleToSnap = Math.atan2(snapPt.y - startPoint.y, snapPt.x - startPoint.x)
      return { x: snapPt.x, y: snapPt.y, lengthMm: Math.max(0, Math.round(len / scale)), angleDeg: Math.round(radToDeg(angleToSnap)), snapped: true }
    }
    let angle, length
    if (lockedLength !== null && lockedAngle !== null) {
      angle = degToRad(lockedAngle); length = lockedLength * scale
    } else if (lockedLength !== null) {
      angle = Math.atan2(mousePos.y - startPoint.y, mousePos.x - startPoint.x)
      length = lockedLength * scale
    } else if (lockedAngle !== null) {
      angle = degToRad(lockedAngle)
      length = ptDist(startPoint.x, startPoint.y, mousePos.x, mousePos.y)
    } else {
      angle = Math.atan2(mousePos.y - startPoint.y, mousePos.x - startPoint.x)
      length = ptDist(startPoint.x, startPoint.y, mousePos.x, mousePos.y)
    }
    const displayLenMm = Math.max(0, Math.round(length / scale))
    return { x: startPoint.x + length * Math.cos(angle), y: startPoint.y + length * Math.sin(angle), lengthMm: displayLenMm, angleDeg: Math.round(radToDeg(angle)), snapped: false }
  }, [startPoint, mousePos, walls, lockedLength, lockedAngle, scale, snapThreshold])

  // Unlike a wall (dragged freely to any length), a stair's run length is a
  // derived quantity -- so the mouse only ever supplies the direction here.
  // With no typed length, the preview always shows the default going's run;
  // typing a length back-solves going for the fixed riser count instead.
  // A wide enough sideways swing of the mouse past the lower flight's own
  // heading reads as "the user is choosing a turn" rather than just an
  // imprecise straight click -- picked to be roughly one tread's worth of
  // deviation, not a hair-trigger.
  const STAIR_TURN_DETECT_MM = 250

  const getStairPreviewEnd = useCallback(() => {
    if (!startPoint || !mousePos) return null
    const dx = mousePos.x - startPoint.x, dy = mousePos.y - startPoint.y
    const wallAngle = findNearestWallAngle(startPoint.x, startPoint.y, walls, Infinity)
    const candidates = [0, 90, 180, 270]
    if (wallAngle != null) candidates.push(wallAngle, wallAngle + 90, wallAngle + 180, wallAngle + 270)

    const totalRise = room?.ceilingHeight || DEFAULT_TOTAL_RISE
    const maxRiser = DEFAULT_MAX_RISER

    let dominantDeg = null, dominantProj = -Infinity
    candidates.forEach(c => {
      const rad = degToRad(c)
      const proj = dx * Math.cos(rad) + dy * Math.sin(rad)
      if (proj > dominantProj) { dominantProj = proj; dominantDeg = c }
    })
    const domRad = degToRad(dominantDeg)
    const perpProjStd = -dx * Math.sin(domRad) + dy * Math.cos(domRad)
    const isTurning = lockedAngle === null && Math.abs(perpProjStd) / scale > STAIR_TURN_DETECT_MM

    if (!isTurning) {
      const rawAngle = radToDeg(Math.atan2(dy, dx))
      const snappedCandidate = snapAngleToCandidates(rawAngle, candidates, 6)
      const angleDeg = lockedAngle !== null ? lockedAngle : (snappedCandidate ?? rawAngle)
      const draftStair = { totalRise, maxRiser, going: lockedLength !== null ? goingFromRunLength({ totalRise, maxRiser }, lockedLength) : DEFAULT_GOING }
      const derived = computeStairDerived(draftStair)
      const lenPx = derived.runLength * scale
      const rad = degToRad(angleDeg)
      return {
        isWinder: false,
        x: startPoint.x + lenPx * Math.cos(rad), y: startPoint.y + lenPx * Math.sin(rad),
        angleDeg: Math.round(angleDeg), lengthMm: Math.round(derived.runLength),
        totalRise, maxRiser, going: derived.going,
        snapped: lockedAngle === null && snappedCandidate != null,
      }
    }

    const going = DEFAULT_GOING
    const baseDerived = computeStairDerived({ totalRise, maxRiser, going })
    const windersPerTurn = DEFAULT_WINDERS_PER_TURN
    const maxStepsBeforeTurn = Math.max(0, baseDerived.treadCount - windersPerTurn)
    const typedTreads = lockedLength !== null ? Math.round(lockedLength / going) : maxStepsBeforeTurn
    const stepsBeforeTurn = Math.min(Math.max(0, typedTreads), maxStepsBeforeTurn)

    return {
      isWinder: true,
      x: mousePos.x, y: mousePos.y,
      angleDeg: Math.round(dominantDeg),
      lengthMm: Math.round(stepsBeforeTurn * going),
      totalRise, maxRiser, going, stepsBeforeTurn,
      turnDirection: perpProjStd > 0 ? 'left' : 'right',
      snapped: true,
    }
  }, [startPoint, mousePos, walls, lockedLength, lockedAngle, scale, room])

  const buildStairFromDraft = useCallback((start, end) => {
    const xMm = start.x / scale, yMm = start.y / scale
    const flip = chooseDefaultStairSide(xMm, yMm, end.angleDeg, room)
    if (end.isWinder) {
      const side = flip ? -1 : 1
      const turnDirection = side === 1 ? end.turnDirection : (end.turnDirection === 'left' ? 'right' : 'left')
      return {
        id: makeStairId(), shape: 'L-winder',
        x: xMm, y: yMm, rotation: end.angleDeg,
        width: DEFAULT_STAIR_WIDTH, flip,
        totalRise: end.totalRise, maxRiser: end.maxRiser, going: end.going, nosing: DEFAULT_NOSING,
        turnDirection, windersPerTurn: DEFAULT_WINDERS_PER_TURN, stepsBeforeTurn: end.stepsBeforeTurn,
        pivotOffset: DEFAULT_PIVOT_OFFSET, walklineOffset: DEFAULT_WALKLINE_OFFSET, showWalkline: false,
        color: '#C9A876', finish: 'wood', materialCode: null,
      }
    }
    return {
      id: makeStairId(), shape: 'straight',
      x: xMm, y: yMm, rotation: end.angleDeg,
      width: DEFAULT_STAIR_WIDTH, flip,
      totalRise: end.totalRise, maxRiser: end.maxRiser, going: end.going, nosing: DEFAULT_NOSING,
      color: '#C9A876', finish: 'wood', materialCode: null,
    }
  }, [scale, room])

  useEffect(() => {
    if (mode !== 'draw' && mode !== 'backsplash' && mode !== 'measure' && mode !== 'stair') return
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return
      if (e.key === 'Escape') {
        // One Escape press fully stops drawing and returns to Select — already
        // placed/committed wall or backsplash segments are untouched either way,
        // this only cancels whatever in-progress point hasn't been committed yet.
        setStartPoint(null); setLockedLength(null); setLockedAngle(null); setInputVal(''); setInputMode(null)
        setMeasureStart(null); setMeasureEnd(null)
        setMode('select')
        return
      }
      if (mode !== 'draw' && mode !== 'stair') return
      if (e.key === 'Enter' && mode === 'stair') {
        const end = getStairPreviewEnd()
        if (end && startPoint && (end.isWinder || end.lengthMm > 0)) {
          const newStair = buildStairFromDraft(startPoint, end)
          pushHistory(walls, [...stairs, newStair])
          setStartPoint(null); setLockedLength(null); setLockedAngle(null); setInputVal(''); setInputMode(null)
          setSelected(newStair.id); setSelectedType('stair')
          setMode('select')
        }
        return
      }
      if (e.key === 'Enter' && mode === 'draw') {
        const end = getPreviewEnd()
        if (end && startPoint && end.lengthMm > 0) {
          pushHistory([...walls, { id: makeWallId(), x1: startPoint.x, y1: startPoint.y, x2: end.x, y2: end.y, thickness: wallThickness, thicknessSide: chooseDefaultThicknessSide(startPoint.x, startPoint.y, end.x, end.y, walls) }])
          setStartPoint({ x: end.x, y: end.y })
          setLockedLength(null); setLockedAngle(null); setInputVal(''); setInputMode(null)
        }
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        if (inputMode === 'length') { const l = parseFloat(inputVal); if (!isNaN(l) && l > 0) { setLockedLength(l); setInputMode('angle'); setInputVal('') } }
        else if (inputMode === 'angle') { const a = parseFloat(inputVal); if (!isNaN(a)) { setLockedAngle(a); setInputMode(null); setInputVal('') } }
        return
      }
      if (/^[0-9.\-]$/.test(e.key) && startPoint) {
        if (inputMode === null) { setInputMode('length'); setInputVal(e.key) }
        else setInputVal(v => v + e.key)
        return
      }
      if (e.key === 'Backspace' && inputMode) setInputVal(v => v.slice(0, -1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mode, startPoint, inputMode, inputVal, getPreviewEnd, getStairPreviewEnd, buildStairFromDraft, walls, stairs, pushHistory, setSelected, setSelectedType])

  useEffect(() => {
    if (inputMode === 'length') { const l = parseFloat(inputVal); setLockedLength(!isNaN(l) && l > 0 ? l : null) }
    else if (inputMode === 'angle') { const a = parseFloat(inputVal); setLockedAngle(!isNaN(a) ? a : null) }
  }, [inputVal, inputMode])

  useEffect(() => {
    if (mode !== 'select') return
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWall !== null) {
        pushHistory(walls.filter((_, i) => i !== selectedWall)); setSelectedWall(null); return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected != null) {
        if (selectedType === 'cabinet') setCabinets(p => p.filter(c => c.id !== selected))
        else if (selectedType === 'element') setElements(p => p.filter(el => el.id !== selected))
        else if (selectedType === 'backsplash') setBacksplashSegments(p => p.filter(s => s.id !== selected))
        else if (selectedType === 'stair') pushHistory(walls, stairs.filter(s => s.id !== selected))
        setSelected(null); setSelectedType(null)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { undo(); return }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D') && selected != null) {
        e.preventDefault()
        const OFFSET = 100 // mm — small nudge so the copy doesn't sit exactly on top of the original
        if (selectedType === 'cabinet') {
          const src = cabinets.find(c => c.id === selected)
          if (src) {
            const copy = { ...src, id: Date.now(), x: src.x + OFFSET, y: src.y + OFFSET }
            setCabinets(p => [...p, copy])
            setSelected(copy.id)
          }
        } else if (selectedType === 'element') {
          const src = elements.find(el => el.id === selected)
          if (src) {
            const copy = { ...src, id: Date.now() + 1, x: src.x + OFFSET, y: src.y + OFFSET, embeddedInWall: false, wallAngle: undefined }
            setElements(p => [...p, copy])
            setSelected(copy.id)
          }
        }
        return
      }
      if (e.key === 'r' || e.key === 'R') {
        if (selectedType === 'cabinet') setCabinets(p => p.map(c => c.id === selected ? { ...c, rotation: ((c.rotation || 0) + 90) % 360 } : c))
        else if (selectedType === 'element') setElements(p => p.map(el => el.id === selected ? { ...el, rotation: ((el.rotation || 0) + 90) % 360 } : el))
        else if (selectedType === 'stair') setStairs(p => p.map(s => s.id === selected ? { ...s, rotation: ((s.rotation || 0) + 90) % 360 } : s))
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selected != null) {
        e.preventDefault()
        const step = e.shiftKey ? 1 : 10 // mm
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        if (selectedType === 'cabinet') setCabinets(p => p.map(c => c.id === selected ? { ...c, x: c.x + dx, y: c.y + dy } : c))
        else if (selectedType === 'element') setElements(p => p.map(el => el.id === selected ? { ...el, x: el.x + dx, y: el.y + dy } : el))
        else if (selectedType === 'stair') setStairs(p => p.map(s => s.id === selected ? { ...s, x: s.x + dx, y: s.y + dy } : s))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mode, selected, selectedType, selectedWall, walls, stairs, pushHistory, undo, setCabinets, setElements, setBacksplashSegments, setStairs])

  const handleCanvasClick = useCallback((e) => {
    if (isPanningRef.current) return
    if (wallClickedRef.current) { wallClickedRef.current = false; return }
    if (mode !== 'backsplash' && mode !== 'measure' && e.target !== svgRef.current && e.target.tagName !== 'svg') return
    if (mode === 'select') {
      setSelectedWall(null); setSelected(null); setSelectedType(null); return
    }
    if (mode === 'measure') {
      const pos = getSVGPos(e)
      const snapped = findMeasureSnapPoint(pos.x, pos.y, walls, cabinets, wallThickness, scale, snapThreshold) || pos
      if (!measureStart || measureEnd) {
        // First click, or a third click after a completed measurement — start fresh.
        setMeasureStart(snapped); setMeasureEnd(null)
      } else {
        setMeasureEnd(snapped)
      }
      return
    }
    if (mode === 'backsplash') {
      const pos = getSVGPos(e)
      const hit = findNearestCabinetEdge(pos.x, pos.y, cabinets, scale, 8 / zoom)
      if (hit) {
        const segId = `cabedge-${hit.cab.id}-${hit.side}`
        const exists = backsplashSegments.some(s => s.id === segId)
        const isCurrentlySelected = selected === segId && selectedType === 'backsplash'
        if (isCurrentlySelected) {
          // Clicking the already-selected edge again deletes it.
          setBacksplashSegments(p => p.filter(s => s.id !== segId))
          setSelected(null); setSelectedType(null)
        } else if (exists) {
          // Clicking a different existing segment selects it (opens the panel).
          setSelected(segId); setSelectedType('backsplash')
        } else {
          // Empty edge: add a new segment and select it.
          setBacksplashSegments(p => [...p, { id: segId, cabinetId: hit.cab.id, side: hit.side, ...hit.edge }])
          setSelected(segId); setSelectedType('backsplash')
        }
      }
      return
    }
    if (mode === 'stair') {
      const pos = getSVGPos(e)
      if (!startPoint) {
        // The bottom step's start point snaps to a wall corner first, then to
        // a wall face (T-junction style), exactly like starting a new wall.
        let finalPos = findNearestEndpoint(pos.x, pos.y, walls, -1, snapThreshold)
        if (!finalPos) {
          const wallSnap = findWallSnap(pos.x, pos.y, walls, wallThickness, scale, snapThreshold)
          if (wallSnap) finalPos = { x: wallSnap.centerX, y: wallSnap.centerY }
        }
        setStartPoint(finalPos || pos)
        return
      }
      const end = getStairPreviewEnd()
      if (end && (end.isWinder || end.lengthMm > 0)) {
        const newStair = buildStairFromDraft(startPoint, end)
        pushHistory(walls, [...stairs, newStair])
        setStartPoint(null); setLockedLength(null); setLockedAngle(null); setInputVal(''); setInputMode(null)
        setSelected(newStair.id); setSelectedType('stair')
        setMode('select')
      }
      return
    }
    const pos = getSVGPos(e)
    const snapPt = findNearestEndpoint(pos.x, pos.y, walls, -1, snapThreshold)
    if (!startPoint) {
      // Starting a new wall: snap to a nearby corner first, and if there isn't
      // one, also try snapping onto the BODY of an existing wall (T-junction),
      // not just its endpoints — clicking anywhere near an existing wall should
      // let you branch a new one off of it.
      let finalPos = snapPt
      if (!finalPos) {
        const wallSnap = findWallSnap(pos.x, pos.y, walls, wallThickness, scale, snapThreshold)
        if (wallSnap) finalPos = { x: wallSnap.centerX, y: wallSnap.centerY }
      }
      setStartPoint(finalPos || pos)
      return
    }
    const finalPos = snapPt || pos
    const end = getPreviewEnd()
    if (end && end.lengthMm > 0) {
      pushHistory([...walls, { id: makeWallId(), x1: startPoint.x, y1: startPoint.y, x2: end.x, y2: end.y, thickness: wallThickness, thicknessSide: chooseDefaultThicknessSide(startPoint.x, startPoint.y, end.x, end.y, walls) }])
      setStartPoint({ x: end.x, y: end.y })
      setLockedLength(null); setLockedAngle(null); setInputVal(''); setInputMode(null)
    }
  }, [mode, startPoint, getPreviewEnd, getStairPreviewEnd, buildStairFromDraft, getSVGPos, walls, stairs, pushHistory, setSelected, setSelectedType, snapThreshold, cabinets, scale, zoom, setBacksplashSegments, wallThickness, measureStart, measureEnd])

  const handleMouseDown = useCallback((e) => {
    if (e.button === 2) {
      e.preventDefault()
      const pos = getSVGPos(e)
      zoomBoxActiveRef.current = true
      setZoomBox({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y })
      return
    }
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault()
      isPanningRef.current = true
      panLastRef.current = { x: e.clientX, y: e.clientY }
    }
  }, [getSVGPos])

  const handleMouseMove = useCallback((e) => {
    // Pan using screen coord delta
    if (isPanningRef.current && panLastRef.current) {
      const _cvw = vwRef.current
      const _cvh = vhRef.current
      const rect = rectRef.current || svgRef.current?.getBoundingClientRect()
      if (!rect) return
      const scaleX = _cvw / rect.width
      const scaleY = _cvh / rect.height
      const dx = (e.clientX - panLastRef.current.x) * scaleX
      const dy = (e.clientY - panLastRef.current.y) * scaleY
      panLastRef.current = { x: e.clientX, y: e.clientY }
      setVx(v => v - dx)
      setVy(v => v - dy)
      return
    }

    const pos = getSVGPos(e)
    const rawX = pos.x, rawY = pos.y
    // mousePos is only ever read by the draw/measure/backsplash hover previews
    // (see getPreviewEnd and the render-time mode checks below) -- but as plain
    // state it used to get set on every raw mousemove event regardless of mode,
    // which forces this whole component (including the full 50-cabinet SVG
    // list) to re-render on every pixel of mouse movement even while just
    // dragging a cabinet around in 'select' mode. Only track it in the modes
    // that actually use it.
    if (mode === 'draw' || mode === 'measure' || mode === 'backsplash' || mode === 'stair') {
      setMousePos({ x: rawX, y: rawY })
    }
    if (zoomBoxActiveRef.current) { setZoomBox(z => (z ? { ...z, x2: rawX, y2: rawY } : z)); return }
    // Show the snap preview even before the first click of a new wall — not just
    // once a startPoint already exists — so there's visual confirmation of where
    // a wall will connect before you commit to the click.
    if (mode === 'draw' || mode === 'stair') setEndpointSnap(findNearestEndpoint(rawX, rawY, walls, -1, snapThreshold))
    if (mode === 'measure') setMeasureSnap(findMeasureSnapPoint(rawX, rawY, walls, cabinets, wallThickness, scale, snapThreshold))
    if (!dragging) return

    if (!dragThresholdMetRef.current) {
      const origin = dragOriginScreenRef.current
      if (origin && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) < DRAG_THRESHOLD_PX) return
      dragThresholdMetRef.current = true
    }

    if (dragging.type === 'wall') {
      const dx = rawX - dragStart.x, dy = rawY - dragStart.y
      const orig = dragging.origWall
      const nx1 = orig.x1 + dx, ny1 = orig.y1 + dy, nx2 = orig.x2 + dx, ny2 = orig.y2 + dy
      const s1 = findNearestEndpoint(nx1, ny1, walls, dragging.index, snapThreshold)
      const s2 = findNearestEndpoint(nx2, ny2, walls, dragging.index, snapThreshold)
      let fx1 = nx1, fy1 = ny1, fx2 = nx2, fy2 = ny2
      if (s1) { fx2 += s1.x - nx1; fy2 += s1.y - ny1; fx1 = s1.x; fy1 = s1.y }
      else if (s2) { fx1 += s2.x - nx2; fy1 += s2.y - ny2; fx2 = s2.x; fy2 = s2.y }
      commitDragThrottled(() => setWalls(p => p.map((w, i) => i === dragging.index ? { ...w, x1: fx1, y1: fy1, x2: fx2, y2: fy2 } : w)))
    } else if (dragging.type === 'endpoint') {
      const snapPt = findNearestEndpoint(rawX, rawY, walls, dragging.wallIndex, snapThreshold)
      const fx = snapPt ? snapPt.x : rawX, fy = snapPt ? snapPt.y : rawY
      commitDragThrottled(() => setWalls(p => p.map((w, i) => i !== dragging.wallIndex ? w : dragging.ep === 0 ? { ...w, x1: fx, y1: fy } : { ...w, x2: fx, y2: fy })))
    } else if (dragging.type === 'element') {
      const item = elements.find(el => el.id === dragging.id)
      if (!item) return
      const wallSnap = findWallSnap(rawX, rawY, walls, wallThickness, scale, 40 / zoom)
      if (wallSnap && WALL_SNAPPABLE_TYPES.has(item.type)) {
        const snappedThickness = getWallThickness(walls[wallSnap.wallIndex])
        const mid = getWallMidlinePoint(wallBodies[wallSnap.wallIndex], wallSnap.centerX, wallSnap.centerY, wallSnap.t)
        setWallSnapPreview({ ...wallSnap, centerX: mid.x, centerY: mid.y })
        commitDragThrottled(() => setElements(p => p.map(el => el.id === dragging.id ? {
          ...el, x: mid.x / scale, y: mid.y / scale,
          wallAngle: wallSnap.wallAngle, wallThickness: snappedThickness, embeddedInWall: true, wallIndex: wallSnap.wallIndex,
        } : el)))
      } else {
        setWallSnapPreview(null)
        const x = Math.max(0, snap(rawX / scale - dragging.offsetX))
        const y = Math.max(0, snap(rawY / scale - dragging.offsetY))
        commitDragThrottled(() => setElements(p => p.map(el => el.id === dragging.id ? { ...el, x, y, wallAngle: undefined, embeddedInWall: false } : el)))
      }
    } else if (dragging.type === 'cabinet') {
      const cab = cabinets.find(c => c.id === dragging.id)
      if (!cab) return
      const SNAP_PX = 15 / zoom
      const rawCabX = rawX - dragging.offsetX * scale
      const rawCabY = rawY - dragging.offsetY * scale
      const cabWpx = cab.width * scale
      const cabDpx = cab.depth * scale
      let finalX = rawCabX, finalY = rawCabY
      let snappedX = false, snappedY = false

      cabinets.forEach(other => {
        if (other.id === dragging.id) return
        const ox = other.x * scale, oy = other.y * scale
        const ow = other.width * scale, od = other.depth * scale
        const panelBackFirst = cab.subtype === 'Side Panel'
        if (!snappedX) {
          if (panelBackFirst && Math.abs(rawCabX - ox) < SNAP_PX) { finalX = ox; snappedX = true }
          else if (Math.abs(rawCabX + cabWpx - ox) < SNAP_PX) { finalX = ox - cabWpx; snappedX = true }
          else if (Math.abs(rawCabX - (ox + ow)) < SNAP_PX) { finalX = ox + ow; snappedX = true }
          else if (Math.abs(rawCabX - ox) < SNAP_PX) { finalX = ox; snappedX = true }
          else if (Math.abs(rawCabX + cabWpx - (ox + ow)) < SNAP_PX) { finalX = ox + ow - cabWpx; snappedX = true }
        }
        if (!snappedY) {
          if (panelBackFirst && Math.abs(rawCabY - oy) < SNAP_PX) { finalY = oy; snappedY = true }
          else if (Math.abs(rawCabY + cabDpx - oy) < SNAP_PX) { finalY = oy - cabDpx; snappedY = true }
          else if (Math.abs(rawCabY - (oy + od)) < SNAP_PX) { finalY = oy + od; snappedY = true }
          else if (Math.abs(rawCabY - oy) < SNAP_PX) { finalY = oy; snappedY = true }
          else if (Math.abs(rawCabY + cabDpx - (oy + od)) < SNAP_PX) { finalY = oy + od - cabDpx; snappedY = true }
        }
      })

      walls.forEach(w => {
        const dx = w.x2 - w.x1, dy = w.y2 - w.y1
        const len = Math.hypot(dx, dy)
        if (len === 0) return
        const ux = dx / len, uy = dy / len
        const nx = uy, ny = -ux
        const ccx = rawCabX + cabWpx / 2
        const ccy = rawCabY + cabDpx / 2
        const t = Math.max(0, Math.min(1, ((ccx - w.x1) * ux + (ccy - w.y1) * uy) / len))
        const projX = w.x1 + t * dx, projY = w.y1 + t * dy
        const distToWall = (ccx - projX) * nx + (ccy - projY) * ny
        const backFaceDist = Math.abs(Math.abs(distToWall) - cabDpx / 2)
        if (backFaceDist < SNAP_PX) {
          const sign = distToWall >= 0 ? 1 : -1
          const snapCCX = projX + nx * sign * (cabDpx / 2)
          const snapCCY = projY + ny * sign * (cabDpx / 2)
          if (!snappedX) { finalX = snapCCX - cabWpx / 2; snappedX = true }
          if (!snappedY) { finalY = snapCCY - cabDpx / 2; snappedY = true }
        }
      })

      if (!snappedX) finalX = Math.round(rawCabX / (GRID * scale)) * (GRID * scale)
      if (!snappedY) finalY = Math.round(rawCabY / (GRID * scale)) * (GRID * scale)
      commitDragThrottled(() => setCabinets(p => p.map(c => c.id === dragging.id ? { ...c, x: finalX / scale, y: finalY / scale } : c)))
    } else if (dragging.type === 'stair') {
      const dx2 = rawX - dragStart.x, dy2 = rawY - dragStart.y
      const nx = dragging.orig.x * scale + dx2, ny = dragging.orig.y * scale + dy2
      const snapPt = findNearestEndpoint(nx, ny, walls, -1, snapThreshold)
      const fx = snapPt ? snapPt.x : nx, fy = snapPt ? snapPt.y : ny
      commitDragThrottled(() => setStairs(p => p.map(s => s.id === dragging.id ? { ...s, x: fx / scale, y: fy / scale } : s)))
    }
  }, [dragging, dragStart, mode, startPoint, walls, wallThickness, scale, elements, cabinets, setWalls, setCabinets, setElements, setStairs, getSVGPos, snapThreshold, zoom, commitDragThrottled])

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false
    panLastRef.current = null
    if (zoomBoxActiveRef.current) {
      zoomBoxActiveRef.current = false
      setZoomBox(z => {
        if (z) {
          const minX = Math.min(z.x1, z.x2), maxX = Math.max(z.x1, z.x2)
          const minY = Math.min(z.y1, z.y2), maxY = Math.max(z.y1, z.y2)
          if (maxX - minX > 5 && maxY - minY > 5) applyViewBounds(minX, minY, maxX, maxY, 0.04)
        }
        return null
      })
      return
    }
    if (dragging && (dragging.type === 'wall' || dragging.type === 'endpoint' || dragging.type === 'stair')) {
      setHistory(h => [...h.slice(-20), { walls, stairs }])
    }
    dragOriginScreenRef.current = null
    dragThresholdMetRef.current = false
    setDragging(null); setDragStart(null); setWallSnapPreview(null)
  }, [dragging, walls, stairs])

  const startWallDrag = useCallback((e, index) => {
    if (mode !== 'select' || hideWallsElements) return
    e.stopPropagation()
    wallClickedRef.current = true
    dragOriginScreenRef.current = { x: e.clientX, y: e.clientY }
    dragThresholdMetRef.current = false
    setDragging({ type: 'wall', index, origWall: { ...walls[index] } })
    setDragStart(getSVGPos(e))
  }, [mode, hideWallsElements, walls, getSVGPos])

  const startEndpointDrag = useCallback((e, wallIndex, ep) => {
    if (mode !== 'select' || hideWallsElements) return
    e.stopPropagation()
    dragOriginScreenRef.current = { x: e.clientX, y: e.clientY }
    dragThresholdMetRef.current = false
    setDragging({ type: 'endpoint', wallIndex, ep })
    setDragStart(getSVGPos(e))
  }, [mode, hideWallsElements, getSVGPos])

  const startElementDrag = useCallback((e, id, type) => {
    // Draw tools (walls/backsplash) place points on click — don't let clicking
    // an existing cabinet/element hijack that into a drag-and-select instead.
    if (mode !== 'select') return
    // Room elements (windows/doors/etc.) and stairs are fully non-interactive
    // on tabs that pass hideWallsElements (e.g. the Cabinets tab) — cabinets
    // are unaffected.
    if ((type === 'element' || type === 'stair') && hideWallsElements) return
    e.stopPropagation()
    const pos = getSVGPos(e)
    let targetId = id
    if (type === 'cabinet') {
      // Cabinets at different elevations (e.g. a wall unit directly above a base
      // unit) share the same plan footprint, so a plain click can only ever reach
      // whichever one the browser happens to hit-test on top — usually whatever
      // was drawn last. Compute our own deterministic stack of every cabinet under
      // the click (highest-mounted first) and cycle through it on repeated clicks
      // at (roughly) the same spot, so cabinets underneath stay reachable — the
      // same "click again to reach the one below" idiom design tools use.
      const mmX = pos.x / scale, mmY = pos.y / scale
      const stack = cabinets
        .filter(c => pointInPolygon(mmX, mmY, getCabCorners(c)))
        .sort((a, b) => getCabElevRange(b)[0] - getCabElevRange(a)[0])
      if (stack.length > 0) {
        const last = cabClickRef.current
        const samePlace = last.pos && Math.hypot(pos.x - last.pos.x, pos.y - last.pos.y) < 6
        const prevIdx = samePlace ? stack.findIndex(c => c.id === selected) : -1
        targetId = stack[(prevIdx + 1) % stack.length].id
      }
      cabClickRef.current = { pos }
    }
    // Shift/Ctrl/Cmd-click a cabinet to toggle it in/out of the bulk color-edit
    // selection instead of the normal single-select-and-drag flow.
    if (type === 'cabinet' && onToggleBulk && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      onToggleBulk(targetId)
      return
    }
    const item = type === 'cabinet' ? cabinets.find(c => c.id === targetId)
      : type === 'stair' ? stairs.find(s => s.id === targetId)
      : elements.find(el => el.id === targetId)
    if (!item) return
    dragOriginScreenRef.current = { x: e.clientX, y: e.clientY }
    dragThresholdMetRef.current = false
    setDragging(type === 'stair'
      ? { type, id: targetId, orig: { x: item.x, y: item.y } }
      : { type, id: targetId, offsetX: pos.x / scale - item.x, offsetY: pos.y / scale - item.y })
    setDragStart(pos)
    setSelected(targetId)
    setSelectedType(type)
  }, [mode, hideWallsElements, cabinets, elements, stairs, getSVGPos, setSelected, setSelectedType, selected, scale, onToggleBulk])

  // startElementDrag's identity changes on every cabinet edit (it closes over
  // `cabinets`/`selected`), which would defeat CabinetShape2D's memoization if
  // handed to it directly -- every one of the 50 cabinets would see a "new"
  // onMouseDown prop on every render. Routing through a ref keeps the callback
  // identity permanently stable while always invoking the latest closure.
  const startElementDragRef = useRef(startElementDrag)
  useEffect(() => { startElementDragRef.current = startElementDrag }, [startElementDrag])
  const handleCabinetMouseDown = useCallback((e, id) => startElementDragRef.current(e, id, 'cabinet'), [])

  const confirmWallEdit = useCallback(() => {
    if (editingWall === null || !editingLenVal || editingLenVal <= 0) { setEditingWall(null); setEditingLenVal(null); setEditingAngleVal(null); return }
    pushHistory(walls.map((w, i) => {
      if (i !== editingWall) return w
      // Use the typed angle if the user changed it; otherwise keep the wall's
      // current angle so editing only the length doesn't rotate it.
      const angleDeg = editingAngleVal ?? radToDeg(Math.atan2(w.y2 - w.y1, w.x2 - w.x1))
      const angleRad = degToRad(angleDeg)
      const lenPx = editingLenVal * scale
      return { ...w, x2: w.x1 + lenPx * Math.cos(angleRad), y2: w.y1 + lenPx * Math.sin(angleRad) }
    }))
    setEditingWall(null); setEditingLenVal(null); setEditingAngleVal(null)
  }, [editingWall, editingLenVal, editingAngleVal, walls, scale, pushHistory])

  // ---- Collision detection: overlapping footprint AND overlapping elevation range ----
  const collidingIds = useMemo(() => {
    const ids = new Set()
    // Each cabinet's corners/elevation range only depend on its own fields, not
    // on which pair is being tested -- precomputing them once here instead of
    // inside the double loop below cuts what used to be ~n^2 recomputations
    // (2 per pair) down to n, which matters once n (cabinet count) gets past
    // a couple dozen.
    const corners = cabinets.map(getCabCorners)
    const elevRanges = cabinets.map(getCabElevRange)
    for (let i = 0; i < cabinets.length; i++) {
      for (let j = i + 1; j < cabinets.length; j++) {
        if (!rangesOverlap(elevRanges[i], elevRanges[j])) continue
        if (polysIntersect(corners[i], corners[j])) { ids.add(cabinets[i].id); ids.add(cabinets[j].id) }
      }
    }
    // Walls run full floor-to-ceiling, so any cabinet overlapping one in plan view is a real
    // collision regardless of the cabinet's own elevation (base, wall, or tall).
    wallBodies.forEach(body => {
      const wallCorners = getWallCorners(body, scale)
      if (!wallCorners) return
      cabinets.forEach((cab, i) => {
        if (polysIntersect(corners[i], wallCorners)) ids.add(cab.id)
      })
    })
    // A stair is solid from the floor up to each step's own top height, not the
    // stair's overall bounding box -- testing per step (rather than one box sized
    // to the whole flight) is what lets a wall cabinet mounted above a step's
    // clearance, or any cabinet positioned past the stair's actual footprint,
    // correctly avoid a false collision.
    stairs.forEach(st => {
      computeStairSteps(st).steps.forEach(step => {
        cabinets.forEach((cab, i) => {
          if (!rangesOverlap(elevRanges[i], [step.bottomHeight, step.topHeight])) return
          if (polysIntersect(corners[i], step.footprint)) ids.add(cab.id)
        })
      })
    })
    return ids
  }, [cabinets, wallBodies, stairs, scale])

  const centerCabinetOnNearestOpening = (cabId) => {
    const cab = cabinets.find(c => c.id === cabId)
    if (!cab) return
    const openings = elements.filter(el => (el.type === 'window' || el.type === 'door') && el.embeddedInWall)
    if (openings.length === 0) return
    const cabCenterX = cab.x + cab.width / 2
    const cabCenterY = cab.y + cab.depth / 2
    let best = null, bestDist = Infinity
    openings.forEach(el => {
      const d = Math.hypot(el.x - cabCenterX, el.y - cabCenterY)
      if (d < bestDist) { bestDist = d; best = el }
    })
    if (!best) return
    const rad = ((best.wallAngle || 0) * Math.PI) / 180
    const ux = Math.cos(rad), uy = Math.sin(rad)
    const delta = (best.x - cabCenterX) * ux + (best.y - cabCenterY) * uy
    setCabinets(p => p.map(c => c.id === cabId ? { ...c, x: c.x + delta * ux, y: c.y + delta * uy } : c))
  }

  const applyViewBounds = useCallback((minX, minY, maxX, maxY, padFrac = 0.08) => {
    const pad = Math.max((maxX - minX), (maxY - minY)) * padFrac || 50
    minX -= pad; minY -= pad; maxX += pad; maxY += pad
    // Match the SVG element's aspect ratio so content is centered, not top-left
    const svg = svgRef.current
    const rect = svg ? svg.getBoundingClientRect() : { width: 1, height: 1 }
    const aspect = rect.width / rect.height
    let bw = maxX - minX, bh = maxY - minY
    if (bw / bh > aspect) {
      const nh = bw / aspect
      minY -= (nh - bh) / 2; bh = nh
    } else {
      const nw = bh * aspect
      minX -= (nw - bw) / 2; bw = nw
    }
    setVx(minX); setVy(minY); setVw(bw); setVh(bh)
  }, [])

  const fitView = () => {
    // Collect points from all design content (px coords)
    const pts = []
    walls.forEach(w => { pts.push([w.x1, w.y1], [w.x2, w.y2]) })
    const addRotRect = (x, y, w, h, rot, cx, cy) => {
      const rad = (rot || 0) * Math.PI / 180
      const cos = Math.cos(rad), sin = Math.sin(rad)
      ;[[x, y], [x + w, y], [x + w, y + h], [x, y + h]].forEach(([px, py]) => {
        pts.push([cx + (px - cx) * cos - (py - cy) * sin, cy + (px - cx) * sin + (py - cy) * cos])
      })
    }
    cabinets.forEach(cab => {
      const x = cab.x * scale, y = cab.y * scale, w = cab.width * scale, h = cab.depth * scale
      addRotRect(x, y, w, h, cab.rotation, x + w / 2, y + h / 2)
    })
    elements.forEach(el => {
      const x = el.x * scale, y = el.y * scale
      addRotRect(x, y, el.w * scale, el.h * scale, el.rotation, x, y)
    })
    // Nothing drawn yet: fall back to the room rect
    if (pts.length === 0) { setVx(0); setVy(0); setVw(null); setVh(null); return }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    pts.forEach(([px, py]) => {
      if (px < minX) minX = px; if (px > maxX) maxX = px
      if (py < minY) minY = py; if (py > maxY) maxY = py
    })
    applyViewBounds(minX, minY, maxX, maxY, 0.08)
  }

  const zoomToSelection = () => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const addPt = (x, y) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y }
    if (selectedWall !== null && walls[selectedWall]) {
      const w = walls[selectedWall]
      addPt(w.x1, w.y1); addPt(w.x2, w.y2)
    } else if (selected != null) {
      const cab = cabinets.find(c => c.id === selected)
      if (cab) {
        const x = cab.x * scale, y = cab.y * scale, w = cab.width * scale, h = cab.depth * scale
        addPt(x, y); addPt(x + w, y); addPt(x, y + h); addPt(x + w, y + h)
      } else {
        const el = elements.find(e => e.id === selected)
        if (el) {
          const x = el.x * scale, y = el.y * scale, w = el.w * scale, h = el.h * scale
          addPt(x - w / 2, y - h / 2); addPt(x + w / 2, y + h / 2)
        }
      }
    }
    if (minX === Infinity) return
    applyViewBounds(minX, minY, maxX, maxY, 0.6)
  }

  // Depends only on the viewport (pan/zoom) and grid toggle, never on cabinets --
  // but as a plain array built inline, all ~600 possible <line> elements were
  // rebuilt and re-diffed on every render, including every cabinet drag frame.
  // useMemo keeps this array's identity (and contents) stable while dragging.
  const gridLines = useMemo(() => {
    const lines = []
    if (!showGrid) return lines
    const step = GRID * scale
    if (cvw / step <= 300 && cvh / step <= 300) {
      const gx0 = Math.floor(vx / step) * step
      const gy0 = Math.floor(vy / step) * step
      for (let x = gx0; x <= vx + cvw; x += step) {
        lines.push(<line key={'gx'+x} x1={x} y1={vy} x2={x} y2={vy + cvh} stroke="rgba(200,144,42,0.08)" strokeWidth={0.5} />)
      }
      for (let y = gy0; y <= vy + cvh; y += step) {
        lines.push(<line key={'gy'+y} x1={vx} y1={y} x2={vx + cvw} y2={y} stroke="rgba(200,144,42,0.08)" strokeWidth={0.5} />)
      }
    }
    return lines
  }, [showGrid, scale, vx, vy, cvw, cvh])

  const previewEnd = getPreviewEnd()
  const stairPreviewEnd = getStairPreviewEnd()
  const viewBox = `${vx} ${vy} ${cvw} ${cvh}`

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {!readOnly && !hideToolbar && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
          <button onClick={() => { setMode('select'); setStartPoint(null); setLockedLength(null); setLockedAngle(null); setInputVal(''); setInputMode(null); setSelected(null); setSelectedType(null); setMeasureStart(null); setMeasureEnd(null) }}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid', borderColor: mode === 'select' ? ACCENT : '#E0DAD4', background: mode === 'select' ? ACCENT+'18' : '#fff', color: mode === 'select' ? ACCENT : '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {t('roomCanvas.select')}
          </button>
          <button onClick={() => { setMode('draw'); setSelectedWall(null); setMeasureStart(null); setMeasureEnd(null) }}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid', borderColor: mode === 'draw' ? ACCENT : '#E0DAD4', background: mode === 'draw' ? ACCENT+'18' : '#fff', color: mode === 'draw' ? ACCENT : '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {t('roomCanvas.drawWalls')}
          </button>
          {!hideBacksplashTool && (
            <button onClick={() => { setMode('backsplash'); setStartPoint(null); setSelectedWall(null); setMeasureStart(null); setMeasureEnd(null) }}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid', borderColor: mode === 'backsplash' ? ACCENT : '#E0DAD4', background: mode === 'backsplash' ? ACCENT+'18' : '#fff', color: mode === 'backsplash' ? ACCENT : '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {t('roomCanvas.backsplashEdges')}
            </button>
          )}
          {!hideWallsElements && (
            <button onClick={() => { setMode('stair'); setStartPoint(null); setSelectedWall(null); setMeasureStart(null); setMeasureEnd(null) }}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid', borderColor: mode === 'stair' ? ACCENT : '#E0DAD4', background: mode === 'stair' ? ACCENT+'18' : '#fff', color: mode === 'stair' ? ACCENT : '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {t('roomCanvas.drawStair')}
            </button>
          )}
          <button onClick={() => { setMode('measure'); setStartPoint(null); setSelectedWall(null); setMeasureStart(null); setMeasureEnd(null) }}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid', borderColor: mode === 'measure' ? ACCENT : '#E0DAD4', background: mode === 'measure' ? ACCENT+'18' : '#fff', color: mode === 'measure' ? ACCENT : '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {t('roomCanvas.measure')}
          </button>
          <button onClick={undo} disabled={history.length <= 1}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1.5px solid #E0DAD4', background: '#fff', color: history.length <= 1 ? '#ccc' : '#555', fontSize: 14, cursor: history.length <= 1 ? 'not-allowed' : 'pointer' }}>
            ↩
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderLeft: '1px solid #E0DAD4', paddingLeft: 10 }}>
            <button onClick={() => zoomAt(W/2, H/2, 0.77)} style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid #E0DAD4', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>+</button>
            <span style={{ fontSize: 10, color: '#888', minWidth: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => zoomAt(W/2, H/2, 1.3)} style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid #E0DAD4', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>−</button>
            <button onClick={fitView} style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid #E0DAD4', background: '#fff', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>{t('roomCanvas.fit')}</button>
            {(selectedWall !== null || selected != null) && (
              <button onClick={zoomToSelection} style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid #E0DAD4', background: '#fff', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>{t('roomCanvas.zoomSelection')}</button>
            )}
          </div>
          {(mode === 'draw' || mode === 'stair') && startPoint && (
            <span style={{ fontSize: 11, color: '#555', background: '#f8f8f8', padding: '4px 10px', borderRadius: 6, border: '1px solid #eee' }}>
              {inputMode === 'length' ? t('roomCanvas.innerTabEnter', { val: inputVal })
               : inputMode === 'angle' ? t('roomCanvas.atEnter', { len: lockedLength, angle: inputVal })
               : t('roomCanvas.typeLengthHint')}
            </span>
          )}
          {mode === 'draw' && !startPoint && <span style={{ fontSize: 11, color: '#888' }}>{t('roomCanvas.clickToPlaceHint')}</span>}
          {mode === 'stair' && !startPoint && <span style={{ fontSize: 11, color: '#888' }}>{t('roomCanvas.stairClickHint')}</span>}
          {mode === 'backsplash' && <span style={{ fontSize: 11, color: '#888' }}>{t('roomCanvas.backsplashHint')}</span>}
          {mode === 'measure' && !measureStart && <span style={{ fontSize: 11, color: '#888' }}>{t('roomCanvas.measureHintStart')}</span>}
          {mode === 'measure' && measureStart && !measureEnd && <span style={{ fontSize: 11, color: '#888' }}>{t('roomCanvas.measureHintEnd')}</span>}
          {mode === 'measure' && measureStart && measureEnd && (
            <span style={{ fontSize: 11, color: '#555', background: '#f8f8f8', padding: '4px 10px', borderRadius: 6, border: '1px solid #eee' }}>
              {Math.round(ptDist(measureStart.x, measureStart.y, measureEnd.x, measureEnd.y) / scale)}mm · {t('roomCanvas.measureHintNext')}
            </span>
          )}
          {mode === 'select' && selectedWall !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderInlineStart: '1px solid #E0DAD4', paddingInlineStart: 10 }}>
              <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>{t('roomCanvas.wallThicknessLabel')}</span>
              <input type="range" min={50} max={300} step={10}
                value={getWallThickness(walls[selectedWall])}
                onChange={e => pushHistory(walls.map((w, i) => i === selectedWall ? { ...w, thickness: +e.target.value } : w))}
                style={{ width: 70, accentColor: ACCENT }} />
              <span style={{ fontSize: 11, color: ACCENT, fontWeight: 700, minWidth: 36 }}>{getWallThickness(walls[selectedWall])}mm</span>
              <span style={{ fontSize: 11, color: '#888', marginInlineStart: 6 }}>{t('roomCanvas.thicknessSide')}</span>
              {[['right', t('roomCanvas.thicknessSideRight')], ['left', t('roomCanvas.thicknessSideLeft')]].map(([side, label]) => (
                <button key={side}
                  onClick={() => pushHistory(walls.map((w, i) => i === selectedWall ? { ...w, thicknessSide: side } : w))}
                  style={{ padding: '4px 8px', borderRadius: 5, border: '1.5px solid', borderColor: (walls[selectedWall]?.thicknessSide || 'right') === side ? ACCENT : '#E0DAD4', background: (walls[selectedWall]?.thicknessSide || 'right') === side ? ACCENT + '18' : '#fff', color: (walls[selectedWall]?.thicknessSide || 'right') === side ? ACCENT : '#555', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
              <button onClick={() => pushHistory(walls.map((w, i) => i === selectedWall ? { ...w, thicknessSide: w.thicknessSide === 'left' ? 'right' : 'left' } : w))}
                title={t('roomCanvas.flipThicknessSide')}
                style={{ padding: '4px 8px', borderRadius: 5, border: '1.5px solid #E0DAD4', background: '#fff', color: '#555', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                {t('roomCanvas.flipThicknessSide')}
              </button>
            </div>
          )}
          {mode === 'select' && selectedWall !== null && (
            <button onClick={() => { pushHistory(walls.filter((_, i) => i !== selectedWall)); setSelectedWall(null) }}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#E74C3C', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {t('roomCanvas.deleteWall')}
            </button>
          )}
          {mode === 'select' && selectedWall === null && walls.length > 0 && (
            <button onClick={() => { pushHistory([]); setSelectedWall(null) }}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#E74C3C', fontSize: 12, cursor: 'pointer' }}>
              {t('roomCanvas.clearAll')}
            </button>
          )}
          {onToggleBulk && bulkCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderInlineStart: '1px solid #E0DAD4', paddingInlineStart: 12 }}>
              <span style={{ fontSize: 11, color: BULK_ACCENT, fontWeight: 700, background: BULK_ACCENT + '18', padding: '4px 8px', borderRadius: 6 }}>
                {t('roomCanvas.bulkSelectedCount', { count: bulkCount })}
              </span>
            </div>
          )}
          {selectedWall === null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginInlineStart: 4, borderInlineStart: '1px solid #E0DAD4', paddingInlineStart: 12 }}>
              <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>{t('roomCanvas.wall')}</span>
              <input type="range" min={50} max={300} step={10} value={wallThickness}
                onChange={e => {
                  const v = +e.target.value
                  setWallThickness(v)
                  if (walls.length > 0) pushHistory(walls.map(w => ({ ...w, thickness: v })))
                }}
                style={{ width: 70, accentColor: ACCENT }} />
              <span style={{ fontSize: 11, color: ACCENT, fontWeight: 700, minWidth: 36 }}>{wallThickness}mm</span>
            </div>
          )}
          {mode === 'select' && selected && selectedType === 'element' && (() => {
            const el = elements.find(e => e.id === selected)
            if (!el) return null
            const isWallEl = el.type === 'window' || el.type === 'door'
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderInlineStart: '1px solid #E0DAD4', paddingInlineStart: 12 }}>
                {!isWallEl && <>
                  <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>{t('roomCanvas.rot')}</span>
                  <input type="number" min={0} max={359} step={1} value={el.rotation || 0}
                    onChange={e => { const val = (+e.target.value + 360) % 360; setElements(p => p.map(el2 => el2.id === selected ? { ...el2, rotation: val } : el2)) }}
                    style={{ width: 52, padding: '4px 6px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 12, outline: 'none', textAlign: 'center' }} />
                  <span style={{ fontSize: 11, color: '#888' }}>°</span>
                </>}
                {el.embeddedInWall && <span style={{ fontSize: 11, color: '#2AC87A', fontWeight: 600 }}>{t('roomCanvas.inWall', { n: (el.wallIndex || 0) + 1 })}</span>}
              </div>
            )
          })()}
          {mode === 'select' && selected && selectedType === 'cabinet' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderInlineStart: '1px solid #E0DAD4', paddingInlineStart: 12 }}>
              <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>{t('roomCanvas.rot')}</span>
              <input type="number" min={0} max={359} step={1}
                value={cabinets.find(c => c.id === selected)?.rotation || 0}
                onChange={e => { const val = (+e.target.value + 360) % 360; setCabinets(p => p.map(c => c.id === selected ? { ...c, rotation: val } : c)) }}
                style={{ width: 52, padding: '4px 6px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 12, outline: 'none', textAlign: 'center' }} />
              <span style={{ fontSize: 11, color: '#888' }}>° <kbd style={{ background: '#f0f0f0', padding: '1px 4px', borderRadius: 3 }}>R</kbd></span>
            </div>
          )}
          {mode === 'select' && selected && selectedType === 'cabinet' && elements.some(el => (el.type === 'window' || el.type === 'door') && el.embeddedInWall) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderInlineStart: '1px solid #E0DAD4', paddingInlineStart: 12 }}>
              <button
                onClick={() => centerCabinetOnNearestOpening(selected)}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1.5px solid #E0DAD4', background: '#fff', color: '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {t('roomCanvas.centerOnOpening')}
              </button>
            </div>
          )}
          {mode === 'select' && selected && selectedType === 'cabinet' && cabinets.find(c => c.id === selected)?.subtype === 'Blind' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderInlineStart: '1px solid #E0DAD4', paddingInlineStart: 12 }}>
              <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>{t('roomCanvas.blindSide')}</span>
              <button
                onClick={() => setCabinets(p => p.map(c => c.id === selected ? { ...c, blindSide: c.blindSide === 'right' ? 'left' : 'right' } : c))}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1.5px solid #E0DAD4', background: '#fff', color: '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {(cabinets.find(c => c.id === selected)?.blindSide || 'left') === 'left' ? t('roomCanvas.blindLeftDoorRight') : t('roomCanvas.blindRightDoorLeft')}
              </button>
            </div>
          )}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={viewBox}
          preserveAspectRatio="xMinYMin meet"
          style={{ background: '#fff', border: '2px solid #2c3e50', borderRadius: 4, cursor: isPanningRef.current ? 'grabbing' : (mode === 'draw' || mode === 'stair') ? 'crosshair' : 'default', display: 'block' }}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={e => e.preventDefault()}
        >
          <defs>
            <pattern id="collisionHatch" patternUnits="userSpaceOnUse" width={8} height={8} patternTransform="rotate(45)">
              <rect width={8} height={8} fill="rgba(220,50,50,0.12)" />
              <line x1={0} y1={0} x2={0} y2={8} stroke="#DC3232" strokeWidth={2.5} />
            </pattern>
          </defs>
          {gridLines}
          <rect x={0} y={0} width={W} height={H} fill="none" stroke="#ddd" strokeWidth={1} strokeDasharray="4,4" />
          {showDimensions && <>
            <text x={W/2} y={-10} textAnchor="middle" fontSize={11} fill="#888" fontFamily="Inter,sans-serif" fontWeight={600}>{room.width}mm</text>
            <text x={-10} y={H/2} textAnchor="middle" fontSize={11} fill="#888" fontFamily="Inter,sans-serif" fontWeight={600} transform={`rotate(-90, -10, ${H/2})`}>{room.depth}mm</text>
          </>}
    {walls.map((w, i) => (
  <WallBody key={w.id || i} body={wallBodies[i]} index={i} selected={selectedWall === i}
              onSelect={hideWallsElements || mode === 'measure' ? () => {} : () => { wallClickedRef.current = true; setSelectedWall(i) }}
              onDragStart={hideToolbar ? () => {} : startWallDrag}
              onEndpointDragStart={hideToolbar ? () => {} : startEndpointDrag}
            />
          ))}
          {wallSnapPreview && <circle cx={wallSnapPreview.centerX} cy={wallSnapPreview.centerY} r={8} fill={ACCENT+'44'} stroke={ACCENT} strokeWidth={2} style={{ pointerEvents: 'none' }} />}
          {(mode === 'draw' || mode === 'stair') && endpointSnap && <circle cx={endpointSnap.x} cy={endpointSnap.y} r={10} fill="#2AC87A33" stroke="#2AC87A" strokeWidth={2} style={{ pointerEvents: 'none' }} />}
          {zoomBox && (() => {
            const bx = Math.min(zoomBox.x1, zoomBox.x2), by = Math.min(zoomBox.y1, zoomBox.y2)
            const bw = Math.abs(zoomBox.x2 - zoomBox.x1), bh = Math.abs(zoomBox.y2 - zoomBox.y1)
            return <rect x={bx} y={by} width={bw} height={bh} fill={ACCENT + '18'} stroke={ACCENT} strokeWidth={1.5} strokeDasharray="6,4" style={{ pointerEvents: 'none' }} />
          })()}
          {mode === 'draw' && startPoint && previewEnd && previewEnd.lengthMm > 0 && (
            <>
              <line x1={startPoint.x} y1={startPoint.y} x2={previewEnd.x} y2={previewEnd.y}
                stroke={ACCENT} strokeWidth={wallThickness * scale} strokeLinecap="square" opacity={0.3} style={{ pointerEvents: 'none' }} />
              <g transform={`translate(${(startPoint.x+previewEnd.x)/2},${(startPoint.y+previewEnd.y)/2})`}>
                <rect x={-36} y={-13} width={72} height={20} rx={4} fill={ACCENT} opacity={0.9} />
                <text x={0} y={3} textAnchor="middle" fontSize={10} fill="#fff" fontFamily="Inter,sans-serif" fontWeight={700}>{previewEnd.lengthMm}mm · {previewEnd.angleDeg}°</text>
              </g>
              <circle cx={previewEnd.x} cy={previewEnd.y} r={5} fill={previewEnd.snapped ? '#2AC87A' : ACCENT} stroke="#fff" strokeWidth={2} style={{ pointerEvents: 'none' }} />
            </>
          )}
          {mode === 'stair' && startPoint && stairPreviewEnd && (stairPreviewEnd.isWinder || stairPreviewEnd.lengthMm > 0) && (() => {
            const draft = buildStairFromDraft(startPoint, stairPreviewEnd)
            const mx = (startPoint.x + stairPreviewEnd.x) / 2, my = (startPoint.y + stairPreviewEnd.y) / 2
            const label = stairPreviewEnd.isWinder
              ? `${stairPreviewEnd.stepsBeforeTurn} treads · turn ${stairPreviewEnd.turnDirection}`
              : `${stairPreviewEnd.lengthMm}mm · ${stairPreviewEnd.angleDeg}°`
            return (
              <>
                <g opacity={0.6}><StairShape2D stair={draft} scale={scale} selected onMouseDown={() => {}} /></g>
                <line x1={startPoint.x} y1={startPoint.y} x2={stairPreviewEnd.x} y2={stairPreviewEnd.y}
                  stroke={ACCENT} strokeWidth={1.5} strokeDasharray="6,4" style={{ pointerEvents: 'none' }} />
                <g transform={`translate(${mx},${my})`}>
                  <rect x={-56} y={-13} width={112} height={20} rx={4} fill={ACCENT} opacity={0.9} />
                  <text x={0} y={3} textAnchor="middle" fontSize={10} fill="#fff" fontFamily="Inter,sans-serif" fontWeight={700}>{label}</text>
                </g>
                <circle cx={stairPreviewEnd.x} cy={stairPreviewEnd.y} r={5} fill={stairPreviewEnd.snapped ? '#2AC87A' : ACCENT} stroke="#fff" strokeWidth={2} style={{ pointerEvents: 'none' }} />
              </>
            )
          })()}
          {mode === 'draw' && startPoint && <circle cx={startPoint.x} cy={startPoint.y} r={7} fill="#2AC87A" stroke="#fff" strokeWidth={2} style={{ pointerEvents: 'none' }} />}
          {mode === 'stair' && startPoint && <circle cx={startPoint.x} cy={startPoint.y} r={7} fill="#2AC87A" stroke="#fff" strokeWidth={2} style={{ pointerEvents: 'none' }} />}
          {stairs.map(st => (
            <StairShape2D key={st.id} stair={st} scale={scale}
              selected={selected === st.id && selectedType === 'stair'}
              onMouseDown={e => startElementDrag(e, st.id, 'stair')} />
          ))}
          {elements.filter(el => el.type !== 'window' && el.type !== 'door').map(el => {
            const x = el.x * scale, y = el.y * scale, w = el.w * scale, h = el.h * scale
            const rot = el.rotation || 0, isSelected = selected === el.id && selectedType === 'element'
            return (
              <g key={el.id} transform={`translate(${x},${y}) rotate(${rot})`}
                onMouseDown={e => startElementDrag(e, el.id, 'element')}
                style={{ cursor: 'move' }}>
                <rect x={-w/2} y={-h/2} width={w} height={h} fill={el.color+'44'} stroke={isSelected ? ACCENT : el.color} strokeWidth={isSelected ? 2.5 : 1.5} rx={3} />
                <text x={0} y={2} textAnchor="middle" fontSize={13} style={{ userSelect: 'none', pointerEvents: 'none' }}>{el.icon}</text>
                {isSelected && <rect x={-w/2-2} y={-h/2-2} width={w+4} height={h+4} fill="none" stroke={ACCENT} strokeWidth={1.5} strokeDasharray="4,3" rx={4} style={{ pointerEvents: 'none' }} />}
              </g>
            )
          })}
          {elements.filter(el => el.type === 'window' || el.type === 'door').map(el => (
            <EmbeddedElement key={el.id} el={el} scale={scale}
              selected={selected === el.id && selectedType === 'element'}
              onMouseDown={e => startElementDrag(e, el.id, 'element')} />
          ))}
          {[...cabinets.filter(c => c.category !== 'wall'), ...cabinets.filter(c => c.category === 'wall')].map(cab => (
            <CabinetShape2D
              key={cab.id}
              cab={cab}
              isSelected={selected === cab.id && selectedType === 'cabinet'}
              isBulkSelected={bulkIds.has(cab.id)}
              isColliding={collidingIds.has(cab.id)}
              scale={scale}
              showDimensions={showDimensions}
              onMouseDown={handleCabinetMouseDown}
            />
          ))}
          {backsplashSegments.map(seg => {
            const isSelBs = selected === seg.id && selectedType === 'backsplash'
            return (
              <g key={seg.id}>
                {/* No click handler here on purpose — segments are only ever
                    selectable through the Backsplash Edges tool (handleCanvasClick),
                    never by clicking directly in Select mode. */}
                <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                  stroke="#fff" strokeWidth={isSelBs ? 9 : 7.5}
                  strokeLinecap="round" style={{ pointerEvents: 'none' }} />
                <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                  stroke={isSelBs ? ACCENT : '#8B5E3C'} strokeWidth={isSelBs ? 6 : 5}
                  strokeLinecap="round" style={{ pointerEvents: 'none' }} />
              </g>
            )
          })}
          {mode === 'backsplash' && mousePos && (() => {
            const hit = findNearestCabinetEdge(mousePos.x, mousePos.y, cabinets, scale, 8 / zoom)
            if (!hit) return null
            const alreadyActive = backsplashSegments.some(s => s.id === `cabedge-${hit.cab.id}-${hit.side}`)
            return (
              <>
                <line x1={hit.edge.x1} y1={hit.edge.y1} x2={hit.edge.x2} y2={hit.edge.y2}
                  stroke="#fff" strokeWidth={10} strokeLinecap="round" opacity={0.9} style={{ pointerEvents: 'none' }} />
                <line x1={hit.edge.x1} y1={hit.edge.y1} x2={hit.edge.x2} y2={hit.edge.y2}
                  stroke={alreadyActive ? '#3B82F6' : ACCENT} strokeWidth={7} strokeLinecap="round"
                  opacity={0.9} style={{ pointerEvents: 'none' }} />
              </>
            )
          })()}
          {walls.map((w, i) => (
            <WallLabel key={`label-${w.id || i}`} body={wallBodies[i]} selected={selectedWall === i}
              lengthMm={Math.round(getWallLength(w) / scale)}
              onLabelClick={() => {
                if (hideToolbar) return
                setSelectedWall(i); setEditingWall(i)
                setEditingLenVal(Math.round(getWallLength(w) / scale))
                setEditingAngleVal(Math.round(radToDeg(Math.atan2(w.y2 - w.y1, w.x2 - w.x1))))
              }}
              editingLength={!hideToolbar && editingWall === i}
              onLengthChange={v => setEditingLenVal(v)}
              editingAngleVal={editingAngleVal}
              onAngleChange={v => setEditingAngleVal(v)}
              onLengthConfirm={confirmWallEdit}
            />
          ))}
          {mode === 'measure' && measureSnap && <circle cx={measureSnap.x} cy={measureSnap.y} r={10} fill="#3B82F633" stroke="#3B82F6" strokeWidth={2} style={{ pointerEvents: 'none' }} />}
          {mode === 'measure' && measureStart && !measureEnd && mousePos && (() => {
            const end = measureSnap || mousePos
            const distMm = Math.round(ptDist(measureStart.x, measureStart.y, end.x, end.y) / scale)
            const mx = (measureStart.x + end.x) / 2, my = (measureStart.y + end.y) / 2
            return (
              <>
                <line x1={measureStart.x} y1={measureStart.y} x2={end.x} y2={end.y}
                  stroke="#3B82F6" strokeWidth={2} strokeDasharray="6,4" style={{ pointerEvents: 'none' }} />
                <g transform={`translate(${mx},${my})`} style={{ pointerEvents: 'none' }}>
                  <rect x={-32} y={-13} width={64} height={20} rx={4} fill="#3B82F6" opacity={0.9} />
                  <text x={0} y={3} textAnchor="middle" fontSize={10} fill="#fff" fontFamily="Inter,sans-serif" fontWeight={700}>{distMm}mm</text>
                </g>
                <circle cx={end.x} cy={end.y} r={5} fill="#3B82F6" stroke="#fff" strokeWidth={2} style={{ pointerEvents: 'none' }} />
              </>
            )
          })()}
          {mode === 'measure' && measureStart && measureEnd && (() => {
            const distMm = Math.round(ptDist(measureStart.x, measureStart.y, measureEnd.x, measureEnd.y) / scale)
            const mx = (measureStart.x + measureEnd.x) / 2, my = (measureStart.y + measureEnd.y) / 2
            return (
              <>
                <line x1={measureStart.x} y1={measureStart.y} x2={measureEnd.x} y2={measureEnd.y}
                  stroke="#3B82F6" strokeWidth={2} strokeDasharray="6,4" style={{ pointerEvents: 'none' }} />
                <g transform={`translate(${mx},${my})`} style={{ pointerEvents: 'none' }}>
                  <rect x={-32} y={-13} width={64} height={20} rx={4} fill="#3B82F6" />
                  <text x={0} y={3} textAnchor="middle" fontSize={10} fill="#fff" fontFamily="Inter,sans-serif" fontWeight={700}>{distMm}mm</text>
                </g>
                <circle cx={measureEnd.x} cy={measureEnd.y} r={5} fill="#3B82F6" stroke="#fff" strokeWidth={2} style={{ pointerEvents: 'none' }} />
              </>
            )
          })()}
          {mode === 'measure' && measureStart && <circle cx={measureStart.x} cy={measureStart.y} r={7} fill="#3B82F6" stroke="#fff" strokeWidth={2} style={{ pointerEvents: 'none' }} />}
        </svg>
      </div>
    </div>
  )
}
