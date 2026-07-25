import { useState, useEffect } from 'react'
import { calculateCabinet } from '../kitchen_planner/formulaEngine'
import { cabinetConfig, isCarcassCabinet } from '../kitchen_planner/KitchenPlannerModule'

const API = import.meta.env.VITE_API_URL

function emptyPart() {
  return { label: '', width: '', height: '', quantity: 1, grain_locked: true }
}

function bomPanelsToParts(cabinets, group) {
  const merged = new Map()

  function addPart(label, width, height, grainLocked, qty) {
    const key = `${label}|${width}|${height}|${grainLocked}`
    if (merged.has(key)) {
      merged.get(key).quantity += qty
    } else {
      merged.set(key, { label, width, height, quantity: qty, grain_locked: grainLocked })
    }
  }

  cabinets.forEach(cab => {
    if (!isCarcassCabinet(cab)) return
    let result
    try {
      result = calculateCabinet(cabinetConfig(cab))
    } catch {
      return
    }

    if (group === 'carcass') {
      result.panels.forEach(p => {
        if (p.name.includes('Back panel')) return
        if (p.name === 'Side panel') {
          addPart(p.name, p.width, p.depth, true, p.qty)
        } else {
          addPart(p.name, p.width, p.depth, false, p.qty)
        }
      })
    }

    if (group === 'back') {
      result.panels.forEach(p => {
        if (!p.name.includes('Back panel')) return
        addPart(p.name, p.width, p.depth, false, p.qty)
      })
    }

    if (group === 'front') {
      result.doors.forEach(d => {
        addPart('Door', d.height, d.width, true, 1)
      })
    }
  })

  return Array.from(merged.values()).map(p => ({
    label: p.label,
    width: String(p.width),
    height: String(p.height),
    quantity: p.quantity,
    grain_locked: p.grain_locked,
  }))
}

