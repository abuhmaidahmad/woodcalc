import React from 'react'
import UnitShape from './UnitShape'
import { closetRoom } from './closetRoom'
import { wallPolygons, columnPolygon, openingRegion } from './closetChecks'
import { framePolygon } from './unitGeometry'

const INK = '#2b2b2b'

const rotationOf = (f) => ((Math.atan2(f.u[1], f.u[0]) * 180) / Math.PI + 360) % 360

export default function ClosetPlan({ result, closet, selected = null, onSelect = () => {}, unitName = (u) => u.label }) {
  const room = closetRoom(closet)
  const walls = wallPolygons(room)
  const units = result.units || []
  const pts = walls.flatMap((w) => w.poly).concat(units.flatMap((u) => framePolygon(u.frame)))
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const [x0, x1, y0, y1] = pts.length ? [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] : [0, 3000, 0, 2600]
  const pad = Math.max(x1 - x0, y1 - y0) * 0.06
  const pp = (list) => list.map(([x, y]) => `${x},${y}`).join(' ')
  const s = Math.max(x1 - x0, y1 - y0) / 700

  return (
    <svg viewBox={`${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`} style={{ width: '100%', height: 'auto', maxHeight: 560, display: 'block', background: '#fff', borderRadius: 12 }}>
      {walls.map((w) => <polygon key={w.index} points={pp(w.poly)} fill={INK} />)}
      {(room.elements || []).map((el) => {
        if (el.type === 'column') return <polygon key={el.id} points={pp(columnPolygon(el))} fill="#9E9E9E" stroke={INK} strokeWidth={s} />
        const w = walls[el.wallIndex]
        if (!el.embeddedInWall || !w) return null
        const [a, b] = openingRegion(el, w, 0)
        const color = el.type === 'door' ? '#DEB887' : '#87CEEB'
        return <line key={el.id} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={Math.max(60, s * 6)} />
      })}
      {units.map((u) => (
        <g key={u.id} transform={`translate(${u.frame.origin[0]} ${u.frame.origin[1]}) rotate(${rotationOf(u.frame)})`}
          onClick={() => onSelect(u.id)} style={{ cursor: 'pointer' }}>
          <UnitShape unit={u} s={1} selected={selected === u.id} name={unitName(u)} rotation={rotationOf(u.frame)} />
        </g>
      ))}
    </svg>
  )
}
