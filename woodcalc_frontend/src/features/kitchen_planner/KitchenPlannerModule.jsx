import React, { useState, useRef, useCallback } from 'react'
import { calculateCabinet } from './formulaEngine'
import ZonePresetPicker from './ZonePresetPicker'
import KitchenPlanner3D from './KitchenPlanner3D'
import RoomCanvas from './RoomCanvas'

const SCALE = 0.16
const GRID = 50
const ACCENT = '#C8902A'
const DARK = '#1A1A1A'
const LIGHT = '#F7F4F0'

const COLORS = [
  { name: 'White',    hex: '#FFFFFF' },
  { name: 'Cream',    hex: '#F5F0E8' },
  { name: 'Graphite', hex: '#4A4A4A' },
  { name: 'Oak',      hex: '#C8A96E' },
  { name: 'Walnut',   hex: '#7B5B3A' },
  { name: 'Navy',     hex: '#1B3A5C' },
]

const CATALOG = [
  { type: 'base_600',    label: 'Base 600',    width: 600,  height: 720,  depth: 560, category: 'Base' },
  { type: 'base_800',    label: 'Base 800',    width: 800,  height: 720,  depth: 560, category: 'Base' },
  { type: 'base_900',    label: 'Base 900',    width: 900,  height: 720,  depth: 560, category: 'Base' },
  { type: 'base_1000',   label: 'Base 1000',   width: 1000, height: 720,  depth: 560, category: 'Base' },
  { type: 'base_1200',   label: 'Base 1200',   width: 1200, height: 720,  depth: 560, category: 'Base' },
  { type: 'sink_600',    label: 'Sink 600',    width: 600,  height: 720,  depth: 560, category: 'Base' },
  { type: 'sink_800',    label: 'Sink 800',    width: 800,  height: 720,  depth: 560, category: 'Base' },
  { type: 'corner_900',  label: 'Corner 900',  width: 900,  height: 720,  depth: 900, category: 'Base' },
  { type: 'drawers_450', label: 'Drawers 450', width: 450,  height: 720,  depth: 560, category: 'Base' },
  { type: 'drawers_600', label: 'Drawers 600', width: 600,  height: 720,  depth: 560, category: 'Base' },
  { type: 'wall_400',    label: 'Wall 400',    width: 400,  height: 720,  depth: 350, category: 'Wall' },
  { type: 'wall_600',    label: 'Wall 600',    width: 600,  height: 720,  depth: 350, category: 'Wall' },
  { type: 'wall_800',    label: 'Wall 800',    width: 800,  height: 720,  depth: 350, category: 'Wall' },
  { type: 'wall_900',    label: 'Wall 900',    width: 900,  height: 720,  depth: 350, category: 'Wall' },
  { type: 'tall_600',    label: 'Tall 600',    width: 600,  height: 2100, depth: 560, category: 'Tall' },
  { type: 'tall_900',    label: 'Tall 900',    width: 900,  height: 2100, depth: 560, category: 'Tall' },
  { type: 'fridge_600',  label: 'Fridge 600',  width: 600,  height: 2100, depth: 600, category: 'Tall' },
]

const ROOM_ELEMENTS = [
  { type: 'window',   label: 'Window',         icon: '🪟', color: '#87CEEB', w: 900, h: 150 },
  { type: 'door',     label: 'Door',           icon: '🚪', color: '#DEB887', w: 900, h: 200 },
  { type: 'electric', label: 'Electric Point', icon: '⚡', color: '#FFD700', w: 100, h: 100 },
  { type: 'water',    label: 'Water Supply',   icon: '💧', color: '#4FC3F7', w: 100, h: 100 },
  { type: 'drain',    label: 'Drain Point',    icon: '🕳', color: '#90A4AE', w: 100, h: 100 },
  { type: 'gas',      label: 'Gas Point',      icon: '🔥', color: '#FF7043', w: 100, h: 100 },
  { type: 'column',   label: 'Column',         icon: '⬛', color: '#9E9E9E', w: 300, h: 300 },
]

const snap = v => Math.round(v / GRID) * GRID

