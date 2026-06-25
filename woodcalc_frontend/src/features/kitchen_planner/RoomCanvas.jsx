import React, { useState, useRef, useCallback, useEffect } from 'react'

const ACCENT = '#C8902A'
const GRID = 50
const SNAP_DIST = 15

const snap = v => Math.round(v / GRID) * GRID

function WallSegment({ x1, y1, x2, y2, selected, thickness, onClick }) {
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI
  const len = Math.hypot(x2 - x1, y2 - y1)
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2
  const realLen = Math.round(len / 0.16)
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={selected ? ACCENT : '#2c3e50'} strokeWidth={thickness} strokeLinecap="round" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={Math.max(thickness + 8, 16)} strokeLinecap="round" />
      <g transform={`translate(${cx},${cy}) rotate(${angle})`}>
        <rect x={-22} y={-10} width={44} height={16} rx={3} fill="white" stroke="#ddd" strokeWidth={0.5} />
        <text x={0} y={3} textAnchor="middle" fontSize={9} fill="#555" fontFamily="Inter,sans-serif" fontWeight={600}>{realLen}mm</text>
      </g>
    </g>
  )
}

function snapToWall(px, py, walls, snapDist) {
  let best = null, bestDist = snapDist
  walls.forEach((w, wi) => {
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) return
    const t = Math.max(0, Math.min(1, ((px - w.x1) * dx + (py - w.y1) * dy) / lenSq))
    const closestX = w.x1 + t * dx
    const closestY = w.y1 + t * dy
    const dist = Math.hypot(px - closestX, py - closestY)
    if (dist < bestDist) {
      bestDist = dist
      best = { x: closestX, y: closestY, wallIndex: wi, wallAngle: Math.atan2(dy, dx) * 180 / Math.PI, dist }
    }
  })
  return best
}

