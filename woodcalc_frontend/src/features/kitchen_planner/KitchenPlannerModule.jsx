import React, { useState, useCallback } from 'react'
import MaterialLibrary from './MaterialLibrary'
import { calculateCabinet } from './formulaEngine'
import ZonePresetPicker from './ZonePresetPicker'
import KitchenPlanner3D from './KitchenPlanner3D'
import RoomCanvas from './RoomCanvas'
import CabinetCatalog, { CountertopPicker, COUNTERTOP_MATERIALS } from './CabinetCatalog'
import ProposalTab from './ProposalTab'

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
  const [floorTile, setFloorTile]             = useState('white_large')
  const [baseHeight, setBaseHeight]           = useState(null)
  const [projectDefaults, setProjectDefaults] = useState(null)
  const [countertop, setCountertop]           = useState('sil_white_storm')
  const [countertopThickness, setCountertopThickness] = useState(30)


  const addCabinet = useCallback((t) => {
    const cab = {
      ...t,
      id: Date.now(),
      x: snap(200), y: snap(200),
      material: 'Particleboard',
      doorStyle:    t.doorStyle    || projectDefaults?.doorStyle    || 'Handle',
      carcassColor: t.carcassColor || projectDefaults?.carcassColor || '#F5F0E8',
      frontColor:   t.frontColor   || projectDefaults?.frontColor   || '#FFFFFF',
      frontMaterial:t.frontMaterial|| projectDefaults?.frontFinish  || 'matt',
      zonePreset: null,
    }
    setCabinets(p => [...p, cab])
    setSelected(cab.id)
    setSelectedType('cabinet')
  }, [projectDefaults])

  const addElement = (t) => {
    const el = { ...t, id: Date.now() + 1, x: snap(300), y: snap(100) }
    setElements(p => [...p, el])
    setSelected(el.id)
    setSelectedType('element')
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
          ].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ ...s.tab, ...(tab === id ? s.tabActive : {}) }}>
              {label}
            </button>
          ))}
        </div>
        <div style={s.topRight}>
          {baseHeight && (
            <button onClick={() => { if (window.confirm('Reset base height? This will not delete cabinets.')) setBaseHeight(null) }}
              style={{ ...s.saveBtn, fontSize: 11, color: '#888' }}>
              ⚙ H{baseHeight}mm
            </button>
          )}
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
  <label style={s.dimLabel}>Ceiling Height (mm)<input type="number" value={room.ceilingHeight || 2800} onChange={e => setRoom(r => ({ ...r, ceilingHeight: +e.target.value }))} style={s.dimInput} /></label>
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
              <CountertopPicker selected={countertop} onSelect={mat => setCountertop(mat.id)} />
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
              walls={walls} setWalls={setWalls} />
          </div>
          <div style={s.rightPanel}>
        {selEl ? (
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
      const distPx = ex * ux + ey * uy
      const distMm = Math.round(distPx / SCALE)
      return (
        <>
          <div style={{ marginBottom: 6, padding: '6px 8px', background: '#F0FFF4', borderRadius: 6, fontSize: 11, color: '#2AC87A', fontWeight: 600 }}>
            ✓ Wall {(selEl.wallIndex || 0) + 1} · {wallLenMm}mm long
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={s.propLabel}>Distance from wall start (mm)</div>
            <input type="number" value={distMm} min={0} max={wallLenMm}
              onChange={e => {
                const newDistPx = +e.target.value * SCALE
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
                  doorStyle:    setup.doorStyle,
                  golaColor:    setup.golaColor,
                  handlePos:    setup.handlePos,
                  carcassColor: setup.carcassColor,
                  frontColor:   setup.frontColor,
                  frontFinish:  setup.frontFinish,
                })
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
              readOnly={false}
              hideToolbar={true} />
          </div>
          <div style={{ ...s.rightPanel, width: 280 }}>
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
{(selCab.category === 'wall' || selCab.subtype === 'Shelf' || selCab.subtype === 'Open Shelf' || selCab.category === 'accessories') && (
  <div style={{ marginBottom: 10 }}>
    <div style={s.propLabel}>Elevation from floor (mm)</div>
    <input type="number" value={selCab.elevation || 0} onChange={e => updateCab('elevation', +e.target.value)} style={s.propInput} />
  </div>
)}

                <div style={s.propSection}>Material & Style</div>
                <div style={{ marginBottom: 10 }}>
                  <div style={s.propLabel}>Board Material</div>
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
                <div style={s.propSection}>Front Material</div>
                <MaterialLibrary
                  target="front"
                  selectedCode={selCab.frontMaterialCode}
                  onSelect={mat => {
                    updateCab('frontColor', mat.hex)
                    updateCab('frontMaterial', mat.finish)
                    updateCab('frontMaterialCode', mat.code)
                    updateCab('frontMaterialName', mat.name)
                  }}
                />
               {selCab.subtype !== 'Shelf' && selCab.subtype !== 'Open Shelf' && (
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
      }}
    />
  </>
)}

                <div style={{ marginTop: 8 }}>
                  <button onClick={() => { setCabinets(p => p.filter(c => c.id !== selected)); setSelected(null) }} style={s.deleteBtn}>Delete cabinet</button>
                </div>
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
                        <td style={{ padding: '10px 14px' }}>
                          <div title={c.carcassMaterialName || c.carcassColor} style={{ width: 20, height: 20, borderRadius: 4, background: c.carcassColor, border: '1.5px solid #ddd' }} />
                          {c.carcassMaterialCode && <div style={{ fontSize: 9, color: '#aaa', marginTop: 2 }}>{c.carcassMaterialCode}</div>}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div title={c.frontMaterialName || c.frontColor} style={{ width: 20, height: 20, borderRadius: 4, background: c.frontColor, border: '1.5px solid #ddd' }} />
                          {c.frontMaterialCode && <div style={{ fontSize: 9, color: '#aaa', marginTop: 2 }}>{c.frontMaterialCode}</div>}
                        </td>
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
<KitchenPlanner3D cabinets={cabinets} room={room} walls={walls} elements={elements} floorTile={floorTile} countertopId={countertop} countertopThickness={countertopThickness} />
          {!cabinets.length && <div style={s.emptyState}><div style={{ fontSize: 48, marginBottom: 12 }}>🎮</div><div style={{ fontWeight: 600, color: DARK }}>Add cabinets first</div></div>}
        </div>
      )}

      {tab === 'proposal' && (
        <ProposalTab
          cabinets={cabinets}
          countertopId={countertop}
          projectName={projectName}
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
