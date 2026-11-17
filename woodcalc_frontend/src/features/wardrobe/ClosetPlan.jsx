import React from 'react'
import { sectionWidths } from './wardrobeEngine'

const ACCENT = '#C8902A'
const INK = '#2b2b2b'

const add = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k]

function runPolygon(place) {
  const a = place.origin
  const b = add(a, place.u, place.length)
  const c = add(b, place.n, place.depth)
  const d = add(a, place.n, place.depth)
  return [a, b, c, d]
}

export default function ClosetPlan({ result, selected, onSelect, wallLabel }) {
  const { layout } = result
  const W = layout.width
  const D = layout.depth
  const fs = Math.max(W, D) / 40
  const pad = fs * 4
  const vbW = W + 2 * pad
  const vbH = D + 2 * pad
  const X = (x) => x + pad
  const Y = (y) => y + pad
  const pts = (list) => list.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')
  const sides = {
    A: [[0, 0], [W, 0]],
    B: [[0, 0], [0, D]],
    C: [[W, 0], [W, D]],
    E: [[0, D], [W, D]],
  }
  const isl = result.island?.place

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} style={{ width: '100%', height: 'auto', maxHeight: 560, display: 'block', background: '#fff', borderRadius: 12 }}>
      <rect x={X(0)} y={Y(0)} width={W} height={D} fill="#faf8f5" />
      {Object.entries(sides).map(([id, [p, q]]) => {
        const solid = id !== 'E'
        return (
          <line key={id} x1={X(p[0])} y1={Y(p[1])} x2={X(q[0])} y2={Y(q[1])}
            stroke={solid ? INK : '#b8afa2'} strokeWidth={solid ? fs * 0.45 : fs * 0.12}
            strokeDasharray={solid ? undefined : `${fs * 0.6} ${fs * 0.4}`} />
        )
      })}
      {result.runs.map((r) => {
        const poly = runPolygon(r.place)
        const active = selected === r.id
        const widths = sectionWidths(r.design)
        let acc = 0
        const dividers = widths.slice(0, -1).map((w) => {
          acc += w
          const a = add(r.place.origin, r.place.u, acc)
          const b = add(a, r.place.n, r.place.depth)
          return [a, b]
        })
        const mid = add(add(r.place.origin, r.place.u, r.place.length / 2), r.place.n, r.place.depth / 2)
        const doors = r.design.doorType !== 'none'
        const frontA = add(r.place.origin, r.place.n, r.place.depth)
        const frontB = add(frontA, r.place.u, r.place.length)
        return (
          <g key={r.id} onClick={() => onSelect(r.id)} style={{ cursor: 'pointer' }}>
            <polygon points={pts(poly)} fill={active ? '#fbf0dc' : '#eee7dc'} stroke={active ? ACCENT : '#9a8f80'} strokeWidth={fs * (active ? 0.18 : 0.08)} />
            {dividers.map(([a, b], i) => (
              <line key={i} x1={X(a[0])} y1={Y(a[1])} x2={X(b[0])} y2={Y(b[1])} stroke="#9a8f80" strokeWidth={fs * 0.06} />
            ))}
            {doors && <line x1={X(frontA[0])} y1={Y(frontA[1])} x2={X(frontB[0])} y2={Y(frontB[1])} stroke={INK} strokeWidth={fs * 0.2} />}
            <text x={X(mid[0])} y={Y(mid[1])} fontSize={fs * 0.9} fill={active ? ACCENT : '#5c5348'} textAnchor="middle" dominantBaseline="middle" fontWeight="700">
              {wallLabel(r.id)}
            </text>
            <text x={X(mid[0])} y={Y(mid[1]) + fs * 1.1} fontSize={fs * 0.7} fill="#8a7f70" textAnchor="middle" dominantBaseline="middle">
              {Math.round(r.place.length)} × {Math.round(r.place.depth)}
            </text>
          </g>
        )
      })}
      {isl && (
        <g onClick={() => onSelect('I')} style={{ cursor: 'pointer' }}>
          <rect x={X(isl.x)} y={Y(isl.y)} width={isl.w} height={isl.d} fill={selected === 'I' ? '#fbf0dc' : '#efe6d6'} stroke={selected === 'I' ? ACCENT : '#9a8f80'} strokeWidth={fs * 0.12} rx={fs * 0.2} />
          <text x={X(isl.x + isl.w / 2)} y={Y(isl.y + isl.d / 2)} fontSize={fs * 0.8} fill="#5c5348" textAnchor="middle" dominantBaseline="middle" fontWeight="700">{wallLabel('I')}</text>
          {Object.entries(isl.clearance).map(([side, w]) => {
            const cx = side === 'B' ? isl.x - w / 2 : side === 'C' ? isl.x + isl.w + w / 2 : isl.x + isl.w / 2
            const cy = side === 'A' ? isl.y - w / 2 : side === 'entrance' ? isl.y + isl.d + w / 2 : isl.y + isl.d / 2
            return (
              <text key={side} x={X(cx)} y={Y(cy)} fontSize={fs * 0.65} fill="#8a7f70" textAnchor="middle" dominantBaseline="middle">↔ {Math.round(w)}</text>
            )
          })}
        </g>
      )}
      <text x={X(W / 2)} y={Y(0) - fs * 1.6} fontSize={fs * 0.8} fill="#555" textAnchor="middle">{Math.round(W)}</text>
      <text x={X(0) - fs * 1.6} y={Y(D / 2)} fontSize={fs * 0.8} fill="#555" textAnchor="middle" transform={`rotate(-90 ${X(0) - fs * 1.6} ${Y(D / 2)})`}>{Math.round(D)}</text>
      <text x={X(W / 2)} y={Y(D) + fs * 1.8} fontSize={fs * 0.7} fill="#8a7f70" textAnchor="middle">{wallLabel('E')}</text>
    </svg>
  )
}
