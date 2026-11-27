import React from 'react'
import { sectionWidths } from './wardrobeEngine'

const ACCENT = '#C8902A'
const INK = '#2b2b2b'

const num = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function doorSwings(unit) {
  const seen = new Set()
  return (unit.result?.geometry || []).filter((g) => g.kind === 'door' && !g.loft).filter((g) => {
    const key = `${Math.round(g.x)}:${Math.round(g.w)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export default function UnitShape({ unit, s = 1, selected = false, colliding = false, name, rotation = 0, showSwings = true }) {
  const L = num(unit.frame.length)
  const D = num(unit.frame.depth)
  const fs = Math.max(9 / Math.max(s, 0.01), Math.min(L, D) / 6) * s
  const stroke = colliding ? '#DC3232' : selected ? ACCENT : '#9a8f80'
  const sw = (selected ? 2 : 1.2)
  const flip = rotation > 90 && rotation <= 270
  const lines = []
  if (unit.kind === 'wardrobe') {
    let acc = num(unit.design.fillerLeft)
    sectionWidths(unit.design).slice(0, -1).forEach((w, i) => {
      acc += w
      lines.push(<line key={`d${i}`} x1={acc * s} y1={0} x2={acc * s} y2={D * s} stroke="#b3a898" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />)
    })
  } else {
    const bays = Math.max(1, Math.round(num(unit.design.bays, 1)))
    for (let i = 1; i < bays; i++) lines.push(<line key={`b${i}`} x1={(L * i / bays) * s} y1={0} x2={(L * i / bays) * s} y2={D * s} stroke="#b3a898" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />)
    if (unit.design.doubleSided) lines.push(<line key="mid" x1={0} y1={(D / 2) * s} x2={L * s} y2={(D / 2) * s} stroke="#b3a898" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />)
  }
  const doors = unit.kind === 'wardrobe' && unit.design.doorType !== 'none'
  return (
    <g>
      <rect x={0} y={0} width={L * s} height={D * s} fill={selected ? '#fbf0dc' : unit.kind === 'island' ? '#efe6d6' : '#eee7dc'} stroke={stroke} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      {colliding && <rect x={0} y={0} width={L * s} height={D * s} fill="#DC323222" stroke="none" style={{ pointerEvents: 'none' }} />}
      <g style={{ pointerEvents: 'none' }}>
        {lines}
        {doors && <line x1={0} y1={D * s} x2={L * s} y2={D * s} stroke={INK} strokeWidth={2} vectorEffect="non-scaling-stroke" />}
        {showSwings && doorSwings(unit).map((g, i) => {
          const w = num(g.w)
          const pivot = g.hinge === 'left' ? num(g.x) : num(g.x) + w
          const tip = g.hinge === 'left' ? pivot + w : pivot - w
          const sweep = g.hinge === 'left' ? 1 : 0
          return (
            <g key={`s${i}`}>
              <line x1={pivot * s} y1={D * s} x2={pivot * s} y2={(D + w) * s} stroke="#8a7f70" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
              <path d={`M ${tip * s} ${D * s} A ${w * s} ${w * s} 0 0 ${sweep} ${pivot * s} ${(D + w) * s}`} fill="none" stroke="#8a7f70" strokeWidth={0.8} vectorEffect="non-scaling-stroke" strokeDasharray="4 3" />
            </g>
          )
        })}
        <g transform={flip ? `rotate(180 ${(L / 2) * s} ${(D / 2) * s})` : undefined}>
          <text x={(L / 2) * s} y={(D / 2) * s - fs * 0.15} fontSize={fs} fontWeight={700} fill={selected ? ACCENT : '#5c5348'} textAnchor="middle" fontFamily="Inter,sans-serif">{name || unit.label}</text>
          <text x={(L / 2) * s} y={(D / 2) * s + fs * 0.95} fontSize={fs * 0.75} fill="#8a7f70" textAnchor="middle" fontFamily="Inter,sans-serif">{Math.round(L)} × {Math.round(D)}</text>
        </g>
      </g>
    </g>
  )
}
