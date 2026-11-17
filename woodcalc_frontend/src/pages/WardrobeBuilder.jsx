import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import ErrorBoundary from '../components/ErrorBoundary'
import { useTranslation } from '../i18n/LanguageContext'
import { DEFAULT_WARDROBE_STANDARD, STANDARD_FIELD_GROUPS, STANDARD_ENUMS, DECIMAL_FIELDS, loadStandard, saveStandard, normalizeStandard } from '../features/wardrobe/wardrobeStandard'
import { defaultDesign, withSectionCount, autoSectionCount, sectionWidths, DOOR_TYPES, CONSTRUCTION_TYPES, BACK_TYPES } from '../features/wardrobe/wardrobeEngine'
import WardrobeElevation from '../features/wardrobe/WardrobeElevation'
import SectionEditor from '../features/wardrobe/SectionEditor'
import ChecksCard from '../features/wardrobe/ChecksCard'
import CutListPanel from '../features/wardrobe/CutListPanel'
import NumField from '../features/wardrobe/NumField'
import { ACCENT, DARK, FIELDSET, card, label, input, btn, ghost } from '../features/wardrobe/ui'
import WardrobePriceTab from '../features/wardrobe/WardrobePriceTab'
import ClosetEditor from '../features/wardrobe/ClosetEditor'
import { computeDesign, defaultCloset } from '../features/wardrobe/closetEngine'
import { useInventoryMaterials } from '../features/wardrobe/useInventoryMaterials'
import { usePricing } from '../features/wardrobe/useWardrobePricing'
import { savedWardrobe, buildWardrobePlannerData, contractRows, isWardrobeRoom } from '../features/wardrobe/wardrobeRoom'
import WardrobeRoomBar from '../features/wardrobe/WardrobeRoomBar'
import LinkProjectModal from '../features/rooms/LinkProjectModal'
import { roomLockState } from '../features/rooms/useRoomLockActions'
import { activeTotal } from '../features/kitchen_planner/revisions'
import ContractTab from '../features/kitchen_planner/ContractTab'
import { authFetch } from '../api/auth'

const Wardrobe3D = lazy(() => import('../features/wardrobe/Wardrobe3D'))

const DESIGN_KEY = 'woodcalc.wardrobeDesign.v1'
const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

const FRONT_COLORS = [
  { id: 'white', hex: '#f3f1ec' },
  { id: 'cashmere', hex: '#d8cbb8' },
  { id: 'oak', hex: '#c49a6c' },
  { id: 'walnut', hex: '#6e4b33' },
  { id: 'grey', hex: '#8b8d8f' },
  { id: 'green', hex: '#5d6b58' },
  { id: 'black', hex: '#2c2c2c' },
]

function loadDesign(std) {
  try {
    const d = JSON.parse(localStorage.getItem(DESIGN_KEY) || 'null')
    if (d && Array.isArray(d.sections) && d.sections.length) return d
  } catch {}
  return defaultDesign(std)
}

