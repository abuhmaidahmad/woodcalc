import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { BLIND_PANEL_WIDTH } from './formulaEngine'

const ACCENT = '#C8902A'
const GRID = 50
const ENDPOINT_SNAP_DIST = 15

const snap = v => Math.round(v / GRID) * GRID
const degToRad = d => d * Math.PI / 180
const radToDeg = r => r * 180 / Math.PI
const ptDist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by)

function getWindingDirection(walls) {
  if (walls.length < 3) return 1
  let sum = 0
  walls.forEach(w => { sum += (w.x2 - w.x1) * (w.y2 + w.y1) })
  return sum > 0 ? 1 : -1
}

function getInnerNormal(wall, winding) {
  const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1
  const len = Math.hypot(dx, dy)
  if (len === 0) return { nx: 0, ny: 0 }
  return { nx: (dy / len) * winding, ny: (-dx / len) * winding }
}

function getInnerLength(wall, wallThickness, scale) {
  const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1)
  const halfT = (wallThickness * scale) / 2
  return Math.max(0, Math.round((len - halfT * 2) / scale))
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

function WallSegment({ wall, index, selected, thickness, scale, winding, onSelect, onDragStart, onEndpointDragStart, onLabelClick, editingLength, onLengthChange, onLengthConfirm, innerLenMm, outerLenMm }) {
  const { x1, y1, x2, y2 } = wall
  const angle = radToDeg(Math.atan2(y2 - y1, x2 - x1))
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2
  const { nx, ny } = getInnerNormal(wall, winding)
  const labelX = cx + nx * thickness * 0.7
  const labelY = cy + ny * thickness * 0.7
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent"
        strokeWidth={Math.max(thickness + 12, 20)} strokeLinecap="square"
        onMouseDown={e => { e.stopPropagation(); onSelect(); onDragStart(e, index) }}
        style={{ cursor: 'move' }} />
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={selected ? ACCENT : '#2c3e50'} strokeWidth={thickness}
        strokeLinecap="square" style={{ pointerEvents: 'none' }} />
      {winding !== 0 && (() => {
        const halfT = thickness / 2
        return <line x1={x1 + nx * halfT} y1={y1 + ny * halfT}
          x2={x2 + nx * halfT} y2={y2 + ny * halfT}
          stroke={selected ? ACCENT + '88' : '#88888855'} strokeWidth={1}
          strokeDasharray="4,3" style={{ pointerEvents: 'none' }} />
      })()}
      <g transform={`translate(${labelX},${labelY}) rotate(${angle})`}
        onClick={e => { e.stopPropagation(); onLabelClick() }}
        style={{ cursor: 'text' }}>
        <rect x={-30} y={-11} width={60} height={18} rx={4}
          fill={selected ? ACCENT : 'white'} stroke={selected ? ACCENT : '#ddd'} strokeWidth={1} />
        {editingLength ? (
          <foreignObject x={-28} y={-10} width={56} height={16}>
            <input autoFocus type="number" defaultValue={innerLenMm}
              onChange={e => onLengthChange(+e.target.value)}
              onBlur={onLengthConfirm}
              onKeyDown={e => { if (e.key === 'Enter') onLengthConfirm(); e.stopPropagation() }}
              style={{ width: '100%', border: 'none', outline: 'none', fontSize: 9, textAlign: 'center', background: 'transparent', color: selected ? '#fff' : '#333', fontFamily: 'Inter,sans-serif', fontWeight: 600 }} />
          </foreignObject>
        ) : (
   <text x={0} y={3} textAnchor="middle" fontSize={9}
  fill={selected ? '#fff' : '#555'} fontFamily="Inter,sans-serif" fontWeight={600}>
  {winding !== 0 ? innerLenMm : outerLenMm}mm
</text>

        )}
      </g>
      {selected && [{ x: x1, y: y1, ep: 0 }, { x: x2, y: y2, ep: 1 }].map(({ x, y, ep }) => (
        <g key={ep} onMouseDown={e => { e.stopPropagation(); onEndpointDragStart(e, index, ep) }} style={{ cursor: 'crosshair' }}>
          <circle cx={x} cy={y} r={10} fill="transparent" />
          <circle cx={x} cy={y} r={5} fill="#fff" stroke={ACCENT} strokeWidth={2.5} />
        </g>
      ))}
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

export default function RoomCanvas({
  room, scale, showGrid, showDimensions,
  elements, setElements, cabinets, setCabinets,
  selected, setSelected, selectedType, setSelectedType,
  wallThickness, setWallThickness,
  walls, setWalls,
  readOnly,
  hideToolbar,
}) {
  const [mode, setMode] = useState('select')
  const [startPoint, setStartPoint] = useState(null)
  const [mousePos, setMousePos] = useState(null)
  const [endpointSnap, setEndpointSnap] = useState(null)
  const [selectedWall, setSelectedWall] = useState(null)
  const [editingWall, setEditingWall] = useState(null)
  const [editingLenVal, setEditingLenVal] = useState(null)
  const [inputVal, setInputVal] = useState('')
  const [inputMode, setInputMode] = useState(null)
  const [lockedLength, setLockedLength] = useState(null)
  const [lockedAngle, setLockedAngle] = useState(null)
  const [history, setHistory] = useState([[]])
  const [dragging, setDragging] = useState(null)
  const [dragStart, setDragStart] = useState(null)
  const [dragCorner, setDragCorner] = useState(null)
  const [wallSnapPreview, setWallSnapPreview] = useState(null)
  const [flipWinding, setFlipWinding] = useState(1)

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
  const wallClickedRef = useRef(false)
  const svgRef = useRef(null)

  useEffect(() => { if (hideToolbar) setMode('select') }, [hideToolbar])

  const W = room.width * scale
  const H = room.depth * scale
  const wallPx = wallThickness * scale
  const winding = getWindingDirection(walls) * flipWinding

  const cvw = vw ?? W
  const cvh = vh ?? H
  const zoom = W / cvw

  // Keep refs in sync
  vwRef.current = cvw
  vhRef.current = cvh

  // THE KEY FIX: use browser-native SVG matrix to convert screen → SVG coords
  // This automatically handles preserveAspectRatio letterboxing, zoom, pan, CSS transforms
  const getSVGPos = useCallback((e) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse())
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
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse())
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

  const pushHistory = useCallback((newWalls) => {
    setHistory(h => [...h.slice(-20), newWalls])
    setWalls(newWalls)
  }, [setWalls])

  const undo = useCallback(() => {
    setHistory(h => {
      if (h.length <= 1) return h
      const prev = h[h.length - 2]
      setWalls(prev)
      return h.slice(0, -1)
    })
  }, [setWalls])

  const snapThreshold = ENDPOINT_SNAP_DIST * 2 / zoom

  const getPreviewEnd = useCallback(() => {
    if (!startPoint || !mousePos) return null
    const snapPt = findNearestEndpoint(mousePos.x, mousePos.y, walls, -1, snapThreshold)
    if (snapPt && !lockedLength && !lockedAngle) {
      const len = ptDist(startPoint.x, startPoint.y, snapPt.x, snapPt.y)
      const halfT = (wallThickness * scale) / 2
      return { x: snapPt.x, y: snapPt.y, innerLenMm: Math.max(0, Math.round((len - halfT * 2) / scale)), angleDeg: Math.round(radToDeg(Math.atan2(snapPt.y - startPoint.y, snapPt.x - startPoint.x))), snapped: true }
    }
    let angle, length
    if (lockedLength !== null && lockedAngle !== null) {
      angle = degToRad(lockedAngle); length = (lockedLength + wallThickness) * scale
    } else if (lockedLength !== null) {
      angle = Math.atan2(mousePos.y - startPoint.y, mousePos.x - startPoint.x)
      length = (lockedLength + wallThickness) * scale
    } else if (lockedAngle !== null) {
      angle = degToRad(lockedAngle)
      length = ptDist(startPoint.x, startPoint.y, mousePos.x, mousePos.y)
    } else {
      angle = Math.atan2(mousePos.y - startPoint.y, mousePos.x - startPoint.x)
      length = ptDist(startPoint.x, startPoint.y, mousePos.x, mousePos.y)
    }
    const halfT = (wallThickness * scale) / 2
    return { x: startPoint.x + length * Math.cos(angle), y: startPoint.y + length * Math.sin(angle), innerLenMm: Math.max(0, Math.round((length - halfT * 2) / scale)), angleDeg: Math.round(radToDeg(angle)), snapped: false }
  }, [startPoint, mousePos, walls, lockedLength, lockedAngle, wallThickness, scale, snapThreshold])

  useEffect(() => {
    if (mode !== 'draw') return
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return
      if (e.key === 'Escape') {
        if (startPoint) { setStartPoint(null); setLockedLength(null); setLockedAngle(null); setInputVal(''); setInputMode(null) }
        else setMode('select')
        return
      }
      if (e.key === 'Enter') {
        const end = getPreviewEnd()
        if (end && startPoint && end.innerLenMm > 0) {
          pushHistory([...walls, { x1: startPoint.x, y1: startPoint.y, x2: end.x, y2: end.y }])
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
  }, [mode, startPoint, inputMode, inputVal, getPreviewEnd, walls, pushHistory])

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
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selected != null) {
        e.preventDefault()
        const step = e.shiftKey ? 1 : 10 // mm
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        if (selectedType === 'cabinet') setCabinets(p => p.map(c => c.id === selected ? { ...c, x: c.x + dx, y: c.y + dy } : c))
        else if (selectedType === 'element') setElements(p => p.map(el => el.id === selected ? { ...el, x: el.x + dx, y: el.y + dy } : el))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mode, selected, selectedType, selectedWall, walls, pushHistory, undo, setCabinets, setElements])

  const handleCanvasClick = useCallback((e) => {
    if (isPanningRef.current) return
    if (wallClickedRef.current) { wallClickedRef.current = false; return }
    if (e.target !== svgRef.current && e.target.tagName !== 'svg') return
    if (mode === 'select') {
      setSelectedWall(null); setSelected(null); setSelectedType(null); return
    }
    const pos = getSVGPos(e)
    const snapPt = findNearestEndpoint(pos.x, pos.y, walls, -1, snapThreshold)
    const finalPos = snapPt || pos
    if (!startPoint) { setStartPoint(finalPos); return }
    const end = getPreviewEnd()
    if (end && end.innerLenMm > 0) {
      pushHistory([...walls, { x1: startPoint.x, y1: startPoint.y, x2: end.x, y2: end.y }])
      setStartPoint({ x: end.x, y: end.y })
      setLockedLength(null); setLockedAngle(null); setInputVal(''); setInputMode(null)
    }
  }, [mode, startPoint, getPreviewEnd, getSVGPos, walls, pushHistory, setSelected, setSelectedType, snapThreshold])

  const handleMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault()
      isPanningRef.current = true
      panLastRef.current = { x: e.clientX, y: e.clientY }
    }
  }, [])

  const handleMouseMove = useCallback((e) => {
    // Pan using screen coord delta
    if (isPanningRef.current && panLastRef.current) {
      const _cvw = vwRef.current
      const _cvh = vhRef.current
      const rect = svgRef.current?.getBoundingClientRect()
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
    setMousePos({ x: rawX, y: rawY })
    if (mode === 'draw' && startPoint) setEndpointSnap(findNearestEndpoint(rawX, rawY, walls, -1, snapThreshold))
    if (!dragging) return

    if (dragging.type === 'wall') {
      const dx = rawX - dragStart.x, dy = rawY - dragStart.y
      const orig = dragging.origWall
      const nx1 = orig.x1 + dx, ny1 = orig.y1 + dy, nx2 = orig.x2 + dx, ny2 = orig.y2 + dy
      const s1 = findNearestEndpoint(nx1, ny1, walls, dragging.index, snapThreshold)
      const s2 = findNearestEndpoint(nx2, ny2, walls, dragging.index, snapThreshold)
      let fx1 = nx1, fy1 = ny1, fx2 = nx2, fy2 = ny2
      if (s1) { fx2 += s1.x - nx1; fy2 += s1.y - ny1; fx1 = s1.x; fy1 = s1.y }
      else if (s2) { fx1 += s2.x - nx2; fy1 += s2.y - ny2; fx2 = s2.x; fy2 = s2.y }
      setWalls(p => p.map((w, i) => i === dragging.index ? { x1: fx1, y1: fy1, x2: fx2, y2: fy2 } : w))
    } else if (dragging.type === 'endpoint') {
      const snapPt = findNearestEndpoint(rawX, rawY, walls, dragging.wallIndex, snapThreshold)
      const fx = snapPt ? snapPt.x : rawX, fy = snapPt ? snapPt.y : rawY
      setWalls(p => p.map((w, i) => i !== dragging.wallIndex ? w : dragging.ep === 0 ? { ...w, x1: fx, y1: fy } : { ...w, x2: fx, y2: fy }))
    } else if (dragging.type === 'element') {
      const item = elements.find(el => el.id === dragging.id)
      if (!item) return
      const wallSnap = findWallSnap(rawX, rawY, walls, wallThickness, scale, 40 / zoom)
      if (wallSnap && (item.type === 'window' || item.type === 'door')) {
        setWallSnapPreview(wallSnap)
        setElements(p => p.map(el => el.id === dragging.id ? {
          ...el, x: wallSnap.centerX / scale, y: wallSnap.centerY / scale,
          wallAngle: wallSnap.wallAngle, wallThickness, embeddedInWall: true, wallIndex: wallSnap.wallIndex,
        } : el))
      } else {
        setWallSnapPreview(null)
        const corner = dragCorner || { ox: 0.5, oy: 0.5 }
        const itemW = item.w * scale, itemH = item.h * scale
        const x = Math.max(0, snap((rawX - (corner.ox - 0.5) * itemW) / scale))
        const y = Math.max(0, snap((rawY - (corner.oy - 0.5) * itemH) / scale))
        setElements(p => p.map(el => el.id === dragging.id ? { ...el, x, y, wallAngle: undefined, embeddedInWall: false } : el))
      }
    } else if (dragging.type === 'cabinet') {
      const cab = cabinets.find(c => c.id === dragging.id)
      if (!cab) return
      const SNAP_PX = 15 / zoom
      const rawCabX = rawX - cab.width * scale / 2
      const rawCabY = rawY - cab.depth * scale / 2
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
        const halfT = wallThickness * scale / 2
        const ccx = rawCabX + cabWpx / 2
        const ccy = rawCabY + cabDpx / 2
        const t = Math.max(0, Math.min(1, ((ccx - w.x1) * ux + (ccy - w.y1) * uy) / len))
        const projX = w.x1 + t * dx, projY = w.y1 + t * dy
        const distToWall = (ccx - projX) * nx + (ccy - projY) * ny
        const backFaceDist = Math.abs(Math.abs(distToWall) - (halfT + cabDpx / 2))
        if (backFaceDist < SNAP_PX) {
          const sign = distToWall >= 0 ? 1 : -1
          const snapCCX = projX + nx * sign * (halfT + cabDpx / 2)
          const snapCCY = projY + ny * sign * (halfT + cabDpx / 2)
          if (!snappedX) { finalX = snapCCX - cabWpx / 2; snappedX = true }
          if (!snappedY) { finalY = snapCCY - cabDpx / 2; snappedY = true }
        }
      })

      if (!snappedX) finalX = Math.round(rawCabX / (GRID * scale)) * (GRID * scale)
      if (!snappedY) finalY = Math.round(rawCabY / (GRID * scale)) * (GRID * scale)
      setCabinets(p => p.map(c => c.id === dragging.id ? { ...c, x: finalX / scale, y: finalY / scale } : c))
    }
  }, [dragging, dragStart, dragCorner, mode, startPoint, walls, wallThickness, scale, elements, cabinets, setWalls, setCabinets, setElements, getSVGPos, snapThreshold, zoom])

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false
    panLastRef.current = null
    if (dragging && (dragging.type === 'wall' || dragging.type === 'endpoint')) setHistory(h => [...h.slice(-20), walls])
    setDragging(null); setDragStart(null); setDragCorner(null); setWallSnapPreview(null)
  }, [dragging, walls])

  const startWallDrag = useCallback((e, index) => {
    if (mode !== 'select') return
    e.stopPropagation()
    wallClickedRef.current = true
    setDragging({ type: 'wall', index, origWall: { ...walls[index] } })
    setDragStart(getSVGPos(e))
  }, [mode, walls, getSVGPos])

  const startEndpointDrag = useCallback((e, wallIndex, ep) => {
    if (mode !== 'select') return
    e.stopPropagation()
    setDragging({ type: 'endpoint', wallIndex, ep })
    setDragStart(getSVGPos(e))
  }, [mode, getSVGPos])

  const startElementDrag = useCallback((e, id, type) => {
    e.stopPropagation()
    const pos = getSVGPos(e)
    const item = type === 'cabinet' ? cabinets.find(c => c.id === id) : elements.find(el => el.id === id)
    if (!item) return
    setDragging({ type, id })
    setDragStart(pos)
    setDragCorner({ ox: 0.5, oy: 0.5 })
    setSelected(id)
    setSelectedType(type)
  }, [cabinets, elements, getSVGPos, setSelected, setSelectedType])

  const confirmWallEdit = useCallback(() => {
    if (editingWall === null || !editingLenVal || editingLenVal <= 0) { setEditingWall(null); return }
    pushHistory(walls.map((w, i) => {
      if (i !== editingWall) return w
      const angle = Math.atan2(w.y2 - w.y1, w.x2 - w.x1)
      const outerLen = (editingLenVal + wallThickness) * scale
      return { ...w, x2: w.x1 + outerLen * Math.cos(angle), y2: w.y1 + outerLen * Math.sin(angle) }
    }))
    setEditingWall(null); setEditingLenVal(null)
  }, [editingWall, editingLenVal, walls, wallThickness, scale, pushHistory])

  // ---- Collision detection: overlapping footprint AND overlapping elevation range ----
  const getCabCorners = (cab) => {
    const x = cab.x, y = cab.y, w = cab.width, h = cab.depth
    const cx = x + w / 2, cy = y + h / 2
    const rad = ((cab.rotation || 0) * Math.PI) / 180
    const cos = Math.cos(rad), sin = Math.sin(rad)
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) => [
      cx + (px - cx) * cos - (py - cy) * sin,
      cy + (px - cx) * sin + (py - cy) * cos,
    ])
  }
  const getCabElevRange = (cab) => {
    if (cab.category === 'wall') {
      const bottom = cab.elevation ?? 1450
      return [bottom, bottom + (cab.height || 0)]
    }
    return [0, cab.height || 0]
  }
  const rangesOverlap = (a, b) => a[0] < b[1] && b[0] < a[1]
  const polyAxes = (poly) => {
    const axes = []
    for (let i = 0; i < 2; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[i + 1]
      axes.push([-(y2 - y1), x2 - x1])
    }
    return axes
  }
  const project = (poly, axis) => {
    let min = Infinity, max = -Infinity
    poly.forEach(([x, y]) => {
      const d = x * axis[0] + y * axis[1]
      if (d < min) min = d
      if (d > max) max = d
    })
    return [min, max]
  }
  const polysIntersect = (polyA, polyB) => {
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
  const collidingIds = useMemo(() => {
    const ids = new Set()
    for (let i = 0; i < cabinets.length; i++) {
      for (let j = i + 1; j < cabinets.length; j++) {
        const a = cabinets[i], b = cabinets[j]
        if (!rangesOverlap(getCabElevRange(a), getCabElevRange(b))) continue
        if (polysIntersect(getCabCorners(a), getCabCorners(b))) { ids.add(a.id); ids.add(b.id) }
      }
    }
    return ids
  }, [cabinets])

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
    const pad = Math.max((maxX - minX), (maxY - minY)) * 0.08 || 50
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
  }

  const gridLines = []
  if (showGrid) {
    const step = GRID * scale
    if (cvw / step <= 300 && cvh / step <= 300) {
      const gx0 = Math.floor(vx / step) * step
      const gy0 = Math.floor(vy / step) * step
      for (let x = gx0; x <= vx + cvw; x += step) {
        gridLines.push(<line key={'gx'+x} x1={x} y1={vy} x2={x} y2={vy + cvh} stroke="rgba(200,144,42,0.08)" strokeWidth={0.5} />)
      }
      for (let y = gy0; y <= vy + cvh; y += step) {
        gridLines.push(<line key={'gy'+y} x1={vx} y1={y} x2={vx + cvw} y2={y} stroke="rgba(200,144,42,0.08)" strokeWidth={0.5} />)
      }
    }
  }

  const previewEnd = getPreviewEnd()
  const viewBox = `${vx} ${vy} ${cvw} ${cvh}`

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {!readOnly && !hideToolbar && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
          <button onClick={() => { setMode('select'); setStartPoint(null); setLockedLength(null); setLockedAngle(null); setInputVal(''); setInputMode(null) }}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid', borderColor: mode === 'select' ? ACCENT : '#E0DAD4', background: mode === 'select' ? ACCENT+'18' : '#fff', color: mode === 'select' ? ACCENT : '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ↖ Select
          </button>
          <button onClick={() => { setMode('draw'); setSelectedWall(null) }}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid', borderColor: mode === 'draw' ? ACCENT : '#E0DAD4', background: mode === 'draw' ? ACCENT+'18' : '#fff', color: mode === 'draw' ? ACCENT : '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ✏️ Draw walls
          </button>
          <button onClick={undo} disabled={history.length <= 1}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1.5px solid #E0DAD4', background: '#fff', color: history.length <= 1 ? '#ccc' : '#555', fontSize: 14, cursor: history.length <= 1 ? 'not-allowed' : 'pointer' }}>
            ↩
          </button>
          {walls.length > 1 && (
            <button onClick={() => setFlipWinding(f => -f)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1.5px solid #E0DAD4', background: '#fff', color: '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ⇄ Flip sides
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderLeft: '1px solid #E0DAD4', paddingLeft: 10 }}>
            <button onClick={() => zoomAt(W/2, H/2, 0.77)} style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid #E0DAD4', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>+</button>
            <span style={{ fontSize: 10, color: '#888', minWidth: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => zoomAt(W/2, H/2, 1.3)} style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid #E0DAD4', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>−</button>
            <button onClick={fitView} style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid #E0DAD4', background: '#fff', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>Fit</button>
          </div>
          {mode === 'draw' && startPoint && (
            <span style={{ fontSize: 11, color: '#555', background: '#f8f8f8', padding: '4px 10px', borderRadius: 6, border: '1px solid #eee' }}>
              {inputMode === 'length' ? <><strong style={{ color: ACCENT }}>{inputVal}mm</strong> inner · Tab→° · Enter</>
               : inputMode === 'angle' ? <><strong>{lockedLength}mm</strong> @ <strong style={{ color: ACCENT }}>{inputVal}°</strong> · Enter</>
               : <>Type length · Tab angle · Enter · Esc cancel · Alt+drag to pan</>}
            </span>
          )}
          {mode === 'draw' && !startPoint && <span style={{ fontSize: 11, color: '#888' }}>Click to place · Scroll to zoom · Alt+drag to pan</span>}
          {mode === 'select' && selectedWall !== null && (
            <button onClick={() => { pushHistory(walls.filter((_, i) => i !== selectedWall)); setSelectedWall(null) }}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#E74C3C', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              🗑 Delete wall
            </button>
          )}
          {mode === 'select' && selectedWall === null && walls.length > 0 && (
            <button onClick={() => { pushHistory([]); setSelectedWall(null) }}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#E74C3C', fontSize: 12, cursor: 'pointer' }}>
              Clear all
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4, borderLeft: '1px solid #E0DAD4', paddingLeft: 12 }}>
            <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>Wall</span>
            <input type="range" min={50} max={300} step={10} value={wallThickness} onChange={e => setWallThickness(+e.target.value)} style={{ width: 70, accentColor: ACCENT }} />
            <span style={{ fontSize: 11, color: ACCENT, fontWeight: 700, minWidth: 36 }}>{wallThickness}mm</span>
          </div>
          {mode === 'select' && selected && selectedType === 'element' && (() => {
            const el = elements.find(e => e.id === selected)
            if (!el) return null
            const isWallEl = el.type === 'window' || el.type === 'door'
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderLeft: '1px solid #E0DAD4', paddingLeft: 12 }}>
                {!isWallEl && <>
                  <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>Rot</span>
                  <input type="number" min={0} max={359} step={1} value={el.rotation || 0}
                    onChange={e => { const val = (+e.target.value + 360) % 360; setElements(p => p.map(el2 => el2.id === selected ? { ...el2, rotation: val } : el2)) }}
                    style={{ width: 52, padding: '4px 6px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 12, outline: 'none', textAlign: 'center' }} />
                  <span style={{ fontSize: 11, color: '#888' }}>°</span>
                </>}
                {isWallEl && el.embeddedInWall && <span style={{ fontSize: 11, color: '#2AC87A', fontWeight: 600 }}>✓ In wall {(el.wallIndex || 0) + 1}</span>}
              </div>
            )
          })()}
          {mode === 'select' && selected && selectedType === 'cabinet' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderLeft: '1px solid #E0DAD4', paddingLeft: 12 }}>
              <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>Rot</span>
              <input type="number" min={0} max={359} step={1}
                value={cabinets.find(c => c.id === selected)?.rotation || 0}
                onChange={e => { const val = (+e.target.value + 360) % 360; setCabinets(p => p.map(c => c.id === selected ? { ...c, rotation: val } : c)) }}
                style={{ width: 52, padding: '4px 6px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 12, outline: 'none', textAlign: 'center' }} />
              <span style={{ fontSize: 11, color: '#888' }}>° <kbd style={{ background: '#f0f0f0', padding: '1px 4px', borderRadius: 3 }}>R</kbd></span>
            </div>
          )}
          {mode === 'select' && selected && selectedType === 'cabinet' && elements.some(el => (el.type === 'window' || el.type === 'door') && el.embeddedInWall) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderLeft: '1px solid #E0DAD4', paddingLeft: 12 }}>
              <button
                onClick={() => centerCabinetOnNearestOpening(selected)}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1.5px solid #E0DAD4', background: '#fff', color: '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                🎯 Center on Opening
              </button>
            </div>
          )}
          {mode === 'select' && selected && selectedType === 'cabinet' && cabinets.find(c => c.id === selected)?.subtype === 'Blind' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderLeft: '1px solid #E0DAD4', paddingLeft: 12 }}>
              <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>Blind side</span>
              <button
                onClick={() => setCabinets(p => p.map(c => c.id === selected ? { ...c, blindSide: c.blindSide === 'right' ? 'left' : 'right' } : c))}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1.5px solid #E0DAD4', background: '#fff', color: '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {(cabinets.find(c => c.id === selected)?.blindSide || 'left') === 'left' ? '⬅ Blind Left / Door Right' : '➡ Blind Right / Door Left'}
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
          style={{ background: '#fff', border: '2px solid #2c3e50', borderRadius: 4, cursor: isPanningRef.current ? 'grabbing' : mode === 'draw' ? 'crosshair' : 'default', display: 'block' }}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
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
  <WallSegment key={i} wall={w} index={i} selected={selectedWall === i}
    thickness={wallPx} scale={scale} winding={winding}
    innerLenMm={getInnerLength(w, wallThickness, scale)}
    outerLenMm={Math.round(Math.hypot(w.x2-w.x1, w.y2-w.y1) / scale)}

              onSelect={() => { wallClickedRef.current = true; setSelectedWall(i) }}
              onDragStart={hideToolbar ? () => {} : startWallDrag}
              onEndpointDragStart={hideToolbar ? () => {} : startEndpointDrag}
              onLabelClick={() => { if (!hideToolbar) { setSelectedWall(i); setEditingWall(i); setEditingLenVal(null) } }}
              editingLength={!hideToolbar && editingWall === i}
              onLengthChange={v => setEditingLenVal(v)}
              onLengthConfirm={confirmWallEdit}
            />
          ))}
          {wallSnapPreview && <circle cx={wallSnapPreview.centerX} cy={wallSnapPreview.centerY} r={8} fill={ACCENT+'44'} stroke={ACCENT} strokeWidth={2} style={{ pointerEvents: 'none' }} />}
          {mode === 'draw' && endpointSnap && <circle cx={endpointSnap.x} cy={endpointSnap.y} r={10} fill="#2AC87A33" stroke="#2AC87A" strokeWidth={2} style={{ pointerEvents: 'none' }} />}
          {mode === 'draw' && startPoint && previewEnd && previewEnd.innerLenMm > 0 && (
            <>
              <line x1={startPoint.x} y1={startPoint.y} x2={previewEnd.x} y2={previewEnd.y}
                stroke={ACCENT} strokeWidth={wallPx} strokeLinecap="square" opacity={0.3} style={{ pointerEvents: 'none' }} />
              <g transform={`translate(${(startPoint.x+previewEnd.x)/2},${(startPoint.y+previewEnd.y)/2})`}>
                <rect x={-36} y={-13} width={72} height={20} rx={4} fill={ACCENT} opacity={0.9} />
                <text x={0} y={3} textAnchor="middle" fontSize={10} fill="#fff" fontFamily="Inter,sans-serif" fontWeight={700}>{previewEnd.innerLenMm}mm · {previewEnd.angleDeg}°</text>
              </g>
              <circle cx={previewEnd.x} cy={previewEnd.y} r={5} fill={previewEnd.snapped ? '#2AC87A' : ACCENT} stroke="#fff" strokeWidth={2} style={{ pointerEvents: 'none' }} />
            </>
          )}
          {mode === 'draw' && startPoint && <circle cx={startPoint.x} cy={startPoint.y} r={7} fill="#2AC87A" stroke="#fff" strokeWidth={2} style={{ pointerEvents: 'none' }} />}
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
          {[...cabinets.filter(c => c.category !== 'wall'), ...cabinets.filter(c => c.category === 'wall')].map(cab => {
            const x = cab.x * scale, y = cab.y * scale, w = cab.width * scale, h = cab.depth * scale
            const rot = cab.rotation || 0, cx = x + w/2, cy = y + h/2
            const isSelected = selected === cab.id && selectedType === 'cabinet'
            return (
              <g key={cab.id} transform={`rotate(${rot}, ${cx}, ${cy})`}
                onMouseDown={e => startElementDrag(e, cab.id, 'cabinet')}
                style={{ cursor: 'move', opacity: cab.category === 'wall' ? 0.6 : 1 }}>
                {(() => {
                  const APPLIANCE_2D_COLORS = {
                    'Freestanding Oven': '#2b2b2b',
                    'Freestanding Fridge': '#d7dadd',
                    'Freestanding Dishwasher': '#d7dadd',
                    'Fridge': '#d7dadd',
                    'Oven Tower': '#2b2b2b',
                    'Double Oven': '#2b2b2b',
                  }
                  const applianceFill = APPLIANCE_2D_COLORS[cab.subtype] || (cab.category === 'wall' && cab.subtype === 'Appliance' ? '#c9cccf' : null)
                  const fill = applianceFill || (cab.subtype === 'Side Panel' ? cab.frontColor : cab.carcassColor)
                  return <rect x={x} y={y} width={w} height={h} fill={fill} stroke={isSelected ? ACCENT : '#888'} strokeWidth={isSelected ? 2.5 : 1.5} strokeDasharray={cab.category === 'wall' ? '5,3' : undefined} rx={2} />
                })()}
                {cab.subtype === 'Blind' && (() => {
                  const blindWpx = BLIND_PANEL_WIDTH * scale
                  const side = cab.blindSide || 'left'
                  const blindX = side === 'left' ? x : x + w - blindWpx
                  const lineX = side === 'left' ? x + blindWpx : x + w - blindWpx
                  return (
                    <>
                      <rect x={blindX} y={y} width={blindWpx} height={h} fill="rgba(0,0,0,0.08)" style={{ pointerEvents: 'none' }} />
                      <line x1={lineX} y1={y} x2={lineX} y2={y + h} stroke="#2c3e50" strokeWidth={1.25} style={{ pointerEvents: 'none' }} />
                    </>
                  )
                })()}
                {collidingIds.has(cab.id) && (
                  <rect x={x} y={y} width={w} height={h} fill="url(#collisionHatch)" stroke="#DC3232" strokeWidth={2} rx={2} style={{ pointerEvents: 'none' }} />
                )}
                {cab.subtype !== 'Side Panel' && <rect x={x} y={y+h} width={w} height={(cab.frontMaterialThickness || 18) * scale} fill={cab.frontColor} stroke={isSelected ? ACCENT : '#888'} strokeWidth={0.75} />}
                <text x={cx} y={cy} textAnchor="middle" fontSize={8} fontWeight={700} fill="#333" style={{ userSelect: 'none', pointerEvents: 'none' }}>{cab.label}</text>
                {showDimensions && <text x={cx} y={cy+10} textAnchor="middle" fontSize={7} fill="#666" style={{ pointerEvents: 'none' }}>{cab.width}mm</text>}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
