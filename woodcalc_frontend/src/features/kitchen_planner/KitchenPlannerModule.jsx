import React, { useState, useCallback, useEffect } from 'react'
import { authFetch } from '../../api/auth'
import MaterialLibrary from './MaterialLibrary'
import { calculateCabinet, detectCornerJoins, isShelfEligible } from './formulaEngine'
import ZonePresetPicker from './ZonePresetPicker'
import KitchenPlanner3D , { useMaterialTextureMap } from './KitchenPlanner3D'
import RoomCanvas from './RoomCanvas'
import CabinetCatalog, { CountertopPicker, COUNTERTOP_MATERIALS, SinkPicker } from './CabinetCatalog'
import ProposalTab from './ProposalTab'
import ContractTab from './ContractTab'

const NON_CARCASS_SUBTYPES = ['Filler', 'Panel', 'Toe Kick', 'Shelf', 'Open Shelf', 'Fridge', 'Oven Tower', 'Double Oven', 'Appliance']
const APPLIANCE_SUBTYPES = ['Fridge', 'Oven Tower', 'Double Oven', 'Appliance', 'Freestanding Oven', 'Freestanding Fridge', 'Freestanding Dishwasher']
function isCarcassCabinet(c) {
  return !NON_CARCASS_SUBTYPES.includes(c.subtype) && c.category !== 'accessories'
}


// Numeric dimension input that keeps its own local text while typing.
// A plain controlled <input value={number}> fights the user: clearing the
// field commits 0 immediately, which then re-renders value="0" and blocks
// further typing. This buffers raw text locally and only commits upward
// once it parses to a valid number, so blank-then-retype works normally.
function DimInput({ value, onCommit, style }) {
  const [text, setText] = useState(String(value ?? ''))
  useEffect(() => {
    setText(String(value ?? ''))
  }, [value])
  return (
    <input
      type="number"
      value={text}
      onChange={e => {
        const raw = e.target.value
        setText(raw)
        if (raw !== '' && !Number.isNaN(+raw)) {
          onCommit(+raw)
        }
      }}
      onBlur={() => {
        if (text === '' || Number.isNaN(+text)) {
          setText(String(value ?? ''))
        }
      }}
      style={style}
    />
  )
}

function cabinetConfig(c) {
  const isDrawerCab = c.subtype === 'Drawers' || c.subtype === '2Drw+Door'
  return {
    width: c.width, height: c.height, depth: c.depth,
    material: c.material, doorStyle: c.doorStyle, shelves: 0,
    cabinetType: c.category,
    drawers: isDrawerCab ? 4 : 0,
    drawerType: c.drawerType,
    drawerSystem: c.drawerSystem,
    drawerBoxConstruction: c.drawerBoxConstruction,
    baseHeight: c.baseHeight,
    subtype: c.subtype,
  }
}


const SCALE = 0.16
const GRID = 50
const ACCENT = '#C8902A'
const DARK = '#1A1A1A'
const LIGHT = '#F7F4F0'

const ROOM_ELEMENTS = [
  { type: 'window',   label: 'Window',         icon: '🪟', color: '#87CEEB', w: 900,  h: 1200 },
  { type: 'door',     label: 'Door',           icon: '🚪', color: '#DEB887', w: 900,  h: 2300 },
  { type: 'electric', label: 'Electric Point', icon: '⚡', color: '#FFD700', w: 100,  h: 100  },
  { type: 'water',    label: 'Water Supply',   icon: '💧', color: '#4FC3F7', w: 100,  h: 100  },
  { type: 'drain',    label: 'Drain Point',    icon: '🕳',  color: '#90A4AE', w: 100,  h: 100  },
  { type: 'gas',      label: 'Gas Point',      icon: '🔥', color: '#FF7043', w: 100,  h: 100  },
  { type: 'column',   label: 'Column',         icon: '⬛', color: '#9E9E9E', w: 300,  h: 300  },
]

const snap = v => Math.round(v / GRID) * GRID


// ─── Edge banding helper ────────────────────────────────────────────
function getEdgeBanding(partName, carcassColor, frontColor, carcassMat, frontMat) {
  const cc = carcassMat || carcassColor || 'Carcass'
  const fc = frontMat || frontColor || 'Front'
  if (partName.includes('Back')) {
    return { T: 'None', B: 'None', L: 'None', R: 'None' }
  }
  if (partName.includes('Door') || partName.includes('Front')) {
    return { T: fc, B: fc, L: fc, R: fc }
  }
  if (partName.includes('Side')) {
    return { T: 'None', B: 'None', L: 'None', R: cc }
  }
  if (partName.includes('Bottom') || partName.includes('Rail') || partName.includes('Shelf')) {
    return { T: 'None', B: 'None', L: 'None', R: cc }
  }
  if (partName.includes('Toe')) {
    return { T: cc, B: 'None', L: 'None', R: 'None' }
  }
  return { T: 'None', B: 'None', L: 'None', R: 'None' }
}

function EBCell({ eb }) {
  const sides = [['T', eb.T], ['B', eb.B], ['L', eb.L], ['R', eb.R]]
  return (
    <div style={{ fontSize: 10, lineHeight: 1.6 }}>
      {sides.map(([s, v]) => (
        <div key={s} style={{ color: v === 'None' ? '#ccc' : '#9B59B6' }}>
          <strong>{s}:</strong> {v}
        </div>
      ))}
    </div>
  )
}