function CuttingOptimizerModule() {
  const token = localStorage.getItem('access_token')
  const authHeaders = { Authorization: `Bearer ${token}` }

  const [workOrders, setWorkOrders] = useState([])
  const [stockSheets, setStockSheets] = useState([])
  const [workOrderId, setWorkOrderId] = useState('')
  const [materialId, setMaterialId] = useState('')
  const [thickness, setThickness] = useState('')
  const [kerf, setKerf] = useState('4')
  const [parts, setParts] = useState([emptyPart()])
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bomLoading, setBomLoading] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/manufacturing/work-orders/`, { headers: authHeaders })
      .then(r => r.json()).then(d => setWorkOrders(d.results || []))
      .catch(() => {})
    fetch(`${API}/api/manufacturing/stock-sheets/`, { headers: authHeaders })
      .then(r => r.json()).then(d => setStockSheets(d.results || []))
      .catch(() => {})
  }, [])

  function updatePart(idx, field, value) {
    setParts(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  function addPart() {
    setParts(prev => [...prev, emptyPart()])
  }

  function removePart(idx) {
    setParts(prev => prev.filter((_, i) => i !== idx))
  }

  async function createAndOptimize() {
    setError('')
    if (!workOrderId || !materialId || !thickness) {
      setError('Select a work order, material, and thickness.')
      return
    }
    setLoading(true)
    try {
      const createRes = await fetch(`${API}/api/manufacturing/cutting-jobs/`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_order: workOrderId,
          material: materialId,
          thickness,
          kerf,
          parts: parts.filter(p => p.label && p.width && p.height),
        }),
      })
      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to create cutting job')
      }
      const created = await createRes.json()

      const optimizeRes = await fetch(`${API}/api/manufacturing/cutting-jobs/${created.id}/optimize/`, {
        method: 'POST',
        headers: authHeaders,
      })
      if (!optimizeRes.ok) {
        const errData = await optimizeRes.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to optimize cutting job')
      }
      const optimized = await optimizeRes.json()
      setJob(optimized)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function autoSelectStockSheet(cabinets, group) {
    if (group === 'back') return
    const firstCab = cabinets.find(c => isCarcassCabinet(c))
    if (!firstCab) return
    const sku = group === 'carcass' ? firstCab.carcassMaterialCode : firstCab.frontMaterialCode
    if (!sku) return

    try {
      const matRes = await fetch(`${API}/api/inventory/materials/?search=${encodeURIComponent(sku)}`, { headers: authHeaders })
      if (!matRes.ok) return
      const matData = await matRes.json()
      const materials = Array.isArray(matData) ? matData : (matData.results || [])
      const material = materials.find(m => m.sku === sku)
      if (!material) return

      const sheetRes = await fetch(`${API}/api/manufacturing/stock-sheets/?material=${material.id}`, { headers: authHeaders })
      if (!sheetRes.ok) return
      const sheetData = await sheetRes.json()
      const sheets = Array.isArray(sheetData) ? sheetData : (sheetData.results || [])
      if (sheets.length === 0) return

      setMaterialId(String(sheets[0].material))
      setThickness(String(sheets[0].thickness))
    } catch {
    }
  }

  async function loadFromBOM(group) {
    setError('')
    const wo = workOrders.find(w => String(w.id) === String(workOrderId))
    if (!wo) {
      setError('Select a work order first.')
      return
    }
    if (!wo.room_id_ref) {
      setError('This work order has no linked room to load a BOM from.')
      return
    }
    setBomLoading(true)
    try {
      const res = await fetch(`${API}/api/crm/rooms/${wo.room_id_ref}/`, { headers: authHeaders })
      if (!res.ok) throw new Error('Failed to load room BOM')
      const room = await res.json()
      const cabinets = room.planner_data?.cabinets || []
      if (cabinets.length === 0) {
        setError('No cabinets found in this room\'s saved plan.')
        return
      }
      const bomParts = bomPanelsToParts(cabinets, group)
      if (bomParts.length === 0) {
        setError(`No ${group} parts found in this room's BOM.`)
        return
      }
      setParts(bomParts)
      await autoSelectStockSheet(cabinets, group)
    } catch (e) {
      setError(e.message)
    } finally {
      setBomLoading(false)
    }
  }

  async function downloadExport(kind) {
    if (!job) return
    const res = await fetch(`${API}/api/manufacturing/cutting-jobs/${job.id}/export-${kind}/`, {
      headers: authHeaders,
    })
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cutting_job_${job.id}.${kind === 'csv' ? 'csv' : 'pdf'}`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const inputStyle = { padding: 8, border: '1px solid #ddd', borderRadius: 6, width: '100%' }
  const labelStyle = { fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ color: '#2c3e50', marginBottom: 20 }}>Cutting Optimizer</h1>

      <div style={{ background: 'white', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Work Order</label>
            <select style={inputStyle} value={workOrderId} onChange={e => setWorkOrderId(e.target.value)}>
              <option value="">Select...</option>
              {workOrders.map(w => <option key={w.id} value={w.id}>{w.order_number}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Material / Thickness</label>
            <select
              style={inputStyle}
              value={materialId && thickness ? `${materialId}|${thickness}` : ''}
              onChange={e => {
                const [m, t] = e.target.value.split('|')
                setMaterialId(m); setThickness(t)
              }}
            >
              <option value="">Select...</option>
              {stockSheets.map(s => (
                <option key={s.id} value={`${s.material}|${s.thickness}`}>
                  Material #{s.material} - {s.thickness}mm ({s.width}x{s.height})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Kerf (mm)</label>
            <input style={inputStyle} type="number" value={kerf} onChange={e => setKerf(e.target.value)} />
          </div>
        </div>

        <label style={labelStyle}>Parts</label>
        <div style={{ maxHeight: 420, overflowY: 'auto', marginBottom: 12, paddingRight: 4 }}>
        {parts.map((p, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input style={inputStyle} placeholder="Label" value={p.label} onChange={e => updatePart(idx, 'label', e.target.value)} />
            <input style={inputStyle} placeholder="Width mm" type="number" value={p.width} onChange={e => updatePart(idx, 'width', e.target.value)} />
            <input style={inputStyle} placeholder="Height mm" type="number" value={p.height} onChange={e => updatePart(idx, 'height', e.target.value)} />
            <input style={inputStyle} placeholder="Qty" type="number" value={p.quantity} onChange={e => updatePart(idx, 'quantity', e.target.value)} />
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={p.grain_locked} onChange={e => updatePart(idx, 'grain_locked', e.target.checked)} />
              Grain locked
            </label>
            <button onClick={() => removePart(idx)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}>✕</button>
          </div>
        ))}
        </div>
        <button onClick={addPart} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: 'pointer', marginRight: 8 }}>
          + Add part
        </button>
        <button onClick={() => loadFromBOM('carcass')} disabled={bomLoading} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: 'pointer', marginRight: 8 }}>
          Load Carcass
        </button>
        <button onClick={() => loadFromBOM('front')} disabled={bomLoading} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: 'pointer', marginRight: 8 }}>
          Load Fronts
        </button>
        <button onClick={() => loadFromBOM('back')} disabled={bomLoading} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: 'pointer', marginBottom: 16 }}>
          Load Back Panels
        </button>

        <div>
          <button
            onClick={createAndOptimize}
            disabled={loading}
            style={{ padding: '10px 20px', background: '#2c3e50', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            {loading ? 'Optimizing...' : 'Create & Optimize'}
          </button>
          {error && <span style={{ color: '#e74c3c', marginLeft: 12 }}>{error}</span>}
        </div>
      </div>

      {job && (
        <div style={{ background: 'white', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: '#2c3e50' }}>
              Job #{job.id} - {job.layouts.length} sheet(s) used
            </h2>
            <div>
              <button onClick={() => downloadExport('csv')} style={{ padding: '6px 12px', marginRight: 8, border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: 'pointer' }}>
                Download CSV
              </button>
              <button onClick={() => downloadExport('pdf')} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: 'pointer' }}>
                Download PDF
              </button>
            </div>
          </div>

          {job.layouts.map(layout => (
            <div key={layout.id} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                Sheet {layout.sheet_index} - Waste {layout.waste_percent}%
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#ecf0f1' }}>
                    {['Part', 'Width', 'Height', 'X', 'Y', 'Rotated'].map(h => (
                      <th key={h} style={{ padding: 8, textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {layout.placements.map(pl => (
                    <tr key={pl.id} style={{ borderBottom: '1px solid #ecf0f1' }}>
                      <td style={{ padding: 8 }}>{pl.part.label}</td>
                      <td style={{ padding: 8 }}>{pl.width}</td>
                      <td style={{ padding: 8 }}>{pl.height}</td>
                      <td style={{ padding: 8 }}>{pl.x}</td>
                      <td style={{ padding: 8 }}>{pl.y}</td>
                      <td style={{ padding: 8 }}>{pl.rotated ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CuttingOptimizerModule
