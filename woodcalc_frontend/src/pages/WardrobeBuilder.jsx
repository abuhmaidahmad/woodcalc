import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { useTranslation } from '../i18n/LanguageContext'
import { DEFAULT_WARDROBE_STANDARD, STANDARD_FIELD_GROUPS, loadStandard, saveStandard, normalizeStandard } from '../features/wardrobe/wardrobeStandard'
import { computeWardrobe, defaultDesign, withSectionCount, autoSectionCount, presetZones, newZone, sectionWidths, cutListCsv, PRESET_IDS, ZONE_TYPES, DOOR_TYPES } from '../features/wardrobe/wardrobeEngine'
import WardrobeElevation from '../features/wardrobe/WardrobeElevation'

const Wardrobe3D = lazy(() => import('../features/wardrobe/Wardrobe3D'))

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'
const DESIGN_KEY = 'woodcalc.wardrobeDesign.v1'

const FRONT_COLORS = [
  { id: 'white', hex: '#f3f1ec' },
  { id: 'cashmere', hex: '#d8cbb8' },
  { id: 'oak', hex: '#c49a6c' },
  { id: 'walnut', hex: '#6e4b33' },
  { id: 'grey', hex: '#8b8d8f' },
  { id: 'green', hex: '#5d6b58' },
  { id: 'black', hex: '#2c2c2c' },
]

const card = { background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 14 }
const label = { fontSize: 11, color: '#777', marginBottom: 4, display: 'block' }
const input = { width: '100%', boxSizing: 'border-box', padding: '7px 9px', border: '1px solid #ddd6cc', borderRadius: 7, fontSize: 13, background: '#fff' }
const btn = { padding: '7px 12px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700 }
const ghost = { padding: '6px 10px', background: '#fff', color: DARK, border: '1px solid #ddd6cc', borderRadius: 7, cursor: 'pointer', fontSize: 12 }
const th = { textAlign: 'start', padding: '7px 8px', fontSize: 11, color: '#777', fontWeight: 600, borderBottom: '1px solid #eee7dd', whiteSpace: 'nowrap' }
const td = { padding: '7px 8px', fontSize: 12, borderBottom: '1px solid #f3eee7', whiteSpace: 'nowrap' }

function loadDesign(std) {
  try {
    const d = JSON.parse(localStorage.getItem(DESIGN_KEY) || 'null')
    if (d && Array.isArray(d.sections) && d.sections.length) return d
  } catch {}
  return defaultDesign(std)
}

function NumField({ title, value, onChange, placeholder, min = 0, step = 1, disabled }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={label}>{title}</span>
      <input type="number" min={min} step={step} style={{ ...input, background: disabled ? '#f5f2ed' : '#fff' }} value={value ?? ''} placeholder={placeholder}
        disabled={disabled} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
    </label>
  )
}