export default function WardrobeBuilder({ roomId = null, room = null, lock = null, onRoomAction, onBack, onSaved }) {
  const { t, language } = useTranslation()
  const dir = language === 'ar' ? 'rtl' : 'ltr'
  const navigate = useNavigate()
  const [saved] = useState(() => savedWardrobe(room))
  const [std, setStd] = useState(() => (saved?.standard ? normalizeStandard(saved.standard) : loadStandard()))
  const [design, setDesign] = useState(() => {
    if (saved?.design) return saved.design
    if (!roomId) return loadDesign(loadStandard())
    const fresh = defaultDesign(loadStandard())
    return room?.room_type === 'closet' ? { ...fresh, mode: 'closet', closet: defaultCloset(loadStandard()) } : fresh
  })
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [showLink, setShowLink] = useState(false)
  const [selected, setSelected] = useState({ section: 0, zone: null })
  const [view, setView] = useState('front')
  const [doorMode, setDoorMode] = useState('closed')
  const [frontColor, setFrontColor] = useState(FRONT_COLORS[2].hex)
  const [showStd, setShowStd] = useState(false)
  const [stdDraft, setStdDraft] = useState(std)
  const [tab, setTab] = useState('design')
  const materialsState = useInventoryMaterials()

  useEffect(() => {
    if (roomId) return
    try { localStorage.setItem(DESIGN_KEY, JSON.stringify(design)) } catch {}
  }, [design, roomId])

  const result = useMemo(() => computeDesign(design, std), [design, std])
  const closetMode = design.mode === 'closet' && !!design.closet
  const { price, picked } = usePricing(design, std, materialsState.materials, result)
  const lockSt = roomLockState(lock)
  const readOnly = !!roomId && lockSt.readOnly
  const [localStd, setLocalStd] = useState(loadStandard)
  const stdDiffers = !!roomId && JSON.stringify(localStd) !== JSON.stringify(std)

  const flash = (msg) => {
    setSavedMsg(msg)
    setTimeout(() => setSavedMsg(''), 3000)
  }

  const saveToRoom = async (targetRoomId = roomId, targetProjectId = room?.project) => {
    if (!targetRoomId) { setShowLink(true); return false }
    setSaving(true)
    let ok = false
    try {
      const planner_data = buildWardrobePlannerData({ design, std, price, result })
      const grand_total = planner_data.grandTotal
      const res = await authFetch(API + `/api/crm/rooms/${targetRoomId}/`, { method: 'PATCH', body: JSON.stringify({ planner_data, grand_total }) })
      ok = res.ok
      if (ok && targetProjectId) {
        const roomsRes = await authFetch(API + `/api/crm/rooms/?project=${targetProjectId}`)
        const roomsData = await roomsRes.json()
        const rooms = Array.isArray(roomsData) ? roomsData : (roomsData.results || [])
        const total = activeTotal(rooms.map((r) => (String(r.id) === String(targetRoomId) ? { ...r, grand_total } : r)))
        await authFetch(API + `/api/crm/projects/${targetProjectId}/`, { method: 'PATCH', body: JSON.stringify({ total_value: total.toFixed(2) }) })
      }
      if (ok && onSaved) onSaved({ planner_data, grand_total })
      flash(ok ? t('kitchenPlannerModule.saved') : t('kitchenPlannerModule.saveFailed'))
    } catch {
      flash(t('kitchenPlannerModule.saveNoConnection'))
    }
    setSaving(false)
    return ok
  }

  const onLinked = async (projectId, newRoomId) => {
    setShowLink(false)
    if (await saveToRoom(newRoomId, projectId)) navigate(`/rooms/${newRoomId}`)
  }
  const widths = useMemo(() => sectionWidths(design), [design])
  const setField = (k, v) => setDesign((d) => ({ ...d, [k]: v }))
  const setCount = (n) => setDesign((d) => withSectionCount(d, n, std))
  const zoneLabel = (z) => t(`wardrobe.zone.${z.type}`)
  const si = Math.min(selected.section, design.sections.length - 1)
  const saveStd = () => {
    if (readOnly) return
    const clean = normalizeStandard(stdDraft)
    setStd(clean)
    setLocalStd(clean)
    saveStandard(clean)
    setShowStd(false)
  }

  const resetDesign = () => {
    setDesign(defaultDesign(std))
    setSelected({ section: 0, zone: null })
  }

  const setMode = (mode) => setDesign((d) => ({ ...d, mode, closet: mode === 'closet' ? d.closet || defaultCloset(std) : d.closet }))

  const constructionLabel = result.summary.construction === 'shared'
    ? `${t('wardrobe.constructionTypes.shared')} · ${t(`wardrobe.backTypes.${result.summary.backType}`)}`
    : t(`wardrobe.constructionTypes.${result.summary.construction}`)
  const rows = contractRows(design, result, widths, t, picked.Carcass?.name || t('wardrobe.price.standardBoard'))
  const colorPicker = (
    <div style={{ display: 'flex', gap: 4, marginInlineStart: 6 }}>
      {FRONT_COLORS.map((c) => (
        <button key={c.id} title={t(`wardrobe.colors.${c.id}`)} onClick={() => setFrontColor(c.hex)}
          style={{ width: 22, height: 22, borderRadius: 11, background: c.hex, cursor: 'pointer', border: frontColor === c.hex ? `2px solid ${ACCENT}` : '1px solid #ccc' }} />
      ))}
    </div>
  )

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      <style>{`@media print { .wb-noprint { display: none !important } .wb-print-full { width: 100% !important } body { background: #fff } } .wb-grid { display: grid; grid-template-columns: 330px minmax(0, 1fr); gap: 16px } @media (max-width: 900px) { .wb-grid { grid-template-columns: 1fr } }`}</style>
      <div className="app-topbar wb-noprint" style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 124px 0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {onBack ? (
            <button onClick={onBack} style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
              {t('kitchenPlannerModule.topBack')}
            </button>
          ) : <Logo forDarkBg onClick={() => navigate('/dashboard')} height={22} />}
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{room?.name || t('wardrobe.title')}</span>
          {lock && lockSt.isRevision && !lockSt.locked && (
            <span style={{ fontSize: 10, color: lock.revisionStatus === 'rejected' ? '#E74C3C' : ACCENT, background: 'rgba(255,255,255,0.08)', padding: '2px 7px', borderRadius: 4 }}>
              {lock.revisionStatus === 'rejected'
                ? t('kitchenPlannerModule.revisionRejected', { rev: lock.revisionNumber, reason: lock.rejectionReason })
                : t('kitchenPlannerModule.revisionDraft', { rev: lock.revisionNumber })}
            </span>
          )}
          <div style={{ display: 'flex', gap: 4, marginInlineStart: 8 }}>
            {['design', 'price', 'contract'].map((k) => (
              <button key={k} onClick={() => setTab(k)}
                style={{ padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: 'none', background: tab === k ? '#fff' : 'transparent', color: tab === k ? DARK : '#bbb' }}>
                {t(`wardrobe.tab.${k}`)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {roomId ? (
            <WardrobeRoomBar roomId={roomId} lock={lock} onRoomAction={onRoomAction} onSave={() => saveToRoom()} saving={saving} savedMsg={savedMsg}
              canSave={!materialsState.loading} />
          ) : (
            <button onClick={() => setShowLink(true)} disabled={materialsState.loading}
              style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: `1px solid ${ACCENT}`, color: ACCENT, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              {saving ? t('kitchenPlannerModule.saving') : savedMsg || t('wardrobe.room.saveToProject')}
            </button>
          )}
          {!readOnly && <button onClick={() => { setStdDraft(std); setShowStd(true) }} style={{ padding: '6px 14px', background: ACCENT, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            {t('wardrobe.standardButton')}
          </button>}
          {!roomId && <button onClick={() => navigate('/dashboard')} style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            {t('common.navDashboard')}
          </button>}
        </div>
      </div>

      <div className="app-content" style={{ maxWidth: 1360, margin: '0 auto', padding: 20 }}>
        {readOnly && (
          <div className="wb-noprint" style={{ background: '#FFF6E5', color: '#8A6D3B', border: '1px solid #F0DDB5', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, textAlign: 'center', marginBottom: 12 }}>
            {lockSt.locked ? `🔒 ${t('wardrobe.room.lockedTip')}` : t('kitchenPlannerModule.viewOnlyTip')}
          </div>
        )}
        {stdDiffers && !readOnly && (
          <div className="wb-noprint" style={{ background: '#fff', border: '1px solid #eee7dd', borderRadius: 8, padding: '6px 12px', fontSize: 12, marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{t('wardrobe.room.savedStandard')}</span>
            <button style={ghost} onClick={() => setStd(localStd)}>{t('wardrobe.room.useCurrentStandard')}</button>
          </div>
        )}
        {tab === 'design' && (
          <div className="wb-noprint" style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {['wardrobe', 'closet'].map((m) => (
              <button key={m} disabled={readOnly} onClick={() => setMode(m)}
                style={{ ...ghost, padding: '7px 14px', fontWeight: 700, background: (closetMode ? 'closet' : 'wardrobe') === m ? DARK : '#fff', color: (closetMode ? 'closet' : 'wardrobe') === m ? '#fff' : DARK }}>
                {t(`wardrobe.mode.${m}`)}
              </button>
            ))}
          </div>
        )}
        {tab === 'contract' ? (
          <ContractTab cabinets={rows}
            projectName={room?.name || t('wardrobe.title')} grandTotal={price.grandTotal}
            defaultTerms={t('wardrobe.room.contractTerms')}
            listTitle={t(closetMode ? 'wardrobe.room.contractListCloset' : 'wardrobe.room.contractList', { name: room?.name || t('wardrobe.title'), count: rows.length })} />
        ) : tab === 'price' ? (
          <WardrobePriceTab design={design} std={std} result={result} materialsState={materialsState} readOnly={readOnly}
            onPricingChange={(pricing) => setField('pricing', pricing)}
            onOpenStandard={() => { setStdDraft(std); setShowStd(true) }} />
        ) : closetMode ? (
          <ClosetEditor design={design} setDesign={setDesign} result={result} std={std} readOnly={readOnly}
            frontColor={frontColor} constructionLabel={constructionLabel} colorPicker={colorPicker} />
        ) : (
        <div className="wb-grid">
          <fieldset className="wb-noprint" disabled={readOnly} style={FIELDSET}>
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{t('wardrobe.sizeTitle')}</div>
                <button style={ghost} onClick={resetDesign}>{t('wardrobe.reset')}</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <NumField title={t('wardrobe.width')} value={design.width} onChange={(v) => setField('width', v ?? 0)} />
                <NumField title={t('wardrobe.height')} value={design.height} onChange={(v) => setField('height', v ?? 0)} />
                <NumField title={t('wardrobe.depth')} value={design.depth} onChange={(v) => setField('depth', v ?? 0)} />
                <NumField title={t('wardrobe.fillerLeft')} value={design.fillerLeft} onChange={(v) => setField('fillerLeft', v ?? 0)} />
                <NumField title={t('wardrobe.fillerRight')} value={design.fillerRight} onChange={(v) => setField('fillerRight', v ?? 0)} />
                <NumField title={t('wardrobe.topFiller')} value={design.topFiller} onChange={(v) => setField('topFiller', v ?? 0)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10, alignItems: 'end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, paddingBottom: 8 }}>
                  <input type="checkbox" checked={!!design.loft} onChange={(e) => setField('loft', e.target.checked)} />
                  {t('wardrobe.loft')}
                </label>
                <NumField title={t('wardrobe.loftH')} value={design.loftH} disabled={!design.loft} onChange={(v) => setField('loftH', v ?? 0)} />
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={label}>{t('wardrobe.doorType')}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {DOOR_TYPES.map((dt) => (
                    <button key={dt} onClick={() => setField('doorType', dt)}
                      style={{ ...ghost, flex: 1, background: design.doorType === dt ? DARK : '#fff', color: design.doorType === dt ? '#fff' : DARK }}>
                      {t(`wardrobe.doorTypes.${dt}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={label}>{t('wardrobe.construction')}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {CONSTRUCTION_TYPES.map((ct) => (
                    <button key={ct} onClick={() => setField('construction', ct)}
                      style={{ ...ghost, flex: 1, background: (design.construction || 'boxes') === ct ? DARK : '#fff', color: (design.construction || 'boxes') === ct ? '#fff' : DARK }}>
                      {t(`wardrobe.constructionTypes.${ct}`)}
                    </button>
                  ))}
                </div>
                {design.construction === 'shared' && (
                  <div style={{ marginTop: 8 }}>
                    <span style={label}>{t('wardrobe.backType')}</span>
                    <select style={input} value={design.backType || 'none'} onChange={(e) => setField('backType', e.target.value)}>
                      {BACK_TYPES.map((bt) => <option key={bt} value={bt}>{t(`wardrobe.backTypes.${bt}`)}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={label}>{t('wardrobe.sections')}</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button style={ghost} onClick={() => setCount(design.sections.length - 1)}>−</button>
                  <div style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{design.sections.length}</div>
                  <button style={ghost} onClick={() => setCount(design.sections.length + 1)}>+</button>
                  <button style={ghost} onClick={() => setCount(autoSectionCount(design, std))}>{t('wardrobe.autoSections')}</button>
                </div>
              </div>
            </div>

            <SectionEditor design={design} setDesign={setDesign} result={result} std={std} selected={selected} setSelected={setSelected} />

            <ChecksCard warnings={result.warnings} />
          </fieldset>

          <div className="wb-print-full" style={{ minWidth: 0 }}>
            <div style={{ ...card, padding: 12 }} className="wb-noprint">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['front', '3d'].map((v) => (
                    <button key={v} onClick={() => setView(v)} style={{ ...ghost, background: view === v ? DARK : '#fff', color: view === v ? '#fff' : DARK }}>{t(`wardrobe.view.${v}`)}</button>
                  ))}
                </div>
                {view === '3d' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    {['closed', 'open', 'hidden'].map((m) => (
                      <button key={m} onClick={() => setDoorMode(m)} style={{ ...ghost, borderColor: doorMode === m ? ACCENT : '#ddd6cc', color: doorMode === m ? ACCENT : DARK }}>{t(`wardrobe.doorMode.${m}`)}</button>
                    ))}
                    {colorPicker}
                  </div>
                )}
              </div>
              {view === 'front' ? (
                <WardrobeElevation result={result} design={design} std={std} selected={{ section: si, zone: selected.zone }}
                  onSelectSection={(i) => setSelected({ section: i, zone: null })}
                  onSelectZone={(i, zi) => setSelected({ section: i, zone: zi })}
                  zoneLabel={zoneLabel} constructionLabel={constructionLabel} />
              ) : (
                <ErrorBoundary>
                  <Suspense fallback={<div style={{ height: 520, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>{t('wardrobe.loading3d')}</div>}>
                    <Wardrobe3D result={result} design={design} frontColor={frontColor} carcassColor="#f1ede6" doorMode={doorMode} label={constructionLabel} />
                  </Suspense>
                </ErrorBoundary>
              )}
              <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>{view === 'front' ? t('wardrobe.frontHint') : t('wardrobe.orbitHint')}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
              {[
                [t('wardrobe.stat.sections'), result.summary.sectionCount],
                [t('wardrobe.stat.body'), `${result.summary.bodyH ?? '—'}`],
                [t('wardrobe.stat.depth'), `${result.summary.usableDepth ?? '—'}`],
                [t('wardrobe.stat.doors'), result.summary.doorCount ?? 0],
                [t('wardrobe.stat.parts'), result.summary.partCount ?? 0],
                [t('wardrobe.stat.sheets'), result.materials.reduce((a, m) => a + m.sheets, 0)],
              ].map(([k, v]) => (
                <div key={k} style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: DARK }}>{v}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{k}</div>
                </div>
              ))}
            </div>

            <CutListPanel result={result} std={std}
              subtitle={<>{t('wardrobe.construction')}: <b>{constructionLabel}</b> · {Math.round(design.width)} × {Math.round(design.height)} × {Math.round(design.depth)} · {t(`wardrobe.doorTypes.${design.doorType}`)}</>}
              csvName={`wardrobe-cut-list-${Math.round(design.width)}x${Math.round(design.height)}.csv`} />
          </div>
        </div>
        )}
      </div>

      {showLink && (
        <LinkProjectModal onClose={() => setShowLink(false)} onLinked={onLinked}
          defaultRoomName={t('wardrobe.room.defaultName')} defaultRoomType={closetMode ? 'closet' : 'wardrobe'} roomTypes={['wardrobe', 'closet', 'bedroom', 'other']}
          canUseRoom={(r) => isWardrobeRoom({ room_type: r.room_type, planner_data: {} })} />
      )}

      {showStd && (
        <div className="wb-noprint" onClick={() => setShowStd(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 20, overflowY: 'auto', zIndex: 50 }}>
          <div dir={dir} onClick={(e) => e.stopPropagation()} style={{ background: '#F7F4F0', borderRadius: 14, padding: 18, width: '100%', maxWidth: 880 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{t('wardrobe.standardTitle')}</div>
              <button style={ghost} onClick={() => setShowStd(false)}>×</button>
            </div>
            <div style={{ fontSize: 12, color: '#777', marginBottom: 12 }}>{t('wardrobe.standardHint')}</div>
            {STANDARD_FIELD_GROUPS.map((g) => (
              <div key={g.id} style={card}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{t(`wardrobe.stdGroup.${g.id}`)}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
                  {g.fields.map((f) => STANDARD_ENUMS[f] ? (
                    <label key={f} style={{ display: 'block' }}>
                      <span style={label}>{t(`wardrobe.std.${f}`)}</span>
                      <select style={input} value={stdDraft[f] ?? DEFAULT_WARDROBE_STANDARD[f]} onChange={(e) => setStdDraft((s) => ({ ...s, [f]: e.target.value }))}>
                        {STANDARD_ENUMS[f].map((o) => <option key={o} value={o}>{t(`wardrobe.stdOption.${f}.${o}`)}</option>)}
                      </select>
                    </label>
                  ) : (
                    <NumField key={f} title={t(`wardrobe.std.${f}`)} value={stdDraft[f]} step={DECIMAL_FIELDS.has(f) ? 0.01 : 1}
                      placeholder={`${DEFAULT_WARDROBE_STANDARD[f]}`} onChange={(v) => setStdDraft((s) => ({ ...s, [f]: v }))} />
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={ghost} onClick={() => setStdDraft(DEFAULT_WARDROBE_STANDARD)}>{t('wardrobe.resetStandard')}</button>
              <button style={btn} onClick={saveStd} disabled={readOnly}>{t('wardrobe.saveStandard')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