function aggregateBOM(cabinets) {
  const totals = { sheet18: 0, hdf8: 0, edgeM: 0, hinges: 0, legs: 0, confirmats: 0, dowels: 0, backScrews: 0, handles: 0 }
  cabinets.forEach(cab => {
    try {
      const r = calculateCabinet({ width: cab.width, height: cab.height, depth: cab.depth, material: cab.material, doorStyle: cab.doorStyle, shelves: 0 })
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

export default function KitchenPlannerModule() {
  const [projectName, setProjectName]       = useState('Untitled Kitchen')
  const [editingName, setEditingName]       = useState(false)
  const [cabinets, setCabinets]             = useState([])
  const [elements, setElements]             = useState([])
  const [selected, setSelected]             = useState(null)
  const [selectedType, setSelectedType]     = useState(null)
  const [room, setRoom]                     = useState({ width: 4000, depth: 3000 })
  const [dragging, setDragging]             = useState(null)
  const [dragType, setDragType]             = useState(null)
  const [offset, setOffset]                 = useState({ x: 0, y: 0 })
  const [tab, setTab]                       = useState('room')
  const [showGrid, setShowGrid]             = useState(true)
  const [showDimensions, setShowDimensions] = useState(true)
  const [sending, setSending]               = useState(false)
  const [sentMsg, setSentMsg]               = useState('')
  const [saving, setSaving]                 = useState(false)
  const [savedMsg, setSavedMsg]             = useState('')
  const [catalogFilter, setCatalogFilter]   = useState('All')
  const [wallThickness, setWallThickness]   = useState(120)
  const canvasRef = useRef(null)

  const onMouseDown = useCallback((e, id, type) => {
    e.stopPropagation()
    const rect = canvasRef.current.getBoundingClientRect()
    const item = type === 'cabinet' ? cabinets.find(c => c.id === id) : elements.find(el => el.id === id)
    setDragging(id); setDragType(type); setSelected(id); setSelectedType(type)
    setOffset({ x: e.clientX - rect.left - item.x * SCALE, y: e.clientY - rect.top - item.y * SCALE })
  }, [cabinets, elements])

  const onMouseMove = useCallback((e) => {
    if (!dragging) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = Math.max(0, snap((e.clientX - rect.left - offset.x) / SCALE))
    const y = Math.max(0, snap((e.clientY - rect.top  - offset.y) / SCALE))
    if (dragType === 'cabinet') setCabinets(p => p.map(c => c.id === dragging ? { ...c, x, y } : c))
    else setElements(p => p.map(el => el.id === dragging ? { ...el, x, y } : el))
  }, [dragging, offset, dragType])

  const addCabinet = (t) => {
    const cab = { ...t, id: Date.now(), x: snap(200), y: snap(200), material: 'Particleboard', doorStyle: 'Handle', carcassColor: '#F5F0E8', frontColor: '#FFFFFF', zonePreset: null }
    setCabinets(p => [...p, cab]); setSelected(cab.id); setSelectedType('cabinet')
  }

  const addElement = (t) => {
    const el = { ...t, id: Date.now() + 1, x: snap(300), y: snap(100) }
    setElements(p => [...p, el]); setSelected(el.id); setSelectedType('element')
  }

  const updateCab = (key, val) => setCabinets(p => p.map(c => c.id === selected ? { ...c, [key]: val } : c))
  const updateEl  = (key, val) => setElements(p => p.map(e => e.id === selected ? { ...e, [key]: val } : e))

  const selCab = cabinets.find(c => c.id === selected && selectedType === 'cabinet')
  const selEl  = elements.find(e => e.id === selected && selectedType === 'element')
  const bom    = aggregateBOM(cabinets)

  const saveProject = async () => {
    setSaving(true); setSavedMsg('')
    const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'
    try {
      const res = await fetch(API + '/api/manufacturing/work-orders/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('access_token') },
        body: JSON.stringify({ order_number: 'KP-' + Date.now(), product_name: projectName, customer_name: 'Kitchen Planner', quantity: cabinets.length, status: 'DRAFT' })
      })
      setSavedMsg(res.ok ? '✓ Saved' : '✗ Failed')
    } catch { setSavedMsg('✗ No connection') }
    setSaving(false)
    setTimeout(() => setSavedMsg(''), 3000)
  }

  const sendToERP = async () => {
    if (!cabinets.length) return
    setSending(true); setSentMsg('')
    const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'
    const orderNumber = 'WO-KP-' + Date.now()
    try {
      const res = await fetch(API + '/api/manufacturing/work-orders/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('access_token') },
        body: JSON.stringify({ order_number: orderNumber, product_name: projectName + ' (' + cabinets.length + ' cabinets)', customer_name: 'Kitchen Planner', quantity: cabinets.length, status: 'NEW' })
      })
      setSentMsg(res.ok ? '✓ Work Order ' + orderNumber + ' sent!' : '✗ Failed (' + res.status + ')')
    } catch { setSentMsg('✗ Cannot connect') }
    setSending(false)
  }

  const categories = ['All', ...new Set(CATALOG.map(c => c.category))]
  const filteredCatalog = catalogFilter === 'All' ? CATALOG : CATALOG.filter(c => c.category === catalogFilter)

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div style={s.topLeft}>
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
        </div>
        <div style={s.tabs}>
          {[['room', '📐 Room'], ['planner', '🗄 Cabinets'], ['bom', '📋 BOM'], ['3d', '🎮 3D']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ ...s.tab, ...(tab === id ? s.tabActive : {}) }}>{label}</button>
          ))}
        </div>
        <div style={s.topRight}>
          <button onClick={saveProject} disabled={saving} style={s.saveBtn}>
            {saving ? 'Saving…' : savedMsg || '💾 Save'}
          </button>
        </div>
      </div>

      {tab === 'room' && (
        <div style={s.workspace}>
          <div style={s.leftPanel}>
            <div style={s.panelSection}>
              <div style={s.panelLabel}>Room Size</div>
              <label style={s.dimLabel}>Width (mm)<input type="number" value={room.width} onChange={e => setRoom(r => ({ ...r, width: +e.target.value }))} style={s.dimInput} /></label>
              <label style={s.dimLabel}>Depth (mm)<input type="number" value={room.depth} onChange={e => setRoom(r => ({ ...r, depth: +e.target.value }))} style={s.dimInput} /></label>
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
              <div style={s.panelLabel}>View Options</div>
              <label style={s.toggle}><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} />Show grid</label>
              <label style={s.toggle}><input type="checkbox" checked={showDimensions} onChange={e => setShowDimensions(e.target.checked)} />Show dimensions</label>
            </div>
          </div>
          <div style={s.canvasWrap}>
            <RoomCanvas room={room} scale={SCALE} showGrid={showGrid} showDimensions={showDimensions}
              elements={elements} setElements={setElements} cabinets={cabinets} setCabinets={setCabinets}
              selected={selected} setSelected={setSelected} selectedType={selectedType} setSelectedType={setSelectedType}
              wallThickness={wallThickness} setWallThickness={setWallThickness} />
          </div>
          <div style={s.rightPanel}>
            {selEl ? (
              <div>
                <div style={s.propTitle}>{selEl.icon} {selEl.label}</div>
                {[['Width (mm)', 'w'], ['Height (mm)', 'h']].map(([label, key]) => (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <div style={s.propLabel}>{label}</div>
                    <input type="number" value={selEl[key]} onChange={e => updateEl(key, +e.target.value)} style={s.propInput} />
                  </div>
                ))}
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
          <div style={s.leftPanel}>
            <div style={s.panelSection}>
              <div style={s.panelLabel}>Cabinet Catalog</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setCatalogFilter(cat)}
                    style={{ ...s.filterChip, ...(catalogFilter === cat ? s.filterChipActive : {}) }}>{cat}</button>
                ))}
              </div>
              {filteredCatalog.map(t => (
                <div key={t.type} onClick={() => addCabinet(t)} style={s.catalogItem}
                  onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#E0DAD4'}>
                  <div style={s.catalogLabel}>{t.label}</div>
                  <div style={s.catalogSize}>{t.width}×{t.height}×{t.depth}mm</div>
                </div>
              ))}
            </div>
          </div>
          <div style={s.canvasWrap}>
            <div ref={canvasRef} onMouseMove={onMouseMove}
              onMouseUp={() => { setDragging(null); setDragType(null) }}
              onMouseLeave={() => { setDragging(null); setDragType(null) }}
              onClick={e => { if (e.target === canvasRef.current) { setSelected(null); setSelectedType(null) } }}
              style={{ ...s.canvas, width: room.width * SCALE, height: room.depth * SCALE,
                backgroundImage: showGrid ? 'linear-gradient(rgba(200,144,42,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(200,144,42,0.08) 1px, transparent 1px)' : 'none',
                backgroundSize: `${GRID * SCALE}px ${GRID * SCALE}px` }}>
              {showDimensions && <>
                <div style={{ ...s.dimTag, top: -24, left: '50%', transform: 'translateX(-50%)' }}>{room.width}mm</div>
                <div style={{ ...s.dimTag, left: -40, top: '50%', transform: 'translateY(-50%) rotate(-90deg)' }}>{room.depth}mm</div>
              </>}
              {elements.map(el => (
                <div key={el.id} style={{ position: 'absolute', left: el.x * SCALE, top: el.y * SCALE,
                  width: el.w * SCALE, height: el.h * SCALE, background: el.color + '33',
                  border: `1.5px dashed ${el.color}`, borderRadius: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: 12 }}>{el.icon}</div>
                </div>
              ))}
              {cabinets.map(cab => (
                <div key={cab.id} onMouseDown={e => onMouseDown(e, cab.id, 'cabinet')}
                  style={{ position: 'absolute', left: cab.x * SCALE, top: cab.y * SCALE,
                    width: cab.width * SCALE, height: cab.depth * SCALE, background: cab.carcassColor,
                    border: `2px solid ${selected === cab.id ? ACCENT : '#888'}`, borderRadius: 3,
                    cursor: 'grab', display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', userSelect: 'none', overflow: 'hidden', boxSizing: 'border-box' }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#333', textAlign: 'center' }}>{cab.label}</div>
                  {showDimensions && <div style={{ fontSize: 7, color: '#666' }}>{cab.width}mm</div>}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: cab.frontColor, borderTop: '1px solid #ccc' }} />
                </div>
              ))}
            </div>
          </div>
          <div style={s.rightPanel}>
            {selCab ? (
              <div>
                <div style={s.propTitle}>{selCab.label}</div>
                <div style={s.propSection}>Dimensions</div>
                {[['Width (mm)', 'width'], ['Height (mm)', 'height'], ['Depth (mm)', 'depth']].map(([label, key]) => (
                  <div key={key} style={{ marginBottom: 10 }}>
                    <div style={s.propLabel}>{label}</div>
                    <input type="number" value={selCab[key]} onChange={e => updateCab(key, +e.target.value)} style={s.propInput} />
                  </div>
                ))}
                <div style={s.propSection}>Material & Style</div>
                <div style={{ marginBottom: 10 }}>
                  <div style={s.propLabel}>Material</div>
                  <select value={selCab.material} onChange={e => updateCab('material', e.target.value)} style={s.propSelect}>
                    {['Particleboard', 'Plywood', 'MDF'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={s.propLabel}>Door Style</div>
                  <select value={selCab.doorStyle} onChange={e => updateCab('doorStyle', e.target.value)} style={s.propSelect}>
                    {['Handle', 'Gola', 'Push'].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div style={s.propSection}>Interior Layout</div>
                <ZonePresetPicker height={selCab.height} selected={selCab.zonePreset} onChange={p => updateCab('zonePreset', p)} />
                <div style={s.propSection}>Colors</div>
                <div style={{ marginBottom: 10 }}>
                  <div style={s.propLabel}>Carcass</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {COLORS.map(c => <div key={c.hex} title={c.name} onClick={() => updateCab('carcassColor', c.hex)}
                      style={{ width: 24, height: 24, borderRadius: 5, background: c.hex, cursor: 'pointer',
                        border: selCab.carcassColor === c.hex ? `2.5px solid ${ACCENT}` : '1.5px solid #ccc' }} />)}
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={s.propLabel}>Front</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {COLORS.map(c => <div key={c.hex} title={c.name} onClick={() => updateCab('frontColor', c.hex)}
                      style={{ width: 24, height: 24, borderRadius: 5, background: c.hex, cursor: 'pointer',
                        border: selCab.frontColor === c.hex ? `2.5px solid ${ACCENT}` : '1.5px solid #ccc' }} />)}
                  </div>
                </div>
                <button onClick={() => { setCabinets(p => p.filter(c => c.id !== selected)); setSelected(null) }} style={s.deleteBtn}>Delete cabinet</button>
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
                ].map(([label, val, color]) => (
                  <div key={label} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', borderLeft: '4px solid '+color, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: DARK }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0EBE5', fontWeight: 700, fontSize: 13, color: DARK }}>Cabinet List</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: '#FAFAFA' }}>
                    {['#','Type','W × H × D','Material','Door Style','Carcass','Front'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#888' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {cabinets.map((c, i) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #F7F4F0' }}>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#bbb', fontWeight: 600 }}>{String(i+1).padStart(2,'0')}</td>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: DARK }}>{c.label}</td>
                        <td style={{ padding: '10px 14px', fontSize: 11, color: '#666', fontFamily: 'monospace' }}>{c.width}×{c.height}×{c.depth}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12 }}>{c.material}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12 }}>{c.doorStyle}</td>
                        <td style={{ padding: '10px 14px' }}><div style={{ width: 20, height: 20, borderRadius: 4, background: c.carcassColor, border: '1.5px solid #ddd' }} /></td>
                        <td style={{ padding: '10px 14px' }}><div style={{ width: 20, height: 20, borderRadius: 4, background: c.frontColor, border: '1.5px solid #ddd' }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === '3d' && (
        <div style={{ flex: 1 }}>
          <KitchenPlanner3D cabinets={cabinets} room={room} />
          {!cabinets.length && <div style={s.emptyState}><div style={{ fontSize: 48, marginBottom: 12 }}>🎮</div><div style={{ fontWeight: 600, color: DARK }}>Add cabinets first</div></div>}
        </div>
      )}
    </div>
  )
}