// ─── Per-Cabinet Cut List ────────────────────────────────────────────
function PerCabinetCutList({ cabinets, calculateCabinet, ACCENT, DARK }) {
  const [expanded, setExpanded] = React.useState({})
  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: DARK, marginBottom: 12 }}>📦 Per-Cabinet Cut List</div>
      {cabinets.map((c, i) => {
        if (!isCarcassCabinet(c)) return null
        let result
        try { result = calculateCabinet(cabinetConfig(c)) } catch { return null }
        const isOpen = expanded[c.id]
        const carcassMat = c.carcassMaterialName || c.carcassColor || 'Carcass'
        const frontMat = c.frontMaterialName || c.frontColor || 'Front'
        // exclude toe kick from per-cabinet list
        const panels = result.panels.filter(p => !p.name.includes('Toe'))
        return (
          <div key={c.id} style={{ background: '#fff', borderRadius: 12, marginBottom: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div onClick={() => toggle(c.id)}
              style={{ padding: '12px 16px', background: isOpen ? ACCENT+'12' : '#FAFAFA', borderBottom: isOpen ? '1px solid '+ACCENT+'30' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: DARK }}>
                {String(i+1).padStart(2,'0')} · {c.label}
                <span style={{ fontWeight: 400, color: '#888', fontSize: 11, marginLeft: 8 }}>{c.width}×{c.height}×{c.depth}mm · {c.doorStyle}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11, color: '#888' }}>{panels.length + result.doors.length} parts</span>
                <span style={{ color: ACCENT, fontSize: 14 }}>{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>
            {isOpen && (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#FAFAFA' }}>
                      {['Part', 'Qty', 'W (mm)', 'H (mm)', 'Thick', 'Material', 'Edge Banding (T/B/L/R)'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#888' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {panels.map((p, pi) => {
                      const eb = getEdgeBanding(p.name, c.carcassColor, c.frontColor, carcassMat, frontMat)
                      return (
                        <tr key={pi} style={{ borderBottom: '1px solid #F7F4F0' }}>
                          <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: DARK }}>{p.name}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: '#666' }}>{p.qty}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: 'monospace' }}>{p.width}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: 'monospace' }}>{p.depth}</td>
                          <td style={{ padding: '8px 12px', fontSize: 11, color: '#666' }}>{p.thickness}mm{p.thickness===8?' HDF':''}</td>
                          <td style={{ padding: '8px 12px', fontSize: 11, color: '#666' }}>{p.name.includes('Back') ? 'HDF 8mm' : c.material}</td>
                          <td style={{ padding: '8px 12px' }}><EBCell eb={eb} /></td>
                        </tr>
                      )
                    })}
                    {result.doors.map((d, di) => {
                      const eb = getEdgeBanding('Door', c.carcassColor, c.frontColor, carcassMat, frontMat)
                      return (
                        <tr key={'d'+di} style={{ borderBottom: '1px solid #F7F4F0', background: '#FFFDF9' }}>
                          <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: ACCENT }}>Door {di+1}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: '#666' }}>1</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: 'monospace' }}>{d.width}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: 'monospace' }}>{d.height}</td>
                          <td style={{ padding: '8px 12px', fontSize: 11, color: '#666' }}>18mm</td>
                          <td style={{ padding: '8px 12px', fontSize: 11, color: '#666' }}>{frontMat}</td>
                          <td style={{ padding: '8px 12px' }}><EBCell eb={eb} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div style={{ padding: '10px 16px', background: '#FAFAFA', borderTop: '1px solid #F0EBE5', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#666' }}>🔩 Confirmats: <strong>{result.hardware.confirmats}</strong></span>
                  <span style={{ fontSize: 11, color: '#666' }}>🪛 Dowels: <strong>{result.hardware.dowels}</strong></span>
                  <span style={{ fontSize: 11, color: '#666' }}>🦵 Legs: <strong>{result.hardware.legs}</strong></span>
                  <span style={{ fontSize: 11, color: '#666' }}>🔧 Hinges: <strong>{result.doors.reduce((s,d)=>s+d.hinges,0)}</strong></span>
                  {result.hardware.handles > 0 && <span style={{ fontSize: 11, color: '#666' }}>🖐 Handles: <strong>{result.hardware.handles}</strong></span>}
                  {result.hardware.tip_on > 0 && <span style={{ fontSize: 11, color: '#666' }}>👆 Tip-On: <strong>{result.hardware.tip_on}</strong></span>}
                  <span style={{ fontSize: 11, color: '#666' }}>📌 Back screws: <strong>{result.hardware.back_screws}</strong></span>
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Master Cut List for Workshop ───────────────────────────────────
function MasterCutList({ cabinets, calculateCabinet, ACCENT, DARK }) {
  const [expanded, setExpanded] = React.useState(true)

  // Build master grouped list
  const masterMap = {}
  const skirtingByMaterial = {}
  const golaProfileMeters = { L: 0, C: 0 }
  const drawerSystems = {}
  let ledStripMeters = 0
  let shelfPinsStandard = 0
  let shelfPinsRubber = 0

  // Cross-cabinet corner joins (e.g. a blind cabinet's run turning 90°) — these need a corner
  // elbow too, but aren't caught by the per-cabinet front/left/right/back check below since that
  // only covers a single cabinet's own skirtingSides, not two separate cabinets meeting at a corner.
  const skirtable = cabinets.filter(c => ['base', 'vanity', 'corner', 'tall'].includes(c.category) && (c.elevation || 0) === 0 && c.skirtingSides && c.skirtingSides.length > 0)
  detectCornerJoins(skirtable).forEach(j => {
    const a = cabinets.find(c => c.id === j.aId), b = cabinets.find(c => c.id === j.bId)
    if (!a || !b) return
    const matA = a.skirtingMaterial || 'match_countertop', matB = b.skirtingMaterial || 'match_countertop'
    if (matA !== matB) return
    if (!skirtingByMaterial[matA]) skirtingByMaterial[matA] = { meters: 0, elbows: 0 }
    skirtingByMaterial[matA].elbows += 1
  })

  cabinets.forEach(c => {
    if (c.ledStripInterior) ledStripMeters += c.height / 1000
    if (c.ledStripUnder) ledStripMeters += c.width / 1000
    const carcassMat = c.carcassMaterialName || c.material || 'Carcass'
    const frontMat = c.frontMaterialName || 'Front'
    if (!isCarcassCabinet(c)) {
      if (APPLIANCE_SUBTYPES.includes(c.subtype)) return // purchased appliance, not a manufactured piece
      // Filler/Panel/etc: one piece at its actual dimensions, no formula run
      const isPanel = c.subtype === 'Side Panel'
      const pieceDepth = isPanel ? (c.depth || 581) : c.width
      const pieceTh = isPanel ? (c.panelThickness || c.frontMaterialThickness || 18) : 18
      const key = `${c.height}×${pieceDepth}×${pieceTh}|${frontMat}|piece-${c.subtype}`
      if (!masterMap[key]) masterMap[key] = { name: c.subtype || 'Piece', width: c.height, depth: pieceDepth, thickness: pieceTh, material: frontMat, eb: {}, qty: 0 }
      masterMap[key].qty += 1
      return
    }
    let result
    try { result = calculateCabinet(cabinetConfig(c)) } catch { return }

    if (isShelfEligible(c) && (c.shelfCount ?? c.glassShelfCount ?? 1) > 0) {
      const shelfQty = c.shelfCount ?? c.glassShelfCount ?? 1
      const isGlassShelf = c.category === 'wall' || c.subtype === 'Open Shelf'
      const shelfW = Math.round(c.width - 40)
      const shelfD = Math.round(c.depth - 28)
      if (isGlassShelf) {
        const key = `${shelfW}×${shelfD}×8|Glass|glassshelf`
        if (!masterMap[key]) masterMap[key] = { name: 'Glass Shelf (8mm Tempered)', width: shelfW, depth: shelfD, thickness: 8, material: 'Clear Glass', eb: {}, qty: 0 }
        masterMap[key].qty += shelfQty
        shelfPinsRubber += shelfQty * 4
      } else {
        const key = `${shelfW}×${shelfD}×18|${carcassMat}|woodshelf`
        if (!masterMap[key]) masterMap[key] = { name: 'Shelf', width: shelfW, depth: shelfD, thickness: 18, material: carcassMat, eb: {}, qty: 0 }
        masterMap[key].qty += shelfQty
        shelfPinsStandard += shelfQty * 4
      }
    }

    if (['base', 'vanity', 'corner', 'tall'].includes(c.category) && (c.elevation || 0) === 0 && c.skirtingSides && c.skirtingSides.length > 0) {
      const matKey = c.skirtingMaterial || 'match_countertop'
      if (!skirtingByMaterial[matKey]) skirtingByMaterial[matKey] = { meters: 0, elbows: 0 }
      c.skirtingSides.forEach(side => {
        const lengthM = (side === 'left' || side === 'right') ? (c.depth / 1000) : (c.width / 1000)
        skirtingByMaterial[matKey].meters += lengthM
      })
      const sides = c.skirtingSides
      const cornerPairs = [['front', 'left'], ['front', 'right'], ['back', 'left'], ['back', 'right']]
      cornerPairs.forEach(([a, b]) => {
        if (sides.includes(a) && sides.includes(b)) skirtingByMaterial[matKey].elbows += 1
      })
    }

    if (result.golaProfiles) {
      golaProfileMeters.L += result.golaProfiles.L_meters || 0
      golaProfileMeters.C += result.golaProfiles.C_meters || 0
    }
    if (result.hardware && result.hardware.drawer_runner_sets) {
      const sysName = result.hardware.drawer_system || 'Unspecified'
      drawerSystems[sysName] = (drawerSystems[sysName] || 0) + result.hardware.drawer_runner_sets
    }
    if (result.drawerFronts) {
      result.drawerFronts.forEach(d => {
        const eb = getEdgeBanding('Door', c.carcassColor, c.frontColor, carcassMat, frontMat)
        const mat = c.frontMaterialName || 'Front material'
        const key = `${d.width}×${d.height}×18|${mat}|drawerfront`
        if (!masterMap[key]) masterMap[key] = { name: 'Drawer front', width: d.width, depth: d.height, thickness: 18, material: mat, eb, qty: 0 }
        masterMap[key].qty += 1
      })
    }
    if (result.drawerBox && result.drawerBox.parts_per_drawer) {
      result.drawerBox.parts_per_drawer.forEach(p => {
        const isHdf = p.name.includes('HDF')
        const mat = isHdf ? 'HDF 8mm' : 'Drawer box 12mm'
        const key = `${p.width}×${p.depth}×${isHdf ? 8 : 12}|${mat}|drawerbox`
        if (!masterMap[key]) masterMap[key] = { name: p.name, width: p.width, depth: p.depth, thickness: isHdf ? 8 : 12, material: mat, eb: {}, qty: 0 }
        masterMap[key].qty += p.qty * (result.drawerBox.count || 1)
      })
    }

    result.panels.forEach(p => {
      const mat = p.name.includes('Back') ? 'HDF 8mm' : carcassMat
      const eb = getEdgeBanding(p.name, c.carcassColor, c.frontColor, carcassMat, frontMat)
      const key = `${p.width}×${p.depth}×${p.thickness}|${mat}|${JSON.stringify(eb)}`
      if (!masterMap[key]) masterMap[key] = { ...p, material: mat, eb, qty: 0, name: p.name }
      masterMap[key].qty += p.qty
    })

    result.doors.forEach(d => {
      const eb = getEdgeBanding('Door', c.carcassColor, c.frontColor, carcassMat, frontMat)
      const mat = c.frontMaterialName || 'Front material'
      const key = `${d.width}×${d.height}×18|${mat}|door`
      if (!masterMap[key]) masterMap[key] = { name: 'Door/Front', width: d.width, depth: d.height, thickness: 18, material: mat, eb, qty: 0 }
      masterMap[key].qty += 1
    })
  })

  const rows = Object.values(masterMap).sort((a, b) => {
    if (a.thickness !== b.thickness) return b.thickness - a.thickness
    return a.material.localeCompare(b.material)
  })

  return (
    <div style={{ marginTop: 24, marginBottom: 32 }}>
      <div onClick={() => setExpanded(p => !p)}
        style={{ fontWeight: 700, fontSize: 15, color: DARK, marginBottom: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>🏭 Master Cut List (Workshop)</span>
        <span style={{ color: ACCENT, fontSize: 14 }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <>
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  {['#', 'Part', 'W (mm)', 'H (mm)', 'Thick', 'Material', 'Qty', 'Edge Banding (T/B/L/R)'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#888' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F7F4F0', background: i % 2 === 0 ? '#fff' : '#FDFAF6' }}>
                    <td style={{ padding: '8px 12px', fontSize: 11, color: '#bbb', fontWeight: 600 }}>{String(i+1).padStart(2,'0')}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: DARK }}>{r.name}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: 'monospace' }}>{r.width}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: 'monospace' }}>{r.depth}</td>
                    <td style={{ padding: '8px 12px', fontSize: 11, color: '#666' }}>{r.thickness}mm{r.thickness===8?' HDF':''}</td>
                    <td style={{ padding: '8px 12px', fontSize: 11, color: '#666' }}>{r.material}</td>
                    <td style={{ padding: '8px 12px', fontSize: 14, fontWeight: 800, color: ACCENT }}>{r.qty}</td>
                    <td style={{ padding: '8px 12px' }}><EBCell eb={r.eb} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {Object.entries(skirtingByMaterial).map(([matKey, data]) => {
            const labels = { match_countertop: 'Skirting — Match Countertop', pvc_black: 'Skirting — PVC Black', pvc_champagne: 'Skirting — PVC Champagne', pvc_silver: 'Skirting — PVC Silver' }
            return (
              <div key={matKey} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
                <span style={{ fontSize: 20 }}>📏</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: DARK }}>{labels[matKey] || 'Skirting Board'}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Covers adjustable legs on selected sides</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right', display: 'flex', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{data.meters.toFixed(2)} m</div>
                    <div style={{ fontSize: 11, color: '#888' }}>linear meters</div>
                  </div>
                  {data.elbows > 0 && (
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{data.elbows}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>corner elbows</div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {ledStripMeters > 0 && (
            <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
              <span style={{ fontSize: 20 }}>💡</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: DARK }}>LED Strip Lighting</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Aluminum channel + diffuser, 18.6×12.5mm profile</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{ledStripMeters.toFixed(2)} m</div>
                <div style={{ fontSize: 11, color: '#888' }}>linear meters</div>
              </div>
            </div>
          )}

          {(shelfPinsStandard > 0 || shelfPinsRubber > 0) && (
            <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
              <span style={{ fontSize: 20 }}>🔩</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: DARK }}>Shelf Support Pins</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>4 pins per shelf — rubber-tipped for glass, standard for wood</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right', display: 'flex', gap: 20 }}>
                {shelfPinsStandard > 0 && (
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{shelfPinsStandard}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>standard</div>
                  </div>
                )}
                {shelfPinsRubber > 0 && (
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{shelfPinsRubber}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>rubber-tipped</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {golaProfileMeters.L > 0 && (
            <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
              <span style={{ fontSize: 20 }}>🪛</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: DARK }}>Gola Profile — L Shape</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Under-worktop channel (Richelieu art.1005 milling)</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{golaProfileMeters.L.toFixed(2)} m</div>
                <div style={{ fontSize: 11, color: '#888' }}>linear meters</div>
              </div>
            </div>
          )}
          {golaProfileMeters.C > 0 && (
            <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
              <span style={{ fontSize: 20 }}>🪛</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: DARK }}>Gola Profile — C Shape</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Drawer stack channel (Richelieu art.1004 milling)</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{golaProfileMeters.C.toFixed(2)} m</div>
                <div style={{ fontSize: 11, color: '#888' }}>linear meters</div>
              </div>
            </div>
          )}
          {Object.entries(drawerSystems).map(([sysName, sets]) => (
            <div key={sysName} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
              <span style={{ fontSize: 20 }}>🗄️</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: DARK }}>Drawer Runners — {sysName}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>One set per drawer (bottom drawer of Gola stacks: TIP-ON)</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{sets}</div>
                <div style={{ fontSize: 11, color: '#888' }}>runner sets</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function aggregateBOM(cabinets) {
  const totals = { sheet18: 0, hdf8: 0, edgeM: 0, hinges: 0, legs: 0, confirmats: 0, dowels: 0, backScrews: 0, handles: 0 }
  cabinets.forEach(cab => {
    if (!isCarcassCabinet(cab)) return
    try {
      const r = calculateCabinet(cabinetConfig(cab))
      totals.sheet18    += r.panels.filter(p => p.thickness === 18).reduce((s, p) => s + (p.width * p.depth * p.qty / 1e6), 0)
      totals.hdf8       += r.panels.filter(p => p.thickness === 8).reduce((s, p)  => s + (p.width * p.depth * p.qty / 1e6), 0)
      totals.edgeM      += (2 * cab.height + (cab.width - 36) + r.doors.reduce((s, d) => s + 2 * (d.width + d.height), 0)) / 1000
      totals.hinges     += r.doors.reduce((s, d) => s + d.hinges, 0)
      totals.legs       += r.hardware.legs
      totals.confirmats += r.hardware.confirmats
      totals.dowels     += r.hardware.dowels
      totals.backScrews += r.hardware.back_screws
      totals.handles    += r.hardware.handles
    } catch {}
  })
  Object.keys(totals).forEach(k => { totals[k] = parseFloat(totals[k].toFixed(2)) })
  return totals
}

function LinkProjectModal({ onClose, onLinked }) {
  const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'
  const [step, setStep] = useState('client') // client -> project -> room
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const [showNewClient, setShowNewClient] = useState(false)
  const [clientForm, setClientForm] = useState({ name: '', phone: '', email: '', address: '', company: '' })

  const [showNewProject, setShowNewProject] = useState(false)
  const [projectForm, setProjectForm] = useState({ name: '', address: '', notes: '', status: 'DRAFT' })

  const [roomForm, setRoomForm] = useState({ name: 'Kitchen', room_type: 'kitchen', notes: '' })
  const [existingRooms, setExistingRooms] = useState([])
  const [showNewRoom, setShowNewRoom] = useState(false)

  useEffect(() => {
    authFetch(API + '/api/crm/clients/').then(r => r.json()).then(d => setClients(Array.isArray(d) ? d : (d.results || []))).catch(() => {})
  }, [])

  const pickClient = async (client) => {
    setSelectedClient(client)
    setBusy(true); setErr('')
    try {
      const res = await authFetch(API + `/api/crm/projects/?client=${client.id}`)
      const d = await res.json()
      setProjects(Array.isArray(d) ? d : (d.results || []))
      setStep('project')
    } catch { setErr('Could not load projects') }
    setBusy(false)
  }

  const createClient = async () => {
    if (!clientForm.name.trim()) return
    setBusy(true); setErr('')
    try {
      const res = await authFetch(API + '/api/crm/clients/', { method: 'POST', body: JSON.stringify(clientForm) })
      if (res.ok) { const client = await res.json(); setShowNewClient(false); await pickClient(client) }
      else setErr('Could not create client')
    } catch { setErr('Could not create client') }
    setBusy(false)
  }

  const pickProject = async (project) => {
    setSelectedProject(project)
    setBusy(true); setErr('')
    try {
      const res = await authFetch(API + `/api/crm/rooms/?project=${project.id}`)
      const d = await res.json()
      const rooms = Array.isArray(d) ? d : (d.results || [])
      setExistingRooms(rooms)
      setShowNewRoom(rooms.length === 0)
      setStep('room')
    } catch { setErr('Could not load rooms'); setStep('room') }
    setBusy(false)
  }

  const pickExistingRoom = (room) => { onLinked(selectedProject.id, room.id, room.name) }

  const createProject = async () => {
    if (!projectForm.name.trim()) return
    setBusy(true); setErr('')
    try {
      const res = await authFetch(API + '/api/crm/projects/', { method: 'POST', body: JSON.stringify({ ...projectForm, client: selectedClient.id }) })
      if (res.ok) { const project = await res.json(); setShowNewProject(false); pickProject(project) }
      else setErr('Could not create project')
    } catch { setErr('Could not create project') }
    setBusy(false)
  }

  const createRoomAndLink = async () => {
    if (!roomForm.name.trim()) return
    if (existingRooms.some(r => r.name.trim().toLowerCase() === roomForm.name.trim().toLowerCase())) {
      setErr('A room with this name already exists in this project — pick it from the list instead.')
      return
    }
    setBusy(true); setErr('')
    try {
      const res = await authFetch(API + '/api/crm/rooms/', { method: 'POST', body: JSON.stringify({ ...roomForm, project: selectedProject.id }) })
      if (res.ok) { const room = await res.json(); onLinked(selectedProject.id, room.id, room.name) }
      else setErr('Could not create room')
    } catch { setErr('Could not create room') }
    setBusy(false)
  }

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
  const box = { background: '#fff', borderRadius: 10, padding: 24, width: 420, maxHeight: '80vh', overflowY: 'auto' }
  const row = { padding: '10px 12px', border: '1px solid #E0DAD4', borderRadius: 6, marginBottom: 8, cursor: 'pointer', fontSize: 13 }
  const input = { width: '100%', padding: '8px 10px', border: '1px solid #E0DAD4', borderRadius: 6, marginBottom: 8, fontSize: 13, boxSizing: 'border-box' }
  const btn = { padding: '8px 14px', borderRadius: 6, border: 'none', background: '#C8902A', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
  const btnGhost = { ...btn, background: '#fff', color: '#555', border: '1px solid #E0DAD4' }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Link this design to save it</h3>
        <p style={{ fontSize: 12, color: '#888', marginTop: -8 }}>Select or create a Customer → Project → Room before saving.</p>
        {err && <div style={{ color: '#c0392b', fontSize: 12, marginBottom: 8 }}>{err}</div>}

        {step === 'client' && !showNewClient && (
          <>
            {clients.map(cl => (
              <div key={cl.id} style={row} onClick={() => pickClient(cl)}>{cl.name}</div>
            ))}
            <button style={{ ...btnGhost, marginTop: 8 }} onClick={() => setShowNewClient(true)}>+ New Customer</button>
          </>
        )}
        {step === 'client' && showNewClient && (
          <>
            <input style={input} placeholder="Customer name" value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))} />
            <input style={input} placeholder="Phone" value={clientForm.phone} onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))} />
            <input style={input} placeholder="Address" value={clientForm.address} onChange={e => setClientForm(f => ({ ...f, address: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btn} disabled={busy} onClick={createClient}>{busy ? '...' : 'Create & Continue'}</button>
              <button style={btnGhost} onClick={() => setShowNewClient(false)}>Cancel</button>
            </div>
          </>
        )}

        {step === 'project' && !showNewProject && (
          <>
            {projects.map(pr => (
              <div key={pr.id} style={row} onClick={() => pickProject(pr)}>{pr.name}</div>
            ))}
            <button style={{ ...btnGhost, marginTop: 8 }} onClick={() => setShowNewProject(true)}>+ New Project</button>
            <div><button style={{ ...btnGhost, marginTop: 8 }} onClick={() => setStep('client')}>← Back</button></div>
          </>
        )}
        {step === 'project' && showNewProject && (
          <>
            <input style={input} placeholder="Project name" value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} />
            <input style={input} placeholder="Address" value={projectForm.address} onChange={e => setProjectForm(f => ({ ...f, address: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btn} disabled={busy} onClick={createProject}>{busy ? '...' : 'Create & Continue'}</button>
              <button style={btnGhost} onClick={() => setShowNewProject(false)}>Cancel</button>
            </div>
          </>
        )}

        {step === 'room' && !showNewRoom && (
          <>
            {existingRooms.map(rm => (
              <div key={rm.id} style={row} onClick={() => pickExistingRoom(rm)}>{rm.name} <span style={{ color: '#999', fontSize: 11 }}>({rm.room_type})</span></div>
            ))}
            <button style={{ ...btnGhost, marginTop: 8 }} onClick={() => setShowNewRoom(true)}>+ New Room</button>
            <div><button style={{ ...btnGhost, marginTop: 8 }} onClick={() => setStep('project')}>← Back</button></div>
          </>
        )}
        {step === 'room' && showNewRoom && (
          <>
            <input style={input} placeholder="Room name" value={roomForm.name} onChange={e => setRoomForm(f => ({ ...f, name: e.target.value }))} />
            <select style={input} value={roomForm.room_type} onChange={e => setRoomForm(f => ({ ...f, room_type: e.target.value }))}>
              <option value="kitchen">Kitchen</option>
              <option value="closet">Closet</option>
              <option value="bathroom">Bathroom</option>
              <option value="other">Other</option>
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btn} disabled={busy} onClick={createRoomAndLink}>{busy ? 'Saving…' : 'Create Room & Save'}</button>
              {existingRooms.length > 0 && <button style={btnGhost} onClick={() => setShowNewRoom(false)}>← Existing rooms</button>}
              <button style={btnGhost} onClick={() => setStep('project')}>← Project</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function KitchenPlannerModule({ roomId: initialRoomId, roomName: initialRoomName, roomType, projectId: initialProjectId, initialData, onBack } = {}) {
  const [roomId, setRoomId] = useState(initialRoomId)
  const [roomName, setRoomName] = useState(initialRoomName)
  const [projectId, setProjectId] = useState(initialProjectId)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [pendingSave, setPendingSave] = useState(false)
  const [projectName, setProjectName]         = useState('Untitled Kitchen')
  const [editingName, setEditingName]         = useState(false)
  const [cabinets, setCabinets]               = useState([])
  const [elements, setElements]               = useState([])
  const [selected, setSelected]               = useState(null)
  const [selectedType, setSelectedType]       = useState(null)
  const [room, setRoom]                       = useState({ width: 4000, depth: 3000 })
  const [tab, setTab]                         = useState('room')
  const [showGrid, setShowGrid]               = useState(true)
  const [showDimensions, setShowDimensions]   = useState(true)
  const [sending, setSending]                 = useState(false)
  const [sentMsg, setSentMsg]                 = useState('')
  const [saving, setSaving]                   = useState(false)
  const [savedMsg, setSavedMsg]               = useState('')
  const [wallThickness, setWallThickness]     = useState(120)
  const [walls, setWalls]                     = useState([])
  const [backsplashSegments, setBacksplashSegments] = useState([])
  const [backsplashHeight, setBacksplashHeight] = useState(50)
  const [backsplashThickness, setBacksplashThickness] = useState(20)
  const [floorTile, setFloorTile]             = useState('white_large')
  const [baseHeight, setBaseHeight]           = useState(null)
  const [projectDefaults, setProjectDefaults] = useState(null)
  const [countertopMat, setCountertopMat]     = useState(COUNTERTOP_MATERIALS.find(m => m.id === 'sil_white_storm') || COUNTERTOP_MATERIALS[0])
  const [countertopThickness, setCountertopThickness] = useState(30)
  const [grandTotal, setGrandTotal] = useState(0)
  const textureMap = useMaterialTextureMap()
  const [availableDrawerSystems, setAvailableDrawerSystems] = useState([])
  useEffect(() => {
    const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'
    authFetch(API + '/api/inventory/drawer-systems/')
      .then(r => r.json())
      .then(data => setAvailableDrawerSystems(Array.isArray(data) ? data : (data.results || [])))
      .catch(() => {})
  }, [])


  // Restore saved data on mount
  React.useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      if (initialData.walls) setWalls(initialData.walls)
      if (initialData.backsplashSegments) setBacksplashSegments(initialData.backsplashSegments)
      if (initialData.backsplashHeight) setBacksplashHeight(initialData.backsplashHeight)
      if (initialData.backsplashThickness) setBacksplashThickness(initialData.backsplashThickness)
      if (initialData.elements) setElements(initialData.elements)
      if (initialData.cabinets) setCabinets(initialData.cabinets)
      if (initialData.projectName) setProjectName(initialData.projectName)
      if (initialData.baseHeight) setBaseHeight(initialData.baseHeight)
      if (initialData.projectDefaults) setProjectDefaults(initialData.projectDefaults)
      if (initialData.grandTotal) setGrandTotal(initialData.grandTotal)
      if (initialData.countertopMat) setCountertopMat(initialData.countertopMat)
      if (initialData.countertopThickness) setCountertopThickness(initialData.countertopThickness)
    }
  }, [initialData])

  const addCabinet = useCallback((t) => {
    const cab = {
      ...t,
      id: Date.now(),
      x: snap(200), y: snap(200),
      material: 'Particleboard',
      doorStyle:         t.doorStyle         || projectDefaults?.doorStyle         || 'Handle',
      carcassColor:      t.carcassColor      || projectDefaults?.carcassColor      || '#F5F0E8',
      frontColor:        t.frontColor        || projectDefaults?.frontColor        || '#FFFFFF',
      frontMaterial:     t.frontMaterial     || projectDefaults?.frontFinish       || 'matt',
      frontMaterialCode: t.frontMaterialCode || projectDefaults?.frontMaterialCode || null,
      frontMaterialName: t.frontMaterialName || projectDefaults?.frontMaterialName || null,
      frontTextureUrl:   t.frontTextureUrl   || projectDefaults?.frontTextureUrl   || null,
      frontMaterialThickness: t.frontMaterialThickness || projectDefaults?.frontMaterialThickness || 18,
      drawerSystem: t.drawerSystem || projectDefaults?.drawerSystem || 'Local Bearing',
      drawerBoxConstruction: t.drawerBoxConstruction || projectDefaults?.drawerBoxConstruction || 'wood_box',
      zonePreset: null,
      skirtingSides: ['front'],
      skirtingMaterial: projectDefaults?.skirtingMaterial || 'match_countertop',
      baseHeight: baseHeight || 800,
    }
    if (t.subtype === 'Side Panel') {
      const th = cab.frontMaterialThickness || 18
      cab.panelThickness = th
      cab.width = th
      cab.depth = (t.category === 'wall' ? 300 : 560) + th + 3
    }
    setCabinets(p => [...p, cab])
    setSelected(cab.id)
    setSelectedType('cabinet')
  }, [projectDefaults, baseHeight])

  const addElement = (t) => {
    const el = { ...t, id: Date.now() + 1, x: snap(300), y: snap(100) }
    setElements(p => [...p, el])
    setSelected(el.id)
    setSelectedType('element')
  }

  const updateCab = (key, val) => setCabinets(p => p.map(c => c.id === selected ? { ...c, [key]: val } : c))
  const updateEl  = (key, val) => setElements(p => p.map(e => e.id === selected ? { ...e, [key]: val } : e))
  // Applies every field from a chosen catalog Sink onto the selected cabinet in
  // one update — drives the 3D render, BOM fabrication spec, and Proposal/Contract.
  const applySink = (sink) => setCabinets(p => p.map(c => c.id === selected ? {
    ...c,
    sinkId: sink.id,
    sinkBrand: sink.brand,
    sinkModel: sink.model_name,
    sinkMaterial: sink.material,
    sinkColor: sink.color,
    sinkColorHex: sink.color_hex,
    sinkCavityCount: sink.cavity_count,
    sinkWidthMm: sink.width_mm,
    sinkDepthMm: sink.depth_mm,
    sinkBowlDepthMm: sink.bowl_depth_mm,
    sinkCutoutWidthMm: sink.cutout_width_mm,
    sinkCutoutDepthMm: sink.cutout_depth_mm,
    sinkPrice: sink.price,
    sinkRoughness: sink.roughness,
    sinkMetalness: sink.metalness,
  } : c))

  const selCab = cabinets.find(c => c.id === selected && selectedType === 'cabinet')
  const selEl  = elements.find(e => e.id === selected && selectedType === 'element')
  const bom    = aggregateBOM(cabinets)

  const saveProject = async () => {
    setSaving(true); setSavedMsg('')
    const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'
    try {
      const plannerData = { walls, elements, cabinets, projectName, baseHeight, projectDefaults: projectDefaults ? { ...projectDefaults } : null, grandTotal, countertopMat, countertopThickness, backsplashSegments, backsplashHeight, backsplashThickness }
      if (roomId) {
        const res = await authFetch(API + `/api/crm/rooms/${roomId}/`, {
          method: 'PATCH',
          body: JSON.stringify({ planner_data: plannerData, ...(grandTotal > 0 ? { grand_total: Math.round(grandTotal * 100) / 100 } : {}) })
        })
        if (res.ok && projectId) {
          // fetch all rooms for this project and sum grand totals
          const roomsRes = await authFetch(API + `/api/crm/rooms/?project=${projectId}`, {})
          const roomsData = await roomsRes.json()
          const rooms = Array.isArray(roomsData) ? roomsData : (roomsData.results || [])
          // sum all rooms except current one, then add current grandTotal
          const totalValue = rooms
            .filter(r => String(r.id) !== String(roomId))
            .reduce((s, r) => s + parseFloat(r.grand_total || 0), 0) + grandTotal
          await authFetch(API + `/api/crm/projects/${projectId}/`, {
            method: 'PATCH',
            body: JSON.stringify({ total_value: totalValue.toFixed(2) })
          })
        }
        setSavedMsg(res.ok ? '✓ Saved' : '✗ Failed')
      } else {
        setSaving(false)
        setShowLinkModal(true)
        return
      }
    } catch(err) { console.error('SAVE ERROR:', err); setSavedMsg('✗ No connection') }
    setSaving(false)
    setTimeout(() => setSavedMsg(''), 3000)
  }

  // After the link-to-project modal creates a Room, auto-run the save once roomId lands
  useEffect(() => {
    if (pendingSave && roomId) { setPendingSave(false); saveProject() }
  }, [pendingSave, roomId])

  const handleLinked = (newProjectId, newRoomId, newRoomName) => {
    setProjectId(newProjectId)
    setRoomName(newRoomName)
    setShowLinkModal(false)
    setPendingSave(true)
    setRoomId(newRoomId)
  }

  const sendToERP = async () => {
    if (!cabinets.length) return
    setSending(true); setSentMsg('')
    const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'
    const orderNumber = 'WO-' + Date.now()
    try {
      let customerName = 'N/A'
      if (projectId) {
        try {
          const pRes = await authFetch(API + `/api/crm/projects/${projectId}/`)
          if (pRes.ok) {
            const pData = await pRes.json()
            customerName = pData.client_name || 'N/A'
          }
        } catch {}
      }

      // Find prior work orders for this room and the cabinet ids already sent
      let alreadySentIds = []
      let isBackOrder = false
      if (roomId) {
        try {
          const priorRes = await authFetch(API + `/api/manufacturing/work-orders/?room_id_ref=${roomId}`)
          if (priorRes.ok) {
            const priorData = await priorRes.json()
            const priorOrders = Array.isArray(priorData) ? priorData : (priorData.results || [])
            priorOrders.forEach(o => { alreadySentIds = alreadySentIds.concat(o.sent_cabinet_ids || []) })
            isBackOrder = priorOrders.length > 0
          }
        } catch {}
      }

      const newCabinets = cabinets.filter(c => !alreadySentIds.includes(c.id))

      if (newCabinets.length === 0) {
        setSentMsg('✓ Already sent — no new cabinets to add')
        setSending(false)
        return
      }

      const res = await authFetch(API + '/api/manufacturing/work-orders/', {
        method: 'POST',
        body: JSON.stringify({
          order_number: orderNumber,
          product_name: projectName + ' — ' + (roomName || 'Room') + (isBackOrder ? ' (Back Order)' : '') + ' (' + newCabinets.length + ' cabinets)',
          customer_name: customerName,
          quantity: newCabinets.length,
          status: 'NEW',
          room_id_ref: roomId || null,
          is_back_order: isBackOrder,
          sent_cabinet_ids: newCabinets.map(c => c.id),
        })
      })

      if (res.ok) {
        const wo = await res.json()

        // Build master cut-list items (panels grouped by size+material+thickness) — NEW cabinets only
        const masterMap = {}
              newCabinets.forEach(c => {
          if (!isCarcassCabinet(c)) return
          let result
          try { result = calculateCabinet(cabinetConfig(c)) } catch { return }
          const carcassMat = c.carcassMaterialName || c.material || 'Carcass'
          result.panels.forEach(p => {
            const mat = p.name.includes('Back') ? 'HDF 8mm' : carcassMat
            const key = `${p.name}|${p.width}x${p.depth}x${p.thickness}|${mat}`
            if (!masterMap[key]) masterMap[key] = { desc: `${p.name} ${p.width}x${p.depth}x${p.thickness}mm (${mat})`, qty: 0, unit: 'pcs' }
            masterMap[key].qty += p.qty
          })
          result.doors.forEach(d => {
            const frontMat = c.frontMaterialName || 'Front'
            const key = `Door|${d.width}x${d.height}x18|${frontMat}`
            if (!masterMap[key]) masterMap[key] = { desc: `Door/Front ${d.width}x${d.height}x18mm (${frontMat})`, qty: 0, unit: 'pcs' }
            masterMap[key].qty += 1
          })
        })

        const items = Object.values(masterMap)

        for (const item of items) {
          try {
            await authFetch(API + '/api/manufacturing/work-order-items/', {
              method: 'POST',
              body: JSON.stringify({ work_order: wo.id, description: item.desc, quantity: Math.ceil(item.qty), unit: item.unit })
            })
          } catch {}
        }

        setSentMsg('✓ ' + (isBackOrder ? 'Back Order ' : 'Work Order ') + orderNumber + ' sent! (' + newCabinets.length + ' new cabinets)')
      } else {
        setSentMsg('✗ Failed (' + res.status + ')')
      }
    } catch { setSentMsg('✗ Cannot connect') }
    setSending(false)
  }

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div style={s.topLeft}>
          {onBack && (
            <button onClick={onBack}
              style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12, marginRight: 8 }}>
              ← Back
            </button>
          )}
          {editingName ? (
            <input autoFocus value={projectName} onChange={e => setProjectName(e.target.value)}
              onBlur={() => setEditingName(false)} onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
              style={s.nameInput} />
          ) : (
            <div style={s.projectName} onClick={() => setEditingName(true)}>
              {projectName} <span style={{ color: '#888', fontSize: 12 }}>✎</span>
            </div>
          )}
          <span style={s.cabCount}>{cabinets.length} cabinet{cabinets.length !== 1 ? 's' : ''}</span>
          {baseHeight && (
            <span style={{ fontSize: 10, color: '#888', background: 'rgba(255,255,255,0.08)', padding: '2px 7px', borderRadius: 4 }}>
              H{baseHeight}
            </span>
          )}
        </div>
        <div style={s.tabs}>
          {[
            ['room',     '📐 Room'],
            ['planner',  '🗄 Cabinets'],
            ['bom',      '📋 BOM'],
            ['3d',       '🎮 3D'],
            ['proposal', '💰 Proposal'],
            ['contract', '📝 Contract'],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ ...s.tab, ...(tab === id ? s.tabActive : {}) }}>
              {label}
            </button>
          ))}
        </div>
        <div style={s.topRight}>
          {baseHeight && (
            <button onClick={() => { setProjectDefaults(p => p ? { ...p, baseHeight } : p); setBaseHeight(null) }}
              style={{ ...s.saveBtn, fontSize: 11, color: '#888' }}>
              ⚙ H{baseHeight}mm
            </button>
          )}
          {projectDefaults && (
            <select
              value={projectDefaults.skirtingMaterial || 'match_countertop'}
              onChange={e => {
                const newMat = e.target.value
                setProjectDefaults(p => ({ ...p, skirtingMaterial: newMat }))
                setCabinets(prev => prev.map(c => ({ ...c, skirtingMaterial: newMat })))
              }}
              style={{ ...s.saveBtn, fontSize: 11, color: '#888', cursor: 'pointer' }}>
              <option value="match_countertop">🪨 Skirting: Countertop</option>
              <option value="pvc_black">⬛ Skirting: PVC Black</option>
              <option value="pvc_champagne">🟫 Skirting: PVC Champagne</option>
              <option value="pvc_silver">⬜ Skirting: PVC Silver</option>
            </select>
          )}
          <button onClick={saveProject} disabled={saving} style={s.saveBtn}>
            {saving ? 'Saving…' : savedMsg || '💾 Save'}
          </button>
        </div>
      </div>

      {showLinkModal && (
        <LinkProjectModal
          onClose={() => setShowLinkModal(false)}
          onLinked={handleLinked}
        />
      )}

      {tab === 'room' && (
        <div style={s.workspace}>
          <div style={s.leftPanel}>
<div style={s.panelSection}>
  <div style={s.panelLabel}>Room Size</div>
  <label style={s.dimLabel}>Width (mm)<input type="number" value={room.width} onChange={e => setRoom(r => ({ ...r, width: +e.target.value }))} style={s.dimInput} /></label>
  <label style={s.dimLabel}>Depth (mm)<input type="number" value={room.depth} onChange={e => setRoom(r => ({ ...r, depth: +e.target.value }))} style={s.dimInput} /></label>
  <label style={s.dimLabel}>Ceiling Height (mm)<input type="number" value={room.ceilingHeight || 2800} onChange={e => setRoom(r => ({ ...r, ceilingHeight: +e.target.value }))} style={s.dimInput} /></label>
  <label style={s.dimLabel}>Backsplash Height (mm)<input type="number" value={backsplashHeight} onChange={e => setBacksplashHeight(+e.target.value)} style={s.dimInput} /></label>
</div>

            <div style={s.panelSection}>
              <div style={s.panelLabel}>Room Elements</div>
              {ROOM_ELEMENTS.map(el => (
                <div key={el.type} onClick={() => addElement(el)} style={s.elementItem}
                  onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#E0DAD4'}>
                  <span style={{ fontSize: 18 }}>{el.icon}</span>
                  <div><div style={s.elementLabel}>{el.label}</div><div style={s.elementSize}>{el.w}×{el.h}mm</div></div>
                </div>
              ))}
            </div>
            <div style={s.panelSection}>
              <div style={s.panelLabel}>Floor Tiles</div>
              {[
                { id: 'white_large',  label: 'White Large',  color: '#F5F5F5', grout: '#ddd' },
                { id: 'marble',       label: 'Marble',       color: '#E8E0D8', grout: '#ccc' },
                { id: 'dark_slate',   label: 'Dark Slate',   color: '#4A4A4A', grout: '#333' },
                { id: 'wood_parquet', label: 'Wood Parquet', color: '#C8A96E', grout: '#B8914E' },
                { id: 'terracotta',   label: 'Terracotta',   color: '#C4703A', grout: '#A85A2A' },
                { id: 'concrete',     label: 'Concrete',     color: '#9E9E9E', grout: '#888'   },
              ].map(tile => (
                <div key={tile.id} onClick={() => setFloorTile(tile.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, marginBottom: 4, cursor: 'pointer', background: floorTile === tile.id ? '#C8902A12' : '#FAFAFA', border: `1.5px solid ${floorTile === tile.id ? '#C8902A' : '#E0DAD4'}` }}>
                  <div style={{ width: 28, height: 28, borderRadius: 4, background: tile.color, border: `2px solid ${tile.grout}`, backgroundImage: `linear-gradient(${tile.grout} 1px, transparent 1px), linear-gradient(90deg, ${tile.grout} 1px, transparent 1px)`, backgroundSize: '14px 14px', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: floorTile === tile.id ? 700 : 500, color: floorTile === tile.id ? '#C8902A' : '#555' }}>{tile.label}</span>
                </div>
              ))}
            </div>
            <div style={s.panelSection}>
              <div style={s.panelLabel}>Countertop</div>
              <CountertopPicker selected={countertopMat?.id} onSelect={mat => setCountertopMat(mat)} />
            </div>
  

<div style={s.panelSection}>
  <div style={s.panelLabel}>Countertop Thickness</div>
  {[16, 20, 30].map(t => (
    <div key={t} onClick={() => setCountertopThickness(t)}
      style={{ display: 'inline-block', marginRight: 6, marginBottom: 6, padding: '5px 10px',
        borderRadius: 6, border: `1.5px solid ${countertopThickness === t ? ACCENT : '#E0DAD4'}`,
        background: countertopThickness === t ? ACCENT+'18' : '#fff',
        color: countertopThickness === t ? ACCENT : '#555',
        fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
      {t}mm
    </div>
  ))}
</div>

            <div style={s.panelSection}>
              <div style={s.panelLabel}>View Options</div>
              <label style={s.toggle}><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} />Show grid</label>
              <label style={s.toggle}><input type="checkbox" checked={showDimensions} onChange={e => setShowDimensions(e.target.checked)} />Show dimensions</label>
            </div>
          </div>
          <div style={s.canvasWrap}>
            <RoomCanvas room={room} scale={SCALE} showGrid={showGrid} showDimensions={showDimensions}
              elements={elements} setElements={setElements} cabinets={cabinets} setCabinets={setCabinets}
              selected={selected} setSelected={setSelected} selectedType={selectedType} setSelectedType={setSelectedType}
              wallThickness={wallThickness} setWallThickness={setWallThickness}
              walls={walls} setWalls={setWalls}
              backsplashSegments={backsplashSegments} setBacksplashSegments={setBacksplashSegments} />
          </div>
          <div style={s.rightPanel}>
        {selectedType === 'backsplash' ? (() => {
          const seg = backsplashSegments.find(s => s.id === selected)
          if (!seg) return null
          const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1
          const curLenPx = Math.hypot(dx, dy)
          const lenMm = Math.round(curLenPx / SCALE)
          const fixedEnd = seg.fixedEnd || 'start'
          return (
            <div>
              <div style={s.propTitle}>🧱 Backsplash</div>
              <div style={s.propSection}>Length</div>
              <div style={{ marginBottom: 10 }}>
                <div style={s.propLabel}>Length (mm)</div>
                <input type="number" value={lenMm}
                  onChange={e => {
                    const newLenMm = +e.target.value
                    if (!newLenMm || newLenMm <= 0 || curLenPx === 0) return
                    const newLenPx = newLenMm * SCALE
                    const ux = dx / curLenPx, uy = dy / curLenPx
                    setBacksplashSegments(p => p.map(s => {
                      if (s.id !== seg.id) return s
                      if (fixedEnd === 'start') return { ...s, x2: s.x1 + ux * newLenPx, y2: s.y1 + uy * newLenPx }
                      return { ...s, x1: s.x2 - ux * newLenPx, y1: s.y2 - uy * newLenPx }
                    }))
                  }}
                  style={s.propInput} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={s.propLabel}>Fixed point (stays put when length changes)</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['start', 'end'].map(fe => (
                    <button key={fe} onClick={() => setBacksplashSegments(p => p.map(s => s.id === seg.id ? { ...s, fixedEnd: fe } : s))}
                      style={{ flex: 1, padding: '6px', border: `1.5px solid ${fixedEnd === fe ? '#C8902A' : '#E0DAD4'}`, borderRadius: 6, background: fixedEnd === fe ? '#C8902A18' : '#fff', color: fixedEnd === fe ? '#C8902A' : '#666', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      Fix {fe === 'start' ? 'Start' : 'End'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={s.propSection}>Details</div>
              <div style={{ marginBottom: 10 }}>
                <div style={s.propLabel}>Height (mm) — applies to all backsplash segments</div>
                <input type="number" value={backsplashHeight}
                  onChange={e => setBacksplashHeight(+e.target.value)}
                  style={s.propInput} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={s.propLabel}>Thickness</div>
                <div style={{ padding: '6px 8px', background: '#F5F0E8', borderRadius: 6, fontSize: 12, color: '#8B5E3C', fontWeight: 600 }}>
                  {backsplashThickness}mm
                </div>
              </div>
              <button onClick={() => { setBacksplashSegments(p => p.filter(s => s.id !== seg.id)); setSelected(null); setSelectedType(null) }}
                style={{ padding: '6px 12px', background: '#FEF2F2', color: '#E74C3C', border: '1.5px solid #FECACA', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                🗑 Delete
              </button>
            </div>
          )
        })() : selEl ? (
  <div>
    <div style={s.propTitle}>{selEl.icon} {selEl.label}</div>

    <div style={s.propSection}>Dimensions</div>
    <div style={{ marginBottom: 10 }}><div style={s.propLabel}>Width (mm)</div><input type="number" value={selEl.w} onChange={e => updateEl('w', +e.target.value)} style={s.propInput} /></div>
    <div style={{ marginBottom: 10 }}><div style={s.propLabel}>Height (mm)</div><input type="number" value={selEl.h} onChange={e => updateEl('h', +e.target.value)} style={s.propInput} /></div>

    <div style={s.propSection}>Position</div>

    {/* Surface toggle */}
    <div style={{ marginBottom: 10 }}>
      <div style={s.propLabel}>Surface</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {['wall', 'floor'].map(surface => (
          <button key={surface} onClick={() => updateEl('surface', surface)}
            style={{ flex: 1, padding: '6px', border: `1.5px solid ${(selEl.surface || 'wall') === surface ? ACCENT : '#E0DAD4'}`,
              borderRadius: 6, background: (selEl.surface || 'wall') === surface ? ACCENT+'18' : '#fff',
              color: (selEl.surface || 'wall') === surface ? ACCENT : '#666',
              fontSize: 11, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
            {surface === 'wall' ? '🧱 Wall' : '⬛ Floor'}
          </button>
        ))}
      </div>
    </div>

    {selEl.embeddedInWall && walls[selEl.wallIndex] !== undefined ? (() => {
      const w = walls[selEl.wallIndex]
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1
      const wallLenPx = Math.hypot(dx, dy)
      const wallLenMm = Math.round(wallLenPx / SCALE)
      const ux = dx / wallLenPx, uy = dy / wallLenPx
      const ex = selEl.x * SCALE - w.x1, ey = selEl.y * SCALE - w.y1
      const distPxCenter = ex * ux + ey * uy
      const distMmCenter = distPxCenter / SCALE
      // Measured from the wall's visual start corner to the element's CENTER.
      // The wall renders with strokeLinecap="square", which visually extends the wall
      // by half ITS OWN thickness past the stored endpoint (w.x1) — so the true visual
      // corner sits wallThickness/2 further back than w.x1.
      const distMm = Math.round(distMmCenter + wallThickness / 2)
      return (
        <>
          <div style={{ marginBottom: 6, padding: '6px 8px', background: '#F0FFF4', borderRadius: 6, fontSize: 11, color: '#2AC87A', fontWeight: 600 }}>
            ✓ Wall {(selEl.wallIndex || 0) + 1} · {wallLenMm}mm long
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={s.propLabel}>Distance from wall start (mm)</div>
            <input type="number" value={distMm} min={0} max={Math.max(0, wallLenMm + wallThickness)}
              onChange={e => {
                const newDistMmCenter = (+e.target.value) - wallThickness / 2
                const newDistPx = newDistMmCenter * SCALE
                const newX = (w.x1 + ux * newDistPx) / SCALE
                const newY = (w.y1 + uy * newDistPx) / SCALE
                updateEl('x', newX)
                updateEl('y', newY)
              }}
              style={s.propInput} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={s.propLabel}>Elevation from floor (mm)</div>
            <input type="number" value={selEl.elevation || 0}
              onChange={e => updateEl('elevation', +e.target.value)}
              style={s.propInput} />
          </div>
        </>
      )
    })() : (
      <>
        <div style={{ marginBottom: 10 }}>
          <div style={s.propLabel}>Distance from left (mm)</div>
          <input type="number" value={Math.round((selEl.x || 0))}
            onChange={e => updateEl('x', +e.target.value)}
            style={s.propInput} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={s.propLabel}>Distance from top (mm)</div>
          <input type="number" value={Math.round((selEl.y || 0))}
            onChange={e => updateEl('y', +e.target.value)}
            style={s.propInput} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={s.propLabel}>Elevation from floor (mm)</div>
          <input type="number" value={selEl.elevation || 0}
            onChange={e => updateEl('elevation', +e.target.value)}
            style={s.propInput} />
        </div>
      </>
    )}


    {selEl.type !== 'window' && selEl.type !== 'door' && (
      <div style={{ marginBottom: 10 }}>
        <div style={s.propLabel}>Rotation (°)</div>
        <input type="number" min={0} max={359} value={selEl.rotation || 0}
          onChange={e => updateEl('rotation', (+e.target.value + 360) % 360)} style={s.propInput} />
      </div>
    )}

    <button onClick={() => { setElements(p => p.filter(e => e.id !== selected)); setSelected(null) }} style={s.deleteBtn}>Delete</button>
  </div>

            ) : (
              <div style={s.emptyProp}><div style={{ fontSize: 28, marginBottom: 8 }}>👆</div>Click any element to edit</div>
            )}
          </div>
        </div>
      )}

      {tab === 'planner' && (
        <div style={s.workspace}>
          <div style={{ ...s.leftPanel, width: 220, padding: 0 }}>
            <CabinetCatalog
              baseHeight={baseHeight}
              projectDefaults={projectDefaults}
              onSetupComplete={(setup) => {
                setBaseHeight(setup.baseHeight)
                setProjectDefaults({
                  doorStyle:         setup.doorStyle,
                  golaColor:         setup.golaColor,
                  handlePos:         setup.handlePos,
                  carcassColor:      setup.carcassColor,
                  frontColor:        setup.frontColor,
                  frontFinish:       setup.frontFinish,
                  frontMaterialCode: setup.frontMaterialCode || null,
                  frontMaterialThickness: setup.frontMaterialThickness || 18,
                  drawerSystem: setup.drawerSystem || 'Local Bearing',
                  drawerBoxConstruction: setup.drawerBoxConstruction || 'wood_box',
                  skirtingMaterial:  setup.skirtingMaterial  || 'match_countertop',
                })
                // Retroactively resize all existing base cabinets to the new height,
                // and stamp baseHeight onto ALL cabinets (base + tall) so the 3D view
                // can derive correct leg height (720->150mm legs, 800->80mm legs)
                // regardless of the cabinet's own box height.
                setCabinets(prev => prev.map(c => ({
                  ...c,
                  ...(c.category === 'base' ? { height: setup.baseHeight } : {}),
                  baseHeight: setup.baseHeight,
                  doorStyle: setup.doorStyle,
                  golaColor: setup.golaColor,
                  handlePos: setup.handlePos,
                  carcassColor: setup.carcassColor,
                  frontColor: setup.frontColor,
                  frontMaterial: setup.frontFinish,
                  frontMaterialCode: setup.frontMaterialCode || null,
                  frontMaterialThickness: setup.frontMaterialThickness || 18,
                  drawerSystem: c.drawerSystemOverridden ? c.drawerSystem : (setup.drawerSystem || c.drawerSystem),
                  drawerBoxConstruction: c.drawerSystemOverridden ? c.drawerBoxConstruction : (setup.drawerBoxConstruction || c.drawerBoxConstruction),
                  skirtingMaterial: setup.skirtingMaterial || c.skirtingMaterial,
                })))
              }}
              onAddCabinet={addCabinet}
            />
          </div>
          <div style={s.canvasWrap}>
            <RoomCanvas room={room} scale={SCALE} showGrid={showGrid} showDimensions={showDimensions}
              elements={elements} setElements={setElements} cabinets={cabinets} setCabinets={setCabinets}
              selected={selected} setSelected={setSelected} selectedType={selectedType} setSelectedType={setSelectedType}
              wallThickness={wallThickness} setWallThickness={setWallThickness}
              walls={walls} setWalls={setWalls}
              backsplashSegments={backsplashSegments}
              readOnly={false}
              hideToolbar={false}
              hideBacksplashTool={true}
              hideWallsElements={true} />
          </div>
          <div style={{ ...s.rightPanel, width: 280 }}>
            {selCab ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={s.propTitle}>{selCab.label}</div>
                  <button onClick={() => { setCabinets(p => p.filter(c => c.id !== selected)); setSelected(null) }}
                    style={{ padding: '4px 8px', background: '#FEF2F2', color: '#E74C3C', border: '1.5px solid #FECACA', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                    🗑 Delete
                  </button>
                </div>
<div style={s.propSection}>Dimensions</div>
{[['Width (mm)', 'width'], ['Height (mm)', 'height'], ['Depth (mm)', 'depth']].map(([label, key]) => (
  <div key={key} style={{ marginBottom: 10 }}>
    <div style={s.propLabel}>{label}</div>
    <DimInput value={selCab[key]} onCommit={v => updateCab(key, v)} style={s.propInput} />
  </div>
))}
{(selCab.category === 'wall' || selCab.subtype === 'Shelf' || selCab.subtype === 'Open Shelf' || selCab.category === 'accessories') && (
  <div style={{ marginBottom: 10 }}>
    <div style={s.propLabel}>Elevation from floor (mm)</div>
    <input type="number" value={selCab.elevation || 0} onChange={e => updateCab('elevation', +e.target.value)} style={s.propInput} />
  </div>
)}

                {['Sink', 'Single Sink', 'Double Sink'].includes(selCab.subtype) && (
                  <>
                    <div style={s.propSection}>Sink</div>
                    {selCab.sinkId && (
                      <div style={{ marginBottom: 10, padding: '8px 10px', background: '#F5F0E8', borderRadius: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: DARK }}>{selCab.sinkBrand} {selCab.sinkModel}</div>
                        <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                          {selCab.sinkCavityCount === 2 ? 'Double Bowl' : 'Single Bowl'} · {selCab.sinkWidthMm}×{selCab.sinkDepthMm}mm
                          {selCab.sinkPrice ? ` · ${selCab.sinkPrice}` : ''}
                        </div>
                      </div>
                    )}
                    <div style={{ marginBottom: 10 }}>
                      <SinkPicker selected={selCab.sinkId} onSelect={applySink} />
                    </div>
                  </>
                )}
                <div style={s.propSection}>Material & Style</div>
                {selCab.category !== 'accessories' && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={s.propLabel}>Door Style</div>
                    <select value={selCab.doorStyle} onChange={e => updateCab('doorStyle', e.target.value)} style={s.propSelect}>
                      {['Handle', 'Gola', 'Push'].map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                )}
                {isShelfEligible(selCab) && (() => {
                  const usableH = selCab.height - 36
                  const maxShelves = Math.max(0, Math.floor(usableH / 250) - 1)
                  const current = Math.min(selCab.shelfCount ?? selCab.glassShelfCount ?? 1, maxShelves)
                  const isGlassMaterial = selCab.category === 'wall' || selCab.subtype === 'Open Shelf'
                  return (
                    <div style={{ marginBottom: 10 }}>
                      <div style={s.propLabel}>Shelves {isGlassMaterial ? '(Glass)' : '(Wood)'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => updateCab('shelfCount', Math.max(0, current - 1))}
                          style={{ width: 28, height: 28, borderRadius: 6, border: '1.5px solid #E0DAD4', background: '#fff', cursor: 'pointer', fontWeight: 700, color: '#666' }}>−</button>
                        <span style={{ fontSize: 13, fontWeight: 700, color: DARK, minWidth: 16, textAlign: 'center' }}>{current}</span>
                        <button onClick={() => updateCab('shelfCount', Math.min(maxShelves, current + 1))}
                          disabled={current >= maxShelves}
                          style={{ width: 28, height: 28, borderRadius: 6, border: '1.5px solid #E0DAD4', background: current >= maxShelves ? '#F5F5F5' : '#fff', cursor: current >= maxShelves ? 'not-allowed' : 'pointer', fontWeight: 700, color: current >= maxShelves ? '#ccc' : '#666' }}>+</button>
                      </div>
                      <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>Max {maxShelves} — keeps 250mm clearance between shelves</div>
                    </div>
                  )
                })()}
                {selCab.subtype === 'Glass Door' && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={s.propLabel}>Glass Type</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[{ id: 'clear', label: '◻ Clear' }, { id: 'black', label: '⬛ Black' }].map(opt => (
                        <div key={opt.id} onClick={() => updateCab('glassType', opt.id)}
                          style={{ flex: 1, padding: '6px 4px', borderRadius: 6, border: `1.5px solid ${(selCab.glassType || 'clear') === opt.id ? ACCENT : '#E0DAD4'}`, background: (selCab.glassType || 'clear') === opt.id ? ACCENT + '15' : '#FAFAFA', cursor: 'pointer', textAlign: 'center' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: (selCab.glassType || 'clear') === opt.id ? ACCENT : '#666' }}>{opt.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {['base', 'vanity', 'corner', 'tall', 'wall'].includes(selCab.category) && (
                  <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div
                      onClick={() => updateCab('ledStripInterior', !selCab.ledStripInterior)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, border: `1.5px solid ${selCab.ledStripInterior ? ACCENT : '#E0DAD4'}`, background: selCab.ledStripInterior ? ACCENT + '12' : '#FAFAFA', cursor: 'pointer' }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${selCab.ledStripInterior ? ACCENT : '#ccc'}`, background: selCab.ledStripInterior ? ACCENT : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>{selCab.ledStripInterior ? '✓' : ''}</div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: selCab.ledStripInterior ? ACCENT : '#666' }}>💡 LED Strip (Interior)</span>
                    </div>
                    {selCab.category === 'wall' && (
                      <div
                        onClick={() => updateCab('ledStripUnder', !selCab.ledStripUnder)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, border: `1.5px solid ${selCab.ledStripUnder ? ACCENT : '#E0DAD4'}`, background: selCab.ledStripUnder ? ACCENT + '12' : '#FAFAFA', cursor: 'pointer' }}>
                        <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${selCab.ledStripUnder ? ACCENT : '#ccc'}`, background: selCab.ledStripUnder ? ACCENT : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>{selCab.ledStripUnder ? '✓' : ''}</div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: selCab.ledStripUnder ? ACCENT : '#666' }}>💡 LED Strip (Under Cabinet)</span>
                      </div>
                    )}
                  </div>
                )}

                {['base', 'vanity', 'corner', 'tall'].includes(selCab.category) && (selCab.elevation || 0) === 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={s.propLabel}>Skirting Board Sides</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                      {['front', 'back', 'left', 'right'].map(side => {
                        const sides = selCab.skirtingSides || []
                        const active = sides.includes(side)
                        return (
                          <div key={side} onClick={() => {
                            const next = active ? sides.filter(s => s !== side) : [...sides, side]
                            updateCab('skirtingSides', next)
                          }}
                            style={{ padding: '6px 4px', borderRadius: 6, border: `1.5px solid ${active ? ACCENT : '#E0DAD4'}`, background: active ? ACCENT + '15' : '#FAFAFA', cursor: 'pointer', textAlign: 'center' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: active ? ACCENT : '#888', textTransform: 'capitalize' }}>{side}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {['Drawers', '2Drw+Door'].includes(selCab.subtype) && (
                  <>
                    <div style={s.propSection}>Drawer System</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                      {availableDrawerSystems.map(sys => {
                        const isSel = (selCab.drawerSystem || 'Local Bearing') === sys.name
                        return (
                          <div key={sys.id}
                            onClick={() => { updateCab('drawerSystem', sys.name); updateCab('drawerBoxConstruction', sys.box_construction); updateCab('drawerSystemOverridden', true) }}
                            style={{ flex: '1 1 30%', padding: '6px 4px', border: `2px solid ${isSel ? '#C8902A' : '#E0DAD4'}`, borderRadius: 6,
                              cursor: 'pointer', background: isSel ? '#C8902A10' : '#FAFAFA', textAlign: 'center' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: isSel ? '#C8902A' : '#333' }}>{sys.name}</div>
                            <div style={{ fontSize: 7, color: '#999', marginTop: 1 }}>{sys.brand}</div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={s.propSection}>Interior Layout</div>
                    <ZonePresetPicker height={selCab.height} width={selCab.width} selected={selCab.zonePreset} onChange={p => updateCab('zonePreset', p)} />
                  </>
                )}
                <div style={s.propSection}>Front Material</div>
                <MaterialLibrary
                  target="front"
                  selectedCode={selCab.frontMaterialCode}
                  onSelect={mat => {
                    updateCab('frontColor', mat.hex)
                    updateCab('frontMaterial', mat.finish)
                    updateCab('frontMaterialCode', mat.code)
                    updateCab('frontMaterialName', mat.name); updateCab('frontMaterialThickness', mat.thickness || (mat.finish === 'wood' ? 22 : 18))
                    updateCab('frontTextureUrl', mat.textureUrl || null)
                  }}
                />
               {!['Shelf', 'Open Shelf', 'Filler', 'Panel', 'Side Panel'].includes(selCab.subtype) && (
  <>
    <div style={s.propSection}>Carcass Material</div>
    <MaterialLibrary
      target="carcass"
      selectedCode={selCab.carcassMaterialCode}
      onSelect={mat => {
        updateCab('carcassColor', mat.hex)
        updateCab('carcassMaterial', mat.finish)
        updateCab('carcassMaterialCode', mat.code)
        updateCab('carcassMaterialName', mat.name)
        updateCab('carcassTextureUrl', mat.textureUrl || null)
      }}
    />
  </>
)}

              </div>
            ) : (
              <div style={s.emptyProp}><div style={{ fontSize: 28, marginBottom: 8 }}>🗄</div>Click a cabinet to configure it</div>
            )}
          </div>
        </div>
      )}

      {tab === 'bom' && (
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {!cabinets.length ? (
            <div style={s.emptyState}><div style={{ fontSize: 48, marginBottom: 12 }}>📋</div><div style={{ fontWeight: 600, color: DARK }}>No cabinets yet</div></div>
          ) : (
            <div style={{ maxWidth: 860 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: DARK }}>{projectName}</h2>
                  <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>{cabinets.length} cabinets · Bill of Materials</div>
                </div>
                <button onClick={sendToERP} disabled={sending} style={s.erpBtn}>{sending ? 'Sending…' : '📤 Send to Manufacturing'}</button>
              </div>
              {sentMsg && <div style={{ ...s.toast, background: sentMsg.startsWith('✓') ? '#2AC87A' : '#e74c3c' }}>{sentMsg}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
                {[['18mm Sheet', bom.sheet18+' m²', ACCENT], ['8mm HDF', bom.hdf8+' m²', '#E8A020'],
                  ['Edge Banding', bom.edgeM+' m', '#9B59B6'], ['Blum Hinges', bom.hinges+' pcs', '#2AC87A'],
                  ['Legs', bom.legs+' pcs', '#1ABC9C'], ['Confirmats', bom.confirmats+' pcs', '#E74C3C'],
                  ['Dowels', bom.dowels+' pcs', '#F39C12'], ['Back Screws', bom.backScrews+' pcs', '#95A5A6'],
                  ['Handles', bom.handles+' pcs', DARK],
                  ['Backsplash', parseFloat(backsplashSegments.reduce((s, seg) => s + Math.hypot(seg.x2-seg.x1, seg.y2-seg.y1) / SCALE / 1000, 0).toFixed(2))+' m', '#8B5E3C'],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', borderLeft: '4px solid '+color, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: DARK }}>{val}</div>
                  </div>
                ))}
              </div>
              {cabinets.some(c => c.sinkId) && (
                <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 24 }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0EBE5', fontWeight: 700, fontSize: 13, color: DARK }}>
                    Sink Cutout Specifications <span style={{ fontWeight: 400, color: '#888', fontSize: 11 }}>— for countertop fabrication</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#FAFAFA' }}>
                      {['Cabinet', 'Sink', 'Cavity', 'Cutout W × D (mm)', 'Mount', 'Price'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#888' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {cabinets.filter(c => c.sinkId).map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid #F7F4F0' }}>
                          <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: DARK }}>{c.label}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12 }}>{c.sinkBrand} {c.sinkModel}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12 }}>{c.sinkCavityCount === 2 ? 'Double' : 'Single'}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace' }}>
                            {(c.sinkCutoutWidthMm || c.sinkWidthMm)} × {(c.sinkCutoutDepthMm || c.sinkDepthMm)}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, textTransform: 'capitalize' }}>{c.sinkMaterial === 'stainless_steel' ? 'Stainless Steel' : c.sinkMaterial === 'granite_composite' ? 'Granite Composite' : c.sinkMaterial}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12 }}>{c.sinkPrice || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0EBE5', fontWeight: 700, fontSize: 13, color: DARK }}>Cabinet List</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: '#FAFAFA' }}>
                    {['#','Type','W × H × D','Material','Door Style','Carcass','Front'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#888' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {cabinets.filter(c => isCarcassCabinet(c)).map((c, i) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #F7F4F0' }}>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#bbb', fontWeight: 600 }}>{String(i+1).padStart(2,'0')}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: DARK }}>{c.label}</td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: '#666', fontFamily: 'monospace' }}>{c.width}×{c.height}×{c.depth}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12 }}>{c.material}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12 }}>{c.doorStyle}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div title={c.carcassMaterialName || c.carcassColor} style={{ width: 20, height: 20, borderRadius: 4, background: c.carcassColor, border: '1.5px solid #ddd', overflow: 'hidden' }}>
                            {(c.carcassTextureUrl || textureMap[c.carcassMaterialCode]?.texture_image) && <img src={c.carcassTextureUrl || textureMap[c.carcassMaterialCode]?.texture_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />}
                          </div>
                          {c.carcassMaterialCode && <div style={{ fontSize: 9, color: '#aaa', marginTop: 2 }}>{c.carcassMaterialCode}</div>}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div title={c.frontMaterialName || c.frontColor} style={{ width: 20, height: 20, borderRadius: 4, background: c.frontColor, border: '1.5px solid #ddd', overflow: 'hidden' }}>
                            {(c.frontTextureUrl || textureMap[c.frontMaterialCode]?.texture_image) && <img src={c.frontTextureUrl || textureMap[c.frontMaterialCode]?.texture_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />}
                          </div>
                          {c.frontMaterialCode && <div style={{ fontSize: 9, color: '#aaa', marginTop: 2 }}>{c.frontMaterialCode}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cut Lists */}
              <PerCabinetCutList cabinets={cabinets} calculateCabinet={calculateCabinet} ACCENT={ACCENT} DARK={DARK} />
              <MasterCutList cabinets={cabinets} calculateCabinet={calculateCabinet} ACCENT={ACCENT} DARK={DARK} />

            </div>
          )}
        </div>
      )}

      {/* Keep the 3D canvas always mounted so countertopMat / floorTile changes
          propagate live without a remount. Only hide/show via CSS. */}
      <div style={{ flex: 1, display: tab === '3d' ? 'flex' : 'none', flexDirection: 'column' }}>
        <KitchenPlanner3D cabinets={cabinets} room={room} walls={walls} elements={elements} floorTile={floorTile} countertopId={countertopMat?.id} countertopMat={countertopMat} countertopThickness={countertopThickness} backsplashSegments={backsplashSegments} backsplashHeight={backsplashHeight} backsplashThickness={backsplashThickness} />
        {!cabinets.length && tab === '3d' && <div style={s.emptyState}><div style={{ fontSize: 48, marginBottom: 12 }}>🎮</div><div style={{ fontWeight: 600, color: DARK }}>Add cabinets first</div></div>}
      </div>

{tab === 'proposal' && (
  <ProposalTab
    cabinets={cabinets}
    countertopId={countertopMat?.id}
    projectName={projectName}
    onGrandTotalChange={setGrandTotal}
  />
)}

{tab === 'contract' && (
  <ContractTab
    cabinets={cabinets}
    projectName={projectName}
    countertopId={countertopMat?.id}
    grandTotal={grandTotal}
  />
)}

    </div>
  )
}

const s = {
  page:        { height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif", background: LIGHT, overflow: 'hidden' },
  topBar:      { height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0, gap: 16 },
  topLeft:     { display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 },
  projectName: { color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  nameInput:   { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, color: '#fff', padding: '4px 8px', fontSize: 14, fontWeight: 700, outline: 'none' },
  cabCount:    { color: '#666', fontSize: 12 },
  tabs:        { display: 'flex', gap: 4 },
  tab:         { padding: '7px 14px', background: 'transparent', border: 'none', color: '#888', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  tabActive:   { background: ACCENT, color: '#fff', fontWeight: 700 },
  topRight:    { display: 'flex', alignItems: 'center', gap: 8, minWidth: 200, justifyContent: 'flex-end' },
  saveBtn:     { padding: '7px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  workspace:   { flex: 1, display: 'flex', overflow: 'hidden' },
  leftPanel:   { width: 180, background: '#fff', borderRight: '1px solid #E0DAD4', overflowY: 'auto', flexShrink: 0, padding: 12 },
  rightPanel:  { width: 280, background: '#fff', borderLeft: '1px solid #E0DAD4', overflowY: 'auto', flexShrink: 0, padding: 12 },
  canvasWrap:  { flex: 1, overflow: 'hidden', background: '#E8E4DF', display: 'flex', padding: 16 },
  panelSection:{ marginBottom: 20 },
  panelLabel:  { fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 },
  dimLabel:    { fontSize: 12, color: '#555', display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 },
  dimInput:    { padding: '5px 8px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' },
  elementItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', marginBottom: 5, transition: 'border-color 0.15s', background: '#FAFAFA' },
  elementLabel:{ fontSize: 11, fontWeight: 600, color: DARK },
  elementSize: { fontSize: 10, color: '#999' },
  toggle:      { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', marginBottom: 6, cursor: 'pointer' },
  propTitle:   { fontSize: 14, fontWeight: 700, color: DARK, marginBottom: 14 },
  propSection: { fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginTop: 14, borderTop: '1px solid #F0EBE5', paddingTop: 10 },
  propLabel:   { fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 },
  propInput:   { width: '100%', padding: '7px 8px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK },
  propSelect:  { width: '100%', padding: '7px 8px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 12, outline: 'none', color: DARK, background: '#fff' },
  deleteBtn:   { width: '100%', padding: '8px', background: '#FEF2F2', color: '#E74C3C', border: '1.5px solid #FECACA', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, marginTop: 4 },
  emptyProp:   { color: '#bbb', fontSize: 12, textAlign: 'center', paddingTop: 40, lineHeight: 1.6 },
  emptyState:  { textAlign: 'center', paddingTop: 80, color: '#bbb' },
  erpBtn:      { padding: '10px 20px', background: '#2AC87A', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  toast:       { color: '#fff', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 16 },
}
// cache bust Mon Jun 29 00:25:35 PDT 2026
// bust Mon Jun 29 01:12:04 PDT 2026
// bust Mon Jun 29 03:56:01 PDT 2026