export default function WardrobeBuilder() {
  const { t, language } = useTranslation()
  const dir = language === 'ar' ? 'rtl' : 'ltr'
  const navigate = useNavigate()
  const [std, setStd] = useState(loadStandard)
  const [design, setDesign] = useState(() => loadDesign(loadStandard()))
  const [selected, setSelected] = useState({ section: 0, zone: null })
  const [view, setView] = useState('front')
  const [doorMode, setDoorMode] = useState('closed')
  const [frontColor, setFrontColor] = useState(FRONT_COLORS[2].hex)
  const [showStd, setShowStd] = useState(false)
  const [stdDraft, setStdDraft] = useState(std)

  useEffect(() => {
    try { localStorage.setItem(DESIGN_KEY, JSON.stringify(design)) } catch {}
  }, [design])

  const result = useMemo(() => computeWardrobe(design, std), [design, std])
  const widths = useMemo(() => sectionWidths(design), [design])
  const si = Math.min(selected.section, design.sections.length - 1)
  const sec = design.sections[si]
  const secOut = result.sections[si]

  const setField = (k, v) => setDesign((d) => ({ ...d, [k]: v }))
  const setSection = (i, patch) => setDesign((d) => ({ ...d, sections: d.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))
  const setZones = (i, fn) => setDesign((d) => ({ ...d, sections: d.sections.map((s, j) => (j === i ? { ...s, preset: null, zones: fn(s.zones || []) } : s)) }))
  const setCount = (n) => setDesign((d) => withSectionCount(d, n, std))
  const zoneLabel = (z) => t(`wardrobe.zone.${z.type}`)

  const updateZone = (zi, patch) => setZones(si, (zs) => zs.map((z, j) => (j === zi ? { ...z, ...patch } : z)))
  const setAuto = (zi) => setZones(si, (zs) => zs.map((z, j) => ({ ...z, auto: j === zi, h: j === zi ? z.h : (z.auto ? Math.round(secOut?.zones?.[j]?.h || z.h || 400) : z.h) })))
  const moveZone = (zi, by) => setZones(si, (zs) => {
    const out = [...zs]
    const j = zi + by
    if (j < 0 || j >= out.length) return zs
    ;[out[zi], out[j]] = [out[j], out[zi]]
    return out
  })
  const removeZone = (zi) => {
    setZones(si, (zs) => (zs.length > 1 ? zs.filter((_, j) => j !== zi) : zs))
    setSelected((s) => ({ ...s, zone: null }))
  }
  const addZone = (type) => setZones(si, (zs) => [newZone(type, std), ...zs])

  const exportCsv = () => {
    const csv = cutListCsv(result)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `wardrobe-cut-list-${Math.round(design.width)}x${Math.round(design.height)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const saveStd = () => {
    const clean = normalizeStandard(stdDraft)
    setStd(clean)
    saveStandard(clean)
    setShowStd(false)
  }

  const resetDesign = () => {
    setDesign(defaultDesign(std))
    setSelected({ section: 0, zone: null })
  }

  const partName = (p) => (language === 'ar' && p.nameAr ? p.nameAr : p.name)
  const edgeText = (e) => (e ? e.split(',').map((c) => t(`wardrobe.edge.${c}`)).join(' · ') : '—')
  const errors = result.warnings.filter((w) => w.level === 'error')

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      <style>{`@media print { .wb-noprint { display: none !important } .wb-print-full { width: 100% !important } body { background: #fff } } .wb-grid { display: grid; grid-template-columns: 330px minmax(0, 1fr); gap: 16px } @media (max-width: 900px) { .wb-grid { grid-template-columns: 1fr } }`}</style>
      <div className="app-topbar wb-noprint" style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Logo forDarkBg onClick={() => navigate('/dashboard')} height={22} />
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{t('wardrobe.title')}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setStdDraft(std); setShowStd(true) }} style={{ padding: '6px 14px', background: ACCENT, border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            {t('wardrobe.standardButton')}
          </button>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            {t('common.navDashboard')}
          </button>
        </div>
      </div>

      <div className="app-content" style={{ maxWidth: 1360, margin: '0 auto', padding: 20 }}>
        <div className="wb-grid">
          <div className="wb-noprint">
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
                <span style={label}>{t('wardrobe.sections')}</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button style={ghost} onClick={() => setCount(design.sections.length - 1)}>−</button>
                  <div style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{design.sections.length}</div>
                  <button style={ghost} onClick={() => setCount(design.sections.length + 1)}>+</button>
                  <button style={ghost} onClick={() => setCount(autoSectionCount(design, std))}>{t('wardrobe.autoSections')}</button>
                </div>
              </div>
            </div>

            {sec && (
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{t('wardrobe.sectionTitle', { n: si + 1 })}</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {design.sections.map((_, i) => (
                      <button key={i} onClick={() => setSelected({ section: i, zone: null })}
                        style={{ width: 26, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: i === si ? ACCENT : '#eee7dd', color: i === si ? '#fff' : DARK }}>{i + 1}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <NumField title={t('wardrobe.sectionWidth')} value={sec.w} placeholder={`${t('wardrobe.auto')} ${widths[si] ?? ''}`} onChange={(v) => setSection(si, { w: v })} />
                  <NumField title={t('wardrobe.doorCount')} value={sec.doors} disabled={design.doorType !== 'hinged'}
                    placeholder={`${t('wardrobe.auto')} ${secOut?.doors ?? ''}`} onChange={(v) => setSection(si, { doors: v })} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <span style={label}>{t('wardrobe.presetsTitle')}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {PRESET_IDS.map((p) => (
                      <button key={p} onClick={() => { setSection(si, { preset: p, zones: presetZones(p, std) }); setSelected({ section: si, zone: null }) }}
                        style={{ ...ghost, borderColor: sec.preset === p ? ACCENT : '#ddd6cc', color: sec.preset === p ? ACCENT : DARK, fontWeight: sec.preset === p ? 700 : 400 }}>
                        {t(`wardrobe.presets.${p}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={label}>{t('wardrobe.zonesTitle')}</span>
                    <select style={{ ...input, width: 'auto', padding: '4px 6px', fontSize: 12 }} value="" onChange={(e) => { if (e.target.value) addZone(e.target.value) }}>
                      <option value="">{t('wardrobe.addZone')}</option>
                      {ZONE_TYPES.map((zt) => <option key={zt} value={zt}>{t(`wardrobe.zone.${zt}`)}</option>)}
                    </select>
                  </div>
                  {(sec.zones || []).map((z, zi) => {
                    const rz = secOut?.zones?.[zi]
                    const active = selected.zone === zi
                    return (
                      <div key={zi} onClick={() => setSelected({ section: si, zone: zi })}
                        style={{ border: `1px solid ${active ? ACCENT : '#eee7dd'}`, background: active ? '#fdf8ef' : '#fff', borderRadius: 8, padding: 8, marginTop: 6, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <select style={{ ...input, padding: '4px 6px', fontSize: 12 }} value={z.type}
                            onChange={(e) => updateZone(zi, e.target.value === 'drawers' ? { type: 'drawers', n: 2, h: 2 * std.drawerH } : { type: e.target.value, n: e.target.value === 'shelves' ? null : undefined })}>
                            {ZONE_TYPES.map((zt) => <option key={zt} value={zt}>{t(`wardrobe.zone.${zt}`)}</option>)}
                          </select>
                          <button style={{ ...ghost, padding: '3px 7px' }} title={t('wardrobe.moveUp')} onClick={(e) => { e.stopPropagation(); moveZone(zi, -1) }}>↑</button>
                          <button style={{ ...ghost, padding: '3px 7px' }} title={t('wardrobe.moveDown')} onClick={(e) => { e.stopPropagation(); moveZone(zi, 1) }}>↓</button>
                          <button style={{ ...ghost, padding: '3px 7px', color: '#b23b3b' }} title={t('wardrobe.remove')} onClick={(e) => { e.stopPropagation(); removeZone(zi) }}>×</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6, marginTop: 6, alignItems: 'end' }}>
                          <NumField title={t('wardrobe.zoneHeight')} value={rz?.auto ? null : z.h} placeholder={rz ? `${t('wardrobe.auto')} ${Math.round(rz.h)}` : ''}
                            disabled={rz?.auto} onChange={(v) => updateZone(zi, { h: v ?? 0 })} />
                          {z.type === 'shelves' || z.type === 'drawers' ? (
                            <NumField title={z.type === 'shelves' ? t('wardrobe.shelfCount') : t('wardrobe.drawerCount')} value={z.n}
                              placeholder={rz ? `${t('wardrobe.auto')} ${rz.n}` : ''}
                              onChange={(v) => updateZone(zi, z.type === 'drawers' ? { n: v || 1, h: (v || 1) * std.drawerH } : { n: v })} />
                          ) : <div />}
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, paddingBottom: 8 }} onClick={(e) => e.stopPropagation()}>
                            <input type="radio" checked={!!rz?.auto} onChange={() => setAuto(zi)} />
                            {t('wardrobe.fillRest')}
                          </label>
                        </div>
                      </div>
                    )
                  })}
                  <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>{t('wardrobe.zonesHint')}</div>
                </div>
              </div>
            )}

            <div style={card}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{t('wardrobe.checksTitle')}</div>
              {result.warnings.length === 0 && <div style={{ fontSize: 12, color: '#2f7d4f' }}>{t('wardrobe.allGood')}</div>}
              {result.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, marginBottom: 6, background: w.level === 'error' ? '#fdecec' : '#fff6e5', color: w.level === 'error' ? '#9b2c2c' : '#7a5410' }}>
                  {t(`wardrobe.warn.${w.code}`, w.params)}
                </div>
              ))}
            </div>
          </div>

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
                    <div style={{ display: 'flex', gap: 4, marginInlineStart: 6 }}>
                      {FRONT_COLORS.map((c) => (
                        <button key={c.id} title={t(`wardrobe.colors.${c.id}`)} onClick={() => setFrontColor(c.hex)}
                          style={{ width: 22, height: 22, borderRadius: 11, background: c.hex, cursor: 'pointer', border: frontColor === c.hex ? `2px solid ${ACCENT}` : '1px solid #ccc' }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {view === 'front' ? (
                <WardrobeElevation result={result} design={design} std={std} selected={{ section: si, zone: selected.zone }}
                  onSelectSection={(i) => setSelected({ section: i, zone: null })}
                  onSelectZone={(i, zi) => setSelected({ section: i, zone: zi })}
                  zoneLabel={zoneLabel} />
              ) : (
                <Suspense fallback={<div style={{ height: 520, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>{t('wardrobe.loading3d')}</div>}>
                  <Wardrobe3D result={result} design={design} frontColor={frontColor} carcassColor="#f1ede6" doorMode={doorMode} />
                </Suspense>
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

            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{t('wardrobe.cutListTitle')}</div>
                <div className="wb-noprint" style={{ display: 'flex', gap: 6 }}>
                  <button style={ghost} onClick={exportCsv} disabled={errors.length > 0}>{t('wardrobe.exportCsv')}</button>
                  <button style={btn} onClick={() => window.print()}>{t('wardrobe.print')}</button>
                </div>
              </div>
              {errors.length > 0 && <div style={{ fontSize: 12, color: '#9b2c2c', marginBottom: 8 }}>{t('wardrobe.fixErrors')}</div>}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['#', 'part', 'section', 'length', 'width', 'thickness', 'qty', 'material', 'edges'].map((h) => (
                        <th key={h} style={th}>{h === '#' ? '#' : t(`wardrobe.col.${h}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.parts.map((p, i) => (
                      <tr key={i}>
                        <td style={td}>{i + 1}</td>
                        <td style={{ ...td, fontWeight: 600 }}>
                          <span>{partName(p)}</span>
                          {p.loft && <span style={{ display: 'inline-block', marginInlineStart: 8, fontSize: 10, color: ACCENT }}>{t('wardrobe.loft')}</span>}
                          <div style={{ fontSize: 10, color: '#aaa', fontWeight: 400 }}>{language === 'ar' ? p.name : p.nameAr}</div>
                        </td>
                        <td style={td}>{p.sections.map((s) => (s === 'ALL' ? t('wardrobe.all') : s)).join(' ')}</td>
                        <td style={td}>{p.L}</td>
                        <td style={td}>{p.W}</td>
                        <td style={td}>{p.T}</td>
                        <td style={{ ...td, fontWeight: 700 }}>{p.qty}</td>
                        <td style={td}>{t(`wardrobe.material.${p.material}`)}</td>
                        <td style={td}>{edgeText(p.edges)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              <div style={card}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{t('wardrobe.hardwareTitle')}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {Object.entries(result.hardware).map(([k, v]) => (
                      <tr key={k}><td style={td}>{t(`wardrobe.hw.${k}`)}</td><td style={{ ...td, fontWeight: 700, textAlign: 'end' }}>{v}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={card}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{t('wardrobe.materialsTitle')}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr><th style={th}>{t('wardrobe.col.material')}</th><th style={th}>{t('wardrobe.col.thickness')}</th><th style={th}>m²</th><th style={th}>{t('wardrobe.sheetsCol', { l: std.sheetL, w: std.sheetW })}</th></tr>
                  </thead>
                  <tbody>
                    {result.materials.map((m) => (
                      <tr key={`${m.material}-${m.T}`}><td style={td}>{t(`wardrobe.material.${m.material}`)}</td><td style={td}>{m.T}</td><td style={td}>{m.areaM2}</td><td style={{ ...td, fontWeight: 700 }}>{m.sheets}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontWeight: 700, fontSize: 13, margin: '12px 0 6px' }}>{t('wardrobe.edgeTitle')}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {result.edgeBanding.map((e) => (
                      <tr key={`${e.material}-${e.thickness}`}><td style={td}>{t(`wardrobe.material.${e.material}`)} · {e.thickness} mm</td><td style={{ ...td, fontWeight: 700, textAlign: 'end' }}>{e.meters} m</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

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
                  {g.fields.map((f) => (
                    <NumField key={f} title={t(`wardrobe.std.${f}`)} value={stdDraft[f]} step={f === 'wasteFactor' ? 0.01 : 1}
                      placeholder={`${DEFAULT_WARDROBE_STANDARD[f]}`} onChange={(v) => setStdDraft((s) => ({ ...s, [f]: v }))} />
                  ))}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={ghost} onClick={() => setStdDraft(DEFAULT_WARDROBE_STANDARD)}>{t('wardrobe.resetStandard')}</button>
              <button style={btn} onClick={saveStd}>{t('wardrobe.saveStandard')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