export default function RoomCanvas({
  room, scale, showGrid, showDimensions,
  elements, setElements, cabinets, setCabinets,
  selected, setSelected, selectedType, setSelectedType,
  wallThickness, setWallThickness,
}) {
  const [walls, setWalls] = useState([])
  const [drawMode, setDrawMode] = useState(false)
  const [drawPoints, setDrawPoints] = useState([])
  const [mousePos, setMousePos] = useState(null)
  const [selectedWall, setSelectedWall] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [dragType, setDragType] = useState(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [wallSnap, setWallSnap] = useState(null)
  const svgRef = useRef(null)

  const W = room.width * scale
  const H = room.depth * scale
  const wallPx = (wallThickness / 1000) * (1 / 0.16) * scale

  const getSVGPos = useCallback((e) => {
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: snap((e.clientX - rect.left) / scale) * scale,
      y: snap((e.clientY - rect.top) / scale) * scale,
    }
  }, [scale])

  const handleCanvasClick = useCallback((e) => {
    if (!drawMode) return
    const pos = getSVGPos(e)
    if (drawPoints.length > 2) {
      const first = drawPoints[0]
      if (Math.hypot(pos.x - first.x, pos.y - first.y) < 20) {
        const closed = [...walls]
        for (let i = 0; i < drawPoints.length - 1; i++) {
          closed.push({ x1: drawPoints[i].x, y1: drawPoints[i].y, x2: drawPoints[i+1].x, y2: drawPoints[i+1].y })
        }
        closed.push({ x1: drawPoints[drawPoints.length-1].x, y1: drawPoints[drawPoints.length-1].y, x2: drawPoints[0].x, y2: drawPoints[0].y })
        setWalls(closed); setDrawPoints([]); setDrawMode(false)
        return
      }
    }
    if (drawPoints.length > 0) {
      const last = drawPoints[drawPoints.length - 1]
      setWalls(prev => [...prev, { x1: last.x, y1: last.y, x2: pos.x, y2: pos.y }])
    }
    setDrawPoints(newP => [...newP, { x: pos.x, y: pos.y }])
  }, [drawMode, drawPoints, walls, getSVGPos])

  const handleMouseMove = useCallback((e) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const rawX = e.clientX - rect.left
    const rawY = e.clientY - rect.top
    setMousePos({ x: snap(rawX / scale) * scale, y: snap(rawY / scale) * scale })
    if (dragging !== null) {
      const snapResult = snapToWall(rawX, rawY, walls, SNAP_DIST)
      let x, y
      if (snapResult) {
        x = snapResult.x / scale; y = snapResult.y / scale; setWallSnap(snapResult)
      } else {
        x = Math.max(0, snap((rawX - offset.x) / scale))
        y = Math.max(0, snap((rawY - offset.y) / scale))
        setWallSnap(null)
      }
      if (dragType === 'cabinet') setCabinets(p => p.map(c => c.id === dragging ? { ...c, x, y } : c))
      else if (dragType === 'element') setElements(p => p.map(el => el.id === dragging ? { ...el, x, y } : el))
    }
  }, [dragging, offset, dragType, scale, walls, setCabinets, setElements])

  const startDrag = useCallback((e, id, type) => {
    if (drawMode) return
    e.stopPropagation()
    const rect = svgRef.current.getBoundingClientRect()
    const item = type === 'cabinet' ? cabinets.find(c => c.id === id) : elements.find(el => el.id === id)
    setDragging(id); setDragType(type); setSelected(id); setSelectedType(type)
    setOffset({ x: e.clientX - rect.left - item.x * scale, y: e.clientY - rect.top - item.y * scale })
  }, [drawMode, cabinets, elements, scale, setSelected, setSelectedType])

  const stopDrag = () => { setDragging(null); setDragType(null); setWallSnap(null) }

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'r' || e.key === 'R') {
        if (selectedType === 'cabinet') setCabinets(p => p.map(c => c.id === selected ? { ...c, rotation: ((c.rotation || 0) + 90) % 360 } : c))
        else if (selectedType === 'element') setElements(p => p.map(el => el.id === selected ? { ...el, rotation: ((el.rotation || 0) + 90) % 360 } : el))
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWall !== null) {
        setWalls(p => p.filter((_, i) => i !== selectedWall)); setSelectedWall(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selected, selectedType, selectedWall, setCabinets, setElements])

  const gridLines = []
  if (showGrid) {
    for (let x = 0; x <= W; x += GRID * scale) gridLines.push(<line key={'gx'+x} x1={x} y1={0} x2={x} y2={H} stroke="rgba(200,144,42,0.08)" strokeWidth={0.5} />)
    for (let y = 0; y <= H; y += GRID * scale) gridLines.push(<line key={'gy'+y} x1={0} y1={y} x2={W} y2={y} stroke="rgba(200,144,42,0.08)" strokeWidth={0.5} />)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => { setDrawMode(!drawMode); setDrawPoints([]) }}
          style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid', borderColor: drawMode ? ACCENT : '#E0DAD4', background: drawMode ? ACCENT + '18' : '#fff', color: drawMode ? ACCENT : '#555', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {drawMode ? '✏️ Drawing… click points, click green dot to close' : '✏️ Draw walls'}
        </button>
        {drawMode && drawPoints.length > 0 && (
          <button onClick={() => { setDrawMode(false); setDrawPoints([]) }}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1.5px solid #E0DAD4', background: '#fff', color: '#888', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
        )}
        {walls.length > 0 && (
          <button onClick={() => { setWalls([]); setSelectedWall(null) }}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#E74C3C', fontSize: 12, cursor: 'pointer' }}>Clear walls</button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8, borderLeft: '1px solid #E0DAD4', paddingLeft: 12 }}>
          <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>Wall thickness</span>
          <input type="range" min={50} max={300} step={10} value={wallThickness} onChange={e => setWallThickness(+e.target.value)} style={{ width: 80, accentColor: ACCENT }} />
          <span style={{ fontSize: 11, color: ACCENT, fontWeight: 700, minWidth: 40 }}>{wallThickness}mm</span>
        </div>
        <span style={{ fontSize: 11, color: '#999' }}>Press <kbd style={{ background: '#f0f0f0', padding: '1px 5px', borderRadius: 3 }}>R</kbd> to rotate · Drag near wall to snap</span>
      </div>

      <svg ref={svgRef} width={W} height={H}
        style={{ background: '#fff', border: '2px solid #2c3e50', borderRadius: 4, cursor: drawMode ? 'crosshair' : 'default', display: 'block' }}
        onClick={handleCanvasClick} onMouseMove={handleMouseMove} onMouseUp={stopDrag} onMouseLeave={stopDrag}
        onDoubleClick={() => { if (drawMode && drawPoints.length > 1) { setDrawMode(false); setDrawPoints([]) } }}>
        {gridLines}
        <rect x={0} y={0} width={W} height={H} fill="none" stroke="#ddd" strokeWidth={1} strokeDasharray="4,4" />
        {showDimensions && <>
          <text x={W/2} y={-8} textAnchor="middle" fontSize={11} fill="#888" fontFamily="Inter,sans-serif" fontWeight={600}>{room.width}mm</text>
          <text x={-8} y={H/2} textAnchor="middle" fontSize={11} fill="#888" fontFamily="Inter,sans-serif" fontWeight={600} transform={`rotate(-90, -8, ${H/2})`}>{room.depth}mm</text>
        </>}
        {walls.map((w, i) => (
          <WallSegment key={i} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} selected={selectedWall === i} thickness={wallPx}
            onClick={(e) => { e.stopPropagation(); setSelectedWall(i); setSelected(null) }} />
        ))}
        {wallSnap && <circle cx={wallSnap.x} cy={wallSnap.y} r={8} fill={ACCENT + '44'} stroke={ACCENT} strokeWidth={2} style={{ pointerEvents: 'none' }} />}
        {drawMode && drawPoints.length > 0 && mousePos && (
          <line x1={drawPoints[drawPoints.length-1].x} y1={drawPoints[drawPoints.length-1].y} x2={mousePos.x} y2={mousePos.y}
            stroke={ACCENT} strokeWidth={3} strokeDasharray="6,4" strokeLinecap="round" style={{ pointerEvents: 'none' }} />
        )}
        {drawPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={6} fill={i === 0 ? '#2AC87A' : ACCENT} stroke="#fff" strokeWidth={2} style={{ cursor: 'pointer' }} />
        ))}
        {elements.map(el => {
          const x = el.x * scale, y = el.y * scale, w = el.w * scale, h = el.h * scale
          const rot = el.rotation || 0, cx = x + w/2, cy = y + h/2
          const isSelected = selected === el.id && selectedType === 'element'
          return (
            <g key={el.id} transform={`rotate(${rot}, ${cx}, ${cy})`} onMouseDown={e => startDrag(e, el.id, 'element')} style={{ cursor: drawMode ? 'crosshair' : 'grab' }}>
              <rect x={x} y={y} width={w} height={h} fill={el.color + '44'} stroke={isSelected ? ACCENT : el.color} strokeWidth={isSelected ? 2.5 : 1.5} rx={3} />
              <text x={cx} y={cy - 2} textAnchor="middle" fontSize={13} style={{ userSelect: 'none', pointerEvents: 'none' }}>{el.icon}</text>
              {showDimensions && <text x={cx} y={cy + 9} textAnchor="middle" fontSize={7} fill="#555" style={{ pointerEvents: 'none' }}>{el.w}×{el.h}</text>}
              {isSelected && <rect x={x-2} y={y-2} width={w+4} height={h+4} fill="none" stroke={ACCENT} strokeWidth={1.5} strokeDasharray="4,3" rx={4} style={{ pointerEvents: 'none' }} />}
              {isSelected && rot !== 0 && <text x={cx} y={y - 8} textAnchor="middle" fontSize={8} fill={ACCENT} style={{ pointerEvents: 'none' }}>{rot}°</text>}
            </g>
          )
        })}
        {cabinets.map(cab => {
          const x = cab.x * scale, y = cab.y * scale, w = cab.width * scale, h = cab.depth * scale
          const rot = cab.rotation || 0, cx = x + w/2, cy = y + h/2
          const isSelected = selected === cab.id && selectedType === 'cabinet'
          return (
            <g key={cab.id} transform={`rotate(${rot}, ${cx}, ${cy})`} onMouseDown={e => startDrag(e, cab.id, 'cabinet')} style={{ cursor: drawMode ? 'crosshair' : 'grab' }}>
              <rect x={x} y={y} width={w} height={h} fill={cab.carcassColor} stroke={isSelected ? ACCENT : '#888'} strokeWidth={isSelected ? 2.5 : 1.5} rx={2} />
              <rect x={x} y={y + h - 4} width={w} height={4} fill={cab.frontColor} opacity={0.9} />
              <text x={cx} y={cy} textAnchor="middle" fontSize={8} fontWeight={700} fill="#333" style={{ userSelect: 'none', pointerEvents: 'none' }}>{cab.label}</text>
              {showDimensions && <text x={cx} y={cy + 10} textAnchor="middle" fontSize={7} fill="#666" style={{ pointerEvents: 'none' }}>{cab.width}mm</text>}
              {isSelected && rot !== 0 && <text x={cx} y={y - 8} textAnchor="middle" fontSize={8} fill={ACCENT} style={{ pointerEvents: 'none' }}>{rot}°</text>}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
