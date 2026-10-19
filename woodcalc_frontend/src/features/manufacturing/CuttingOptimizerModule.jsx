import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { calculateCabinet, cabinetConfig, isCarcassCabinet, isBackPanel, isBackPanelMaterial, panelFace, nonCarcassPieceDims, fillerCleatDims, APPLIANCE_SUBTYPES } from '../kitchen_planner/formulaEngine'
import { useTranslation } from '../../i18n/LanguageContext'
import { isReadOnly } from '../../api/auth'
import { useCompanyStandards } from '../../api/companySettings'

const API = import.meta.env.VITE_API_URL

function emptyPart() {
  return { label: '', width: '', height: '', quantity: 1, grain_locked: true }
}

// Splits the room's BOM into one group per board material -- a kitchen with two
// front finishes (e.g. a high-gloss and a laminate) is cut from two different
// boards, so each gets its own cutting job and sheet layout. 'all' gathers the
// carcass, fronts and backs together, so a board used for both open boxes and
// doors is packed (and its sheets counted) once. Fillers, side/top panels, toe
// kicks and loose shelves are one flat board each, cut from the front material
// like a door (a Filler's fixing cleat comes from the carcass board), matching
// the master cut list. Glass shelves aren't cut here: they're made to size by
// the glass supplier.
export function bomPanelsToGroups(cabinets, group) {
  const groups = new Map()
  const wants = kind => group === 'all' || group === kind

  function addPart(kind, sku, label, width, height, grainLocked, qty, thickness = '') {
    // Codes typed into the planner can carry stray spaces; " wh.pw.18" is
    // still the same board as "wh.pw.18".
    sku = typeof sku === 'string' ? sku.trim() : sku
    // A back panel with no stock material is grouped by its thickness, so 3mm
    // and 8mm backs never end up on the same sheet.
    const groupKey = sku || `${kind}|${thickness}`
    if (!groups.has(groupKey)) groups.set(groupKey, { sku: sku || null, thickness: sku ? '' : String(thickness || ''), merged: new Map() })
    const merged = groups.get(groupKey).merged
    const key = `${label}|${width}|${height}|${grainLocked}`
    if (merged.has(key)) {
      merged.get(key).quantity += qty
    } else {
      merged.set(key, { label, width, height, quantity: qty, grain_locked: grainLocked })
    }
  }

  // A Filler has no carcass material of its own (the planner hides that picker
  // for it), so its fixing cleat is cut from the board most of the kitchen's
  // boxes use.
  const carcassUse = new Map()
  cabinets.forEach(cab => {
    const sku = isCarcassCabinet(cab) && typeof cab.carcassMaterialCode === 'string' && cab.carcassMaterialCode.trim()
    if (sku) carcassUse.set(sku, (carcassUse.get(sku) || 0) + 1)
  })
  const kitchenCarcassSku = [...carcassUse.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null

  cabinets.forEach(cab => {
    if (!isCarcassCabinet(cab)) {
      if (APPLIANCE_SUBTYPES.includes(cab.subtype)) return // purchased, not cut
      const piece = nonCarcassPieceDims(cab)
      if (wants('front') && piece.width > 0 && piece.depth > 0) {
        addPart('front', cab.frontMaterialCode, cab.subtype || 'Piece', piece.width, piece.depth, true, 1)
      }
      if (wants('carcass') && cab.subtype === 'Filler') {
        const cleat = fillerCleatDims(cab)
        if (cleat.width > 0) addPart('carcass', cab.carcassMaterialCode || kitchenCarcassSku, 'Filler Fixing Cleat', cleat.width, cleat.depth, false, 1)
      }
      return
    }
    let result
    try {
      result = calculateCabinet(cabinetConfig(cab))
    } catch {
      return
    }

    result.panels.forEach(p => {
      if (isBackPanel(p)) return
      // Panels in the front material (a blind corner's filler, an open box whose
      // Box Color is the front) are cut with the fronts, grain along their height
      // like a door's.
      if (panelFace(p) === 'front') {
        if (wants('front')) addPart('front', cab.frontMaterialCode, p.name, p.width, p.depth, true, p.qty)
      } else if (wants('carcass')) {
        addPart('carcass', cab.carcassMaterialCode, p.name, p.width, p.depth, false, p.qty)
      }
    })

    if (wants('back')) {
      result.panels.forEach(p => {
        if (!isBackPanel(p)) return
        addPart('back', p.materialCode, p.name, p.width, p.depth, false, p.qty, p.thickness)
      })
    }

    if (wants('front')) {
      result.doors.forEach(d => {
        if (d.glassDoor) return // bought in from the glass supplier
        addPart('front', cab.frontMaterialCode, 'Door', d.height, d.width, true, 1)
      })
      // Grain runs vertically like the doors', so it carries on down a drawer stack.
      result.drawerFronts.forEach(d => {
        addPart('front', cab.frontMaterialCode, 'Drawer Front', d.height, d.width, true, 1)
      })
    }
  })

  return Array.from(groups.values()).map(g => newGroup({
    sku: g.sku,
    thickness: g.thickness || '',
    parts: Array.from(g.merged.values()).map(p => ({
      label: p.label,
      width: String(p.width),
      height: String(p.height),
      quantity: p.quantity,
      grain_locked: p.grain_locked,
    })),
  }))
}

// Which board a tab is cut from. Thickness is compared as a number: a tab picked
// by hand takes the stock sheet's "18.00" while a BOM tab takes the material's
// 18, and both are the same board.
export function boardKey(materialId, thickness) {
  return `${materialId}|${Number(thickness)}`
}

let groupSeq = 0
function newGroup({ sku = null, materialId = '', thickness = '', parts = [emptyPart()] } = {}) {
  groupSeq += 1
  return { key: groupSeq, sku, materialId, thickness, parts }
}

async function fetchAllPages(url, headers) {
  const all = []
  for (let page = 1; ; page++) {
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}page=${page}`, { headers })
    if (!res.ok) break
    const data = await res.json()
    if (Array.isArray(data)) return data
    all.push(...(data.results || []))
    if (!data.next) break
  }
  return all
}

function CuttingOptimizerModule() {
  const navigate = useNavigate()
  const { t, language } = useTranslation()
  const dir = language === 'ar' ? 'rtl' : 'ltr'
  // Loads the company back panel standard the BOM import depends on.
  useCompanyStandards()
  const token = localStorage.getItem('access_token')
  const authHeaders = { Authorization: `Bearer ${token}` }
  const readOnly = isReadOnly()

  const [workOrders, setWorkOrders] = useState([])
  const [stockSheets, setStockSheets] = useState([])
  const [materials, setMaterials] = useState([])
  const [workOrderId, setWorkOrderId] = useState('')
  const [kerf, setKerf] = useState('4')
  const [groups, setGroups] = useState(() => [newGroup()])
  const [activeKey, setActiveKey] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bomLoading, setBomLoading] = useState(false)
  const [preselectedFromUrl, setPreselectedFromUrl] = useState(false)
  const [autoLoaded, setAutoLoaded] = useState(false)

  const activeGroup = groups.find(g => g.key === activeKey) || groups[0]
  const materialsById = new Map(materials.map(m => [String(m.id), m]))
  const materialsBySku = new Map(materials.map(m => [m.sku, m]))

  // A BOM group only knows the planner's SKU; it resolves to the inventory
  // material (and its board thickness) unless the user picked another one.
  function groupMaterial(g) {
    if (g.materialId) return materialsById.get(String(g.materialId)) || { id: g.materialId }
    return g.sku ? materialsBySku.get(g.sku) || null : null
  }
  function groupThickness(g) {
    if (g.thickness) return g.thickness
    const m = groupMaterial(g)
    return m?.board_thickness ? String(m.board_thickness) : ''
  }
  function groupLabel(g) {
    if (g.sku) return g.sku
    const m = groupMaterial(g)
    return m?.sku || t('cuttingOptimizer.noMaterial')
  }

  // Sheet goods only: fronts and carcass boards, plus anything that already has
  // a stock sheet set up (e.g. back-panel MDF) or is selected right now.
  const sheetMaterialIds = new Set(stockSheets.map(s => String(s.material)))
  const materialOptions = materials.filter(m =>
    m.material_type === 'front' || m.material_type === 'carcass' || isBackPanelMaterial(m) || sheetMaterialIds.has(String(m.id))
    || groups.some(g => String(groupMaterial(g)?.id) === String(m.id)))

  function materialOptionLabel(m) {
    const sheet = stockSheets.find(s => String(s.material) === String(m.id))
    return t('cuttingOptimizer.materialOption', {
      sku: m.sku, name: m.name,
      thickness: sheet ? Number(sheet.thickness) : (m.board_thickness || 18),
      width: sheet ? Number(sheet.width) : m.board_width,
      height: sheet ? Number(sheet.height) : m.board_height,
    })
  }

  useEffect(() => {
    fetch(`${API}/api/manufacturing/work-orders/`, { headers: authHeaders })
      .then(r => r.json()).then(d => setWorkOrders(d.results || []))
      .catch(() => {})
    fetchAllPages(`${API}/api/manufacturing/stock-sheets/`, authHeaders)
      .then(setStockSheets).catch(() => {})
    fetchAllPages(`${API}/api/inventory/materials/`, authHeaders)
      .then(setMaterials).catch(() => {})

    const params = new URLSearchParams(window.location.search)
    const preselectId = params.get('work_order')
    if (preselectId) {
      setWorkOrderId(preselectId)
      setPreselectedFromUrl(true)
    }

    const cadcamImportId = params.get('cadcam_import')
    if (cadcamImportId) {
      const raw = sessionStorage.getItem(`cadcam_group_${cadcamImportId}`)
      if (raw) {
        try {
          const group = JSON.parse(raw)
          setGroups([newGroup({
            materialId: String(group.material),
            thickness: String(group.thickness),
            parts: group.parts.map(p => ({ ...p, quantity: String(p.quantity) })),
          })])
        } catch {}
        sessionStorage.removeItem(`cadcam_group_${cadcamImportId}`)
      }
    }
  }, [])

  useEffect(() => {
    if (preselectedFromUrl && !autoLoaded && workOrders.length > 0 && workOrderId) {
      setAutoLoaded(true)
      loadFromBOM('all')
    }
  }, [preselectedFromUrl, autoLoaded, workOrders, workOrderId])

  function updateActiveGroup(fn) {
    setGroups(prev => prev.map(g => g.key === activeGroup.key ? fn(g) : g))
  }

  function updatePart(idx, field, value) {
    updateActiveGroup(g => ({ ...g, parts: g.parts.map((p, i) => i === idx ? { ...p, [field]: value } : p) }))
  }

  function addPart() {
    updateActiveGroup(g => ({ ...g, parts: [...g.parts, emptyPart()] }))
  }

  function removePart(idx) {
    updateActiveGroup(g => ({ ...g, parts: g.parts.filter((_, i) => i !== idx) }))
  }

  function selectMaterial(value) {
    const m = materialsById.get(value)
    const sheet = stockSheets.find(s => String(s.material) === value)
    updateActiveGroup(g => ({
      ...g,
      materialId: value,
      thickness: value ? String(sheet ? sheet.thickness : (m?.board_thickness || 18)) : '',
    }))
  }

  async function createAndOptimize() {
    setError('')
    const toRun = groups
      .map(g => ({ g, parts: g.parts.filter(p => p.label && p.width && p.height) }))
      .filter(({ parts }) => parts.length > 0)
    if (!workOrderId || toRun.length === 0) {
      setError(t('cuttingOptimizer.errSelectAll'))
      return
    }
    const missing = toRun.find(({ g }) => !groupMaterial(g)?.id || !groupThickness(g))
    if (missing) {
      setActiveKey(missing.g.key)
      setError(t('cuttingOptimizer.errGroupNoMaterial', { group: groupLabel(missing.g) }))
      return
    }

    // Two tabs that resolve to the same board are one cutting job: separate jobs
    // would be packed on separate sheets, and the second would treat the first
    // as a superseded re-run and put its stock back.
    const byBoard = new Map()
    toRun.forEach(({ g, parts }) => {
      const key = boardKey(groupMaterial(g).id, groupThickness(g))
      if (byBoard.has(key)) byBoard.get(key).parts.push(...parts)
      else byBoard.set(key, { g, parts: [...parts] })
    })

    setLoading(true)
    const done = []
    const failures = []
    for (const { g, parts } of byBoard.values()) {
      const material = groupMaterial(g)
      try {
        const createRes = await fetch(`${API}/api/manufacturing/cutting-jobs/`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            work_order: workOrderId,
            material: material.id,
            thickness: groupThickness(g),
            kerf,
            parts,
          }),
        })
        if (!createRes.ok) {
          const errData = await createRes.json().catch(() => ({}))
          throw new Error(errData.detail || t('cuttingOptimizer.errCreateJob'))
        }
        const created = await createRes.json()

        const optimizeRes = await fetch(`${API}/api/manufacturing/cutting-jobs/${created.id}/optimize/`, {
          method: 'POST',
          headers: authHeaders,
        })
        if (!optimizeRes.ok) {
          const errData = await optimizeRes.json().catch(() => ({}))
          throw new Error(errData.detail || t('cuttingOptimizer.errOptimizeJob'))
        }
        const job = await optimizeRes.json()
        done.push({ job, title: material.name ? `${material.sku} — ${material.name}` : groupLabel(g) })
      } catch (e) {
        // fetch only throws a TypeError when no response came back at all
        // (Safari words it "Load failed"), e.g. the server timed out.
        const message = e instanceof TypeError ? t('cuttingOptimizer.errNoResponse') : e.message
        failures.push(`${groupLabel(g)}: ${message}`)
      }
    }
    setResults(done)
    if (failures.length) setError(failures.join(' · '))
    setLoading(false)
    // Layouts carry the stock sheet the backend may have just created.
    fetchAllPages(`${API}/api/manufacturing/stock-sheets/`, authHeaders).then(setStockSheets).catch(() => {})
  }

  // Auditors can't create jobs, so instead of optimizing they review the
  // layouts already produced for the work order.
  async function loadSavedJobs() {
    setError('')
    if (!workOrderId) {
      setError(t('cuttingOptimizer.errSelectWorkOrder'))
      return
    }
    setLoading(true)
    try {
      const jobs = await fetchAllPages(`${API}/api/manufacturing/cutting-jobs/?work_order=${workOrderId}`, authHeaders)
      const optimized = jobs.filter(j => j.layouts?.length)
      setResults(optimized.map(job => {
        const m = materialsById.get(String(job.material))
        return { job, title: m ? (m.name ? `${m.sku} — ${m.name}` : m.sku) : '' }
      }))
      if (optimized.length === 0) setError(t('cuttingOptimizer.noSavedJobs'))
    } catch {
      setError(t('cuttingOptimizer.errLoadSavedJobs'))
    }
    setLoading(false)
  }

  async function loadFromBOM(group) {
    setError('')
    const wo = workOrders.find(w => String(w.id) === String(workOrderId))
    if (!wo) {
      setError(t('cuttingOptimizer.errSelectWorkOrder'))
      return
    }
    if (!wo.room_id_ref) {
      setError(t('cuttingOptimizer.errNoLinkedRoom'))
      return
    }
    setBomLoading(true)
    try {
      const res = await fetch(`${API}/api/crm/rooms/${wo.room_id_ref}/`, { headers: authHeaders })
      if (!res.ok) throw new Error(t('cuttingOptimizer.errLoadBom'))
      const room = await res.json()
      const cabinets = room.planner_data?.cabinets || []
      if (cabinets.length === 0) {
        setError(t('cuttingOptimizer.errNoCabinets'))
        return
      }
      const bomGroups = bomPanelsToGroups(cabinets, group)
      if (bomGroups.length === 0) {
        setError(t('cuttingOptimizer.errNoPartsInGroup', { group }))
        return
      }
      setGroups(bomGroups)
      setActiveKey(bomGroups[0].key)
      setResults([])
    } catch (e) {
      setError(e.message)
    } finally {
      setBomLoading(false)
    }
  }

  async function downloadExport(job, kind) {
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

  // Every material's cut list in one .xlsx -- opens in Excel and Google Sheets.
  async function downloadWorkbook() {
    setError('')
    try {
      const ids = results.map(({ job }) => job.id).join(',')
      const res = await fetch(`${API}/api/manufacturing/cutting-jobs/export-xlsx/?ids=${ids}`, { headers: authHeaders })
      if (!res.ok) throw new Error(t('cuttingOptimizer.errDownloadSpreadsheet'))
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const wo = workOrders.find(w => String(w.id) === String(results[0].job.work_order))
      a.download = `cutting_list_${wo?.order_number || results[0].job.work_order}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof TypeError ? t('cuttingOptimizer.errNoResponse') : e.message)
    }
  }

  const inputStyle = { padding: 8, border: '1px solid #ddd', borderRadius: 6, width: '100%' }
  const labelStyle = { fontSize: 12, color: '#666', marginBottom: 4, display: 'block' }
  const activeMaterial = groupMaterial(activeGroup)
  const activeMaterialMissing = activeGroup.sku && !activeGroup.materialId && !activeMaterial && materials.length > 0
  // A board without grain is cut with every part free to turn, whatever its
  // grain_locked says (the optimizer ignores it), so the tick isn't shown.
  const boardHasNoGrain = activeMaterial?.has_grain === false

  return (
    <div dir={dir} style={{ maxWidth: 1100, margin: '0 auto' }}>
      <button onClick={() => navigate('/production')}
        style={{ padding: '6px 12px', marginBottom: 12, border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: 'pointer', fontSize: 12, color: '#555' }}>
        {t('cuttingOptimizer.backToProduction')}
      </button>
      <h1 style={{ color: '#2c3e50', marginBottom: 20 }}>{t('cuttingOptimizer.title')}</h1>

      <div style={{ background: 'white', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>{t('cuttingOptimizer.workOrder')}</label>
            <select style={inputStyle} value={workOrderId} onChange={e => setWorkOrderId(e.target.value)}>
              <option value="">{t('cuttingOptimizer.select')}</option>
              {workOrders.map(w => <option key={w.id} value={w.id}>{w.order_number}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>
              {groups.length > 1
                ? t('cuttingOptimizer.materialForGroup', { group: groupLabel(activeGroup) })
                : t('cuttingOptimizer.materialThickness')}
            </label>
            <select
              style={inputStyle}
              value={activeMaterial?.id ? String(activeMaterial.id) : ''}
              onChange={e => selectMaterial(e.target.value)}
            >
              <option value="">{t('cuttingOptimizer.select')}</option>
              {materialOptions.map(m => (
                <option key={m.id} value={String(m.id)}>{materialOptionLabel(m)}</option>
              ))}
            </select>
            {activeMaterialMissing && (
              <div style={{ fontSize: 12, color: '#e67e22', marginTop: 4 }}>
                {t('cuttingOptimizer.skuNotInInventory', { sku: activeGroup.sku })}
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>{t('cuttingOptimizer.kerfMm')}</label>
            <input style={inputStyle} type="number" value={kerf} onChange={e => setKerf(e.target.value)} />
          </div>
        </div>

        {groups.length > 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {groups.map(g => {
              const active = g.key === activeGroup.key
              const pieces = g.parts.reduce((n, p) => n + (Number(p.quantity) || 0), 0)
              return (
                <button key={g.key} onClick={() => setActiveKey(g.key)}
                  style={{ padding: '6px 12px', borderRadius: 16, cursor: 'pointer', fontSize: 13,
                    border: active ? '1px solid #2c3e50' : '1px solid #ddd',
                    background: active ? '#2c3e50' : 'white', color: active ? 'white' : '#2c3e50' }}>
                  {t('cuttingOptimizer.groupTab', { group: groupLabel(g), count: pieces })}
                </button>
              )
            })}
          </div>
        )}

        <label style={labelStyle}>{t('cuttingOptimizer.parts')}</label>
        {boardHasNoGrain && (
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{t('cuttingOptimizer.noGrainNote')}</div>
        )}
        <div style={{ maxHeight: 420, overflowY: 'auto', marginBottom: 12, paddingRight: 4 }}>
        {activeGroup.parts.map((p, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input style={inputStyle} placeholder={t('cuttingOptimizer.labelPlaceholder')} value={p.label} onChange={e => updatePart(idx, 'label', e.target.value)} />
            <input style={inputStyle} placeholder={t('cuttingOptimizer.widthMmPlaceholder')} type="number" value={p.width} onChange={e => updatePart(idx, 'width', e.target.value)} />
            <input style={inputStyle} placeholder={t('cuttingOptimizer.heightMmPlaceholder')} type="number" value={p.height} onChange={e => updatePart(idx, 'height', e.target.value)} />
            <input style={inputStyle} placeholder={t('cuttingOptimizer.qtyPlaceholder')} type="number" value={p.quantity} onChange={e => updatePart(idx, 'quantity', e.target.value)} />
            {boardHasNoGrain ? (
              <span style={{ fontSize: 13, color: '#aaa' }}>{t('cuttingOptimizer.freeToRotate')}</span>
            ) : (
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="checkbox" checked={p.grain_locked} onChange={e => updatePart(idx, 'grain_locked', e.target.checked)} />
                {t('cuttingOptimizer.grainLocked')}
              </label>
            )}
            <button onClick={() => removePart(idx)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}>✕</button>
          </div>
        ))}
        </div>
        <button onClick={addPart} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: 'pointer', marginRight: 8 }}>
          {t('cuttingOptimizer.addPart')}
        </button>
        <button onClick={() => loadFromBOM('all')} disabled={bomLoading} style={{ padding: '6px 12px', border: '1px solid #2c3e50', borderRadius: 6, background: '#2c3e50', color: 'white', cursor: 'pointer', marginRight: 8 }}>
          {t('cuttingOptimizer.loadAll')}
        </button>
        <button onClick={() => loadFromBOM('carcass')} disabled={bomLoading} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: 'pointer', marginRight: 8 }}>
          {t('cuttingOptimizer.loadCarcass')}
        </button>
        <button onClick={() => loadFromBOM('front')} disabled={bomLoading} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: 'pointer', marginRight: 8 }}>
          {t('cuttingOptimizer.loadFronts')}
        </button>
        <button onClick={() => loadFromBOM('back')} disabled={bomLoading} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: 'pointer', marginBottom: 16 }}>
          {t('cuttingOptimizer.loadBackPanels')}
        </button>

        <div>
          <button
            onClick={readOnly ? loadSavedJobs : createAndOptimize}
            disabled={loading}
            style={{ padding: '10px 20px', background: '#2c3e50', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            {readOnly
              ? t('cuttingOptimizer.viewSavedJobs')
              : loading
              ? t('cuttingOptimizer.optimizing')
              : groups.length > 1
                ? t('cuttingOptimizer.createOptimizeAll', { count: groups.length })
                : t('cuttingOptimizer.createOptimize')}
          </button>
          {error && <span style={{ color: '#e74c3c', marginLeft: 12 }}>{error}</span>}
        </div>
      </div>

      {results.length > 0 && (
        <div style={{ background: 'white', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: '#2c3e50' }}>{t('cuttingOptimizer.sheetsSummary')}</h2>
            <button onClick={downloadWorkbook} style={{ padding: '6px 12px', border: '1px solid #27ae60', borderRadius: 6, background: '#27ae60', color: 'white', cursor: 'pointer' }}>
              {t('cuttingOptimizer.downloadSpreadsheet')}
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#ecf0f1' }}>
                {[t('cuttingOptimizer.colMaterial'), t('cuttingOptimizer.colThickness'), t('cuttingOptimizer.colPieces'), t('cuttingOptimizer.colSheets')].map((h, hi) => (
                  <th key={hi} style={{ padding: 8, textAlign: 'start' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map(({ job, title }) => (
                <tr key={job.id} style={{ borderBottom: '1px solid #ecf0f1' }}>
                  <td style={{ padding: 8 }}>{title}</td>
                  <td style={{ padding: 8 }}>{Number(job.thickness)}mm</td>
                  <td style={{ padding: 8 }}>{job.layouts.reduce((n, l) => n + l.placements.length, 0)}</td>
                  <td style={{ padding: 8, fontWeight: 600 }}>{job.layouts.length}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} style={{ padding: 8, fontWeight: 600 }}>{t('cuttingOptimizer.totalSheets')}</td>
                <td style={{ padding: 8, fontWeight: 600 }}>{results.reduce((n, { job }) => n + job.layouts.length, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {results.map(({ job, title }) => (
        <div key={job.id} style={{ background: 'white', borderRadius: 8, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{title} · {Number(job.thickness)}mm</div>
              <h2 style={{ margin: 0, fontSize: 18, color: '#2c3e50' }}>
                {t('cuttingOptimizer.jobHeader', { id: job.id, count: job.layouts.length })}
              </h2>
              {job.stock && (
                <div style={{ fontSize: 12, marginTop: 4, color: job.stock.below_reorder_level ? '#e74c3c' : '#27ae60' }}>
                  {t('cuttingOptimizer.stockTaken', {
                    used: Number(job.stock.used_by_job), unit: job.stock.unit, sku: job.stock.material_sku,
                    left: Number(job.stock.quantity_on_hand),
                  })}
                  {job.stock.below_reorder_level && ` · ${t('cuttingOptimizer.stockBelowReorder', { level: Number(job.stock.reorder_level) })}`}
                </div>
              )}
            </div>
            <div>
              <button onClick={() => downloadExport(job, 'csv')} style={{ padding: '6px 12px', marginRight: 8, border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: 'pointer' }}>
                {t('cuttingOptimizer.downloadCsv')}
              </button>
              <button onClick={() => downloadExport(job, 'pdf')} style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: 6, background: 'white', cursor: 'pointer' }}>
                {t('cuttingOptimizer.downloadPdf')}
              </button>
            </div>
          </div>

          {job.layouts.map(layout => (
            <div key={layout.id} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                {t('cuttingOptimizer.sheetWaste', { index: layout.sheet_index, waste: layout.waste_percent })}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#ecf0f1' }}>
                    {[t('cuttingOptimizer.colPart'), t('cuttingOptimizer.colWidth'), t('cuttingOptimizer.colHeight'), t('cuttingOptimizer.colX'), t('cuttingOptimizer.colY'), t('cuttingOptimizer.colRotated')].map((h, hi) => (
                      <th key={hi} style={{ padding: 8, textAlign: 'left' }}>{h}</th>
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
                      <td style={{ padding: 8 }}>{pl.rotated ? t('cuttingOptimizer.yes') : t('cuttingOptimizer.no')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default CuttingOptimizerModule
