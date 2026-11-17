import React from 'react'

const ACCENT = '#C8902A'
const INK = '#2b2b2b'

function Dim({ x1, y1, x2, y2, label, fs, vertical }) {
  const tick = fs * 0.35
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return (
    <g stroke="#8a8a8a" strokeWidth={fs * 0.05} fill="#555">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical ? (
        <>
          <line x1={x1 - tick} y1={y1} x2={x1 + tick} y2={y1} />
          <line x1={x2 - tick} y1={y2} x2={x2 + tick} y2={y2} />
          <text x={mx - fs * 0.4} y={my} fontSize={fs} stroke="none" textAnchor="middle" transform={`rotate(-90 ${mx - fs * 0.4} ${my})`}>{label}</text>
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - tick} x2={x1} y2={y1 + tick} />
          <line x1={x2} y1={y2 - tick} x2={x2} y2={y2 + tick} />
          <text x={mx} y={my - fs * 0.35} fontSize={fs} stroke="none" textAnchor="middle">{label}</text>
        </>
      )}
    </g>
  )
}

export default function WardrobeElevation({ result, design, std, selected, onSelectSection, onSelectZone, zoneLabel }) {
  const H = Number(design.height) || 0
  const cw = result.summary.carcassW || 0
  const fl = Number(design.fillerLeft) || 0
  const fr = Number(design.fillerRight) || 0
  const fs = Math.max(cw + fl + fr, H) / 55
  const padL = fl + fs * 4.5
  const padT = fs * 4
  const padB = fs * 5.4
  const padR = fr + fs * 2
  const vbW = cw + padL + padR
  const vbH = H + padT + padB
  const X = (x) => x + padL
  const Y = (y) => padT + H - y
  const T = std.carcassT
  const bodyTop = std.plinthH + result.summary.bodyH
  let sx = 0
  const sectionRects = result.sections.map((s, i) => {
    const r = { i, x: sx, w: s.w, s }
    sx += s.w
    return r
  })

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} style={{ width: '100%', height: 'auto', maxHeight: 560, display: 'block', background: '#fff', borderRadius: 12 }}>
      {sectionRects.map(({ i, x, w, s }) => (
        <g key={`sec-${i}`} onClick={() => onSelectSection(i)} style={{ cursor: 'pointer' }}>
          <rect x={X(x + T)} y={Y(bodyTop - T)} width={Math.max(0, w - 2 * T)} height={Math.max(0, result.summary.innerH)}
            fill={selected.section === i ? '#fbf3e4' : '#faf8f5'} />
          {s.zones.map((z, zi) => {
            const yb = std.plinthH + T + z.bottom
            const active = selected.section === i && selected.zone === zi
            return (
              <g key={`z-${zi}`} onClick={(e) => { e.stopPropagation(); onSelectZone(i, zi) }}>
                <rect x={X(x + T)} y={Y(yb + Math.max(0, z.h))} width={Math.max(0, w - 2 * T)} height={Math.max(0, z.h)}
                  fill={active ? 'rgba(200,144,42,0.18)' : 'transparent'} stroke={active ? ACCENT : 'none'} strokeWidth={fs * 0.12} strokeDasharray={`${fs * 0.4} ${fs * 0.3}`} />
              </g>
            )
          })}
        </g>
      ))}

      {result.geometry.map((g, i) => {
        if (g.kind === 'door' || g.kind === 'slidingDoor' || g.kind === 'back' || g.kind === 'drawerBox') return null
        if (g.kind === 'rail') {
          return (
            <g key={i} pointerEvents="none">
              <line x1={X(g.x)} y1={Y(g.y)} x2={X(g.x + g.w)} y2={Y(g.y)} stroke="#7c8186" strokeWidth={g.h * 0.8} strokeLinecap="round" />
            </g>
          )
        }
        const fill = g.kind === 'carcass' ? '#e9e2d6' : g.kind === 'shelf' ? '#efe9df' : g.kind === 'drawerFront' ? '#f4ede1' : g.kind === 'spacer' ? '#e2dbcf' : '#ddd5c8'
        return (
          <g key={i} pointerEvents="none">
            <rect x={X(g.x)} y={Y(g.y + g.h)} width={g.w} height={g.h} fill={fill} stroke={INK} strokeWidth={fs * 0.05} />
            {g.kind === 'drawerFront' && (
              <line x1={X(g.x + g.w / 2 - 60)} y1={Y(g.y + g.h - 35)} x2={X(g.x + g.w / 2 + 60)} y2={Y(g.y + g.h - 35)} stroke="#7c8186" strokeWidth={fs * 0.25} strokeLinecap="round" />
            )}
          </g>
        )
      })}

      {sectionRects.map(({ i, x, w, s }) => (
        <g key={`lbl-${i}`} pointerEvents="none">
          {s.zones.map((z, zi) => (z.h > fs * 2.4 ? (
            <text key={zi} x={X(x + w / 2)} y={Y(std.plinthH + T + z.bottom + z.h / 2)} fontSize={fs * 0.8} fill="#8a7f70" textAnchor="middle" dominantBaseline="middle"
              stroke="#fff" strokeWidth={fs * 0.35} paintOrder="stroke" strokeLinejoin="round">
              {zoneLabel(z)} · {Math.round(z.h)}
            </text>
          ) : null))}
        </g>
      ))}
      {sectionRects.map(({ i, x, w }) => (
        <g key={`num-${i}`} onClick={() => onSelectSection(i)} style={{ cursor: 'pointer' }}>
          <circle cx={X(x + w / 2)} cy={Y(0) + fs * 4} r={fs * 0.85} fill={selected.section === i ? ACCENT : '#bdb3a4'} />
          <text x={X(x + w / 2)} y={Y(0) + fs * 4.03} fontSize={fs * 0.85} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontWeight="700" pointerEvents="none">{i + 1}</text>
        </g>
      ))}

      <Dim x1={X(-fl)} y1={padT - fs * 1.6} x2={X(cw + fr)} y2={padT - fs * 1.6} label={`${Math.round(cw + fl + fr)}`} fs={fs} />
      {sectionRects.map(({ i, x, w }) => (
        <Dim key={`dw-${i}`} x1={X(x)} y1={Y(0) + fs * 2} x2={X(x + w)} y2={Y(0) + fs * 2} label={`${w}`} fs={fs * 0.85} />
      ))}
      <Dim vertical x1={X(-fl) - fs * 3.2} y1={Y(0)} x2={X(-fl) - fs * 3.2} y2={Y(H)} label={`${Math.round(H)}`} fs={fs} />
      <Dim vertical x1={X(-fl) - fs * 1.4} y1={Y(std.plinthH)} x2={X(-fl) - fs * 1.4} y2={Y(bodyTop)} label={`${result.summary.bodyH}`} fs={fs * 0.8} />
      {result.summary.loftH > 0 && (
        <Dim vertical x1={X(-fl) - fs * 1.4} y1={Y(bodyTop)} x2={X(-fl) - fs * 1.4} y2={Y(bodyTop + result.summary.loftH)} label={`${result.summary.loftH}`} fs={fs * 0.8} />
      )}
    </svg>
  )
}