const s = {
  page: { height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif", background: LIGHT, overflow: 'hidden' },
  topBar: { height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0, gap: 16 },
  topLeft: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 },
  projectName: { color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  nameInput: { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, color: '#fff', padding: '4px 8px', fontSize: 14, fontWeight: 700, outline: 'none' },
  cabCount: { color: '#666', fontSize: 12 },
  tabs: { display: 'flex', gap: 4 },
  tab: { padding: '7px 14px', background: 'transparent', border: 'none', color: '#888', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  tabActive: { background: ACCENT, color: '#fff', fontWeight: 700 },
  topRight: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 200, justifyContent: 'flex-end' },
  saveBtn: { padding: '7px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  workspace: { flex: 1, display: 'flex', overflow: 'hidden' },
  leftPanel: { width: 180, background: '#fff', borderRight: '1px solid #E0DAD4', overflowY: 'auto', flexShrink: 0, padding: 12 },
  rightPanel: { width: 200, background: '#fff', borderLeft: '1px solid #E0DAD4', overflowY: 'auto', flexShrink: 0, padding: 12 },
  canvasWrap: { flex: 1, overflow: 'auto', background: '#E8E4DF', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', padding: 40 },
  canvas: { background: '#fff', border: '2px solid #2c3e50', borderRadius: 4, position: 'relative', cursor: 'crosshair', flexShrink: 0 },
  panelSection: { marginBottom: 20 },
  panelLabel: { fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 },
  dimLabel: { fontSize: 12, color: '#555', display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 },
  dimInput: { padding: '5px 8px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' },
  elementItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', marginBottom: 5, transition: 'border-color 0.15s', background: '#FAFAFA' },
  elementLabel: { fontSize: 11, fontWeight: 600, color: DARK },
  elementSize: { fontSize: 10, color: '#999' },
  toggle: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', marginBottom: 6, cursor: 'pointer' },
  catalogItem: { padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', marginBottom: 5, background: '#FAFAFA', transition: 'border-color 0.15s' },
  catalogLabel: { fontSize: 12, fontWeight: 700, color: DARK },
  catalogSize: { fontSize: 10, color: '#999', marginTop: 1, fontFamily: 'monospace' },
  filterChip: { padding: '3px 8px', borderRadius: 12, border: '1px solid #E0DAD4', background: '#FAFAFA', fontSize: 10, fontWeight: 600, color: '#666', cursor: 'pointer' },
  filterChipActive: { background: ACCENT, color: '#fff', borderColor: ACCENT },
  propTitle: { fontSize: 14, fontWeight: 700, color: DARK, marginBottom: 14 },
  propSection: { fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginTop: 14, borderTop: '1px solid #F0EBE5', paddingTop: 10 },
  propLabel: { fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 },
  propInput: { width: '100%', padding: '7px 8px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK },
  propSelect: { width: '100%', padding: '7px 8px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 12, outline: 'none', color: DARK, background: '#fff' },
  deleteBtn: { width: '100%', padding: '8px', background: '#FEF2F2', color: '#E74C3C', border: '1.5px solid #FECACA', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, marginTop: 4 },
  emptyProp: { color: '#bbb', fontSize: 12, textAlign: 'center', paddingTop: 40, lineHeight: 1.6 },
  emptyState: { textAlign: 'center', paddingTop: 80, color: '#bbb' },
  dimTag: { position: 'absolute', fontSize: 10, color: '#888', fontWeight: 600, background: '#fff', padding: '1px 5px', borderRadius: 3, pointerEvents: 'none', whiteSpace: 'nowrap' },
  erpBtn: { padding: '10px 20px', background: '#2AC87A', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  toast: { color: '#fff', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 16 },
}
