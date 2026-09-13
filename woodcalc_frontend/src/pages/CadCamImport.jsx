import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { useTranslation } from '../i18n/LanguageContext'
import {
  listImportJobs, createImportJob, getJobParts, getJobOffcuts,
  addOffcutToStock, sendToOptimizer, getCadCamSettings, updateCadCamSettings,
} from '../api/cadcam'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'

const PLATFORMS = [
  { id: 'bsolid', label: 'bSolid' },
  { id: 'cabinetvision', label: 'Cabinet Vision' },
  { id: 'alphacam', label: 'Alphacam' },
  { id: 'microvellum', label: 'Microvellum' },
  { id: 'woodwop', label: 'WoodWOP' },
]

export default function CadCamImport() {
  const { t, language } = useTranslation()
  const dir = language === 'ar' ? 'rtl' : 'ltr'
  const navigate = useNavigate()

  const [platform, setPlatform] = useState('bsolid')
  const [method, setMethod] = useState('csv')
  const [file, setFile] = useState(null)
  const [importing, setImporting] = useState(false)

  const [job, setJob] = useState(null)
  const [parts, setParts] = useState([])
  const [offcuts, setOffcuts] = useState([])
  const [loadingResults, setLoadingResults] = useState(false)

  const [recentJobs, setRecentJobs] = useState([])
  const [groups, setGroups] = useState(null)
  const [sending, setSending] = useState(false)

  const [thresholds, setThresholds] = useState({ cadcam_min_offcut_width_mm: '', cadcam_min_offcut_height_mm: '', cadcam_min_offcut_area_m2: '' })
  const [savingThresholds, setSavingThresholds] = useState(false)

  useEffect(() => {
    fetchRecentJobs()
    getCadCamSettings().then(flags => {
      setThresholds({
        cadcam_min_offcut_width_mm: flags.cadcam_min_offcut_width_mm ?? '',
        cadcam_min_offcut_height_mm: flags.cadcam_min_offcut_height_mm ?? '',
        cadcam_min_offcut_area_m2: flags.cadcam_min_offcut_area_m2 ?? '',
      })
    }).catch(() => {})
  }, [])

  const fetchRecentJobs = async () => {
    try {
      const data = await listImportJobs()
      setRecentJobs(Array.isArray(data) ? data : (data.results || []))
    } catch {}
  }

  const saveThresholds = async () => {
    setSavingThresholds(true)
    try {
      const patch = {}
      if (thresholds.cadcam_min_offcut_width_mm !== '') patch.cadcam_min_offcut_width_mm = Number(thresholds.cadcam_min_offcut_width_mm)
      if (thresholds.cadcam_min_offcut_height_mm !== '') patch.cadcam_min_offcut_height_mm = Number(thresholds.cadcam_min_offcut_height_mm)
      if (thresholds.cadcam_min_offcut_area_m2 !== '') patch.cadcam_min_offcut_area_m2 = Number(thresholds.cadcam_min_offcut_area_m2)
      await updateCadCamSettings(patch)
    } catch {}
    setSavingThresholds(false)
  }

  const loadJobResults = async (jobRow) => {
    setJob(jobRow)
    setGroups(null)
    if (jobRow.status !== 'done') { setParts([]); setOffcuts([]); return }
    setLoadingResults(true)
    try {
      const [p, o] = await Promise.all([getJobParts(jobRow.id), getJobOffcuts(jobRow.id)])
      setParts(Array.isArray(p) ? p : [])
      setOffcuts(Array.isArray(o) ? o : [])
    } catch {}
    setLoadingResults(false)
  }

  const runImport = async () => {
    if (method === 'csv' && !file) return
    setImporting(true)
    try {
      const created = await createImportJob({ platform, method, file })
      await fetchRecentJobs()
      await loadJobResults(created)
    } catch {}
    setImporting(false)
  }

  const reset = () => {
    setJob(null)
    setParts([])
    setOffcuts([])
    setGroups(null)
    setFile(null)
  }

  const markUsable = async (offcutId) => {
    const updated = await addOffcutToStock(offcutId)
    setOffcuts(prev => prev.map(o => o.id === updated.id ? updated : o))
  }

  const handleSendToOptimizer = async () => {
    setSending(true)
    try {
      const res = await sendToOptimizer(job.id)
      if (res.groups.length === 1) {
        goToOptimizerWithGroup(res.groups[0])
      } else {
        setGroups(res.groups)
      }
    } catch {}
    setSending(false)
  }

  const goToOptimizerWithGroup = (group) => {
    const key = `cadcam_group_${job.id}`
    sessionStorage.setItem(key, JSON.stringify(group))
    navigate(`/cutting-optimizer?cadcam_import=${job.id}`)
  }

  const sheetsUsed = new Set(parts.map(p => p.sheet_ref)).size
  const bandedEdges = parts.reduce((sum, p) => sum + [p.edgeband_top, p.edgeband_bottom, p.edgeband_left, p.edgeband_right].filter(Boolean).length, 0)
  const usableOffcuts = offcuts.filter(o => o.is_usable).length

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Logo forDarkBg onClick={() => navigate('/dashboard')} height={22} />
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{t('cadcamImport.title')}</span>
        </div>
        <button onClick={() => navigate('/dashboard')}
          style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          {t('common.navDashboard')}
        </button>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: DARK }}>{t('cadcamImport.title')}</h1>
        <div style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>{t('cadcamImport.subtitle')}</div>

        {/* Usable offcut threshold */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: DARK, marginBottom: 10 }}>{t('cadcamImport.thresholdTitle')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
            <MiniField label={t('cadcamImport.minWidth')} value={thresholds.cadcam_min_offcut_width_mm}
              onChange={v => setThresholds(s => ({ ...s, cadcam_min_offcut_width_mm: v }))} />
            <MiniField label={t('cadcamImport.minHeight')} value={thresholds.cadcam_min_offcut_height_mm}
              onChange={v => setThresholds(s => ({ ...s, cadcam_min_offcut_height_mm: v }))} />
            <MiniField label={t('cadcamImport.minArea')} value={thresholds.cadcam_min_offcut_area_m2}
              onChange={v => setThresholds(s => ({ ...s, cadcam_min_offcut_area_m2: v }))} step="0.01" />
            <button onClick={saveThresholds} disabled={savingThresholds}
              style={{ padding: '8px 14px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, height: 34 }}>
              {savingThresholds ? t('cadcamImport.saving') : t('cadcamImport.save')}
            </button>
          </div>
        </div>

        {!job && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{t('cadcamImport.sourcePlatform')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {PLATFORMS.map(p => (
                <div key={p.id} onClick={() => setPlatform(p.id)}
                  style={{ padding: '8px 14px', border: `1.5px solid ${platform === p.id ? ACCENT : '#E0DAD4'}`, borderRadius: 8, cursor: 'pointer', background: platform === p.id ? ACCENT + '12' : '#FAFAFA', fontSize: 12, fontWeight: 700, color: platform === p.id ? ACCENT : DARK }}>
                  {p.label}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <div onClick={() => setMethod('api')}
                style={{ flex: 1, textAlign: 'center', padding: '10px', border: `1.5px solid ${method === 'api' ? ACCENT : '#E0DAD4'}`, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: method === 'api' ? ACCENT : '#888' }}>
                {t('cadcamImport.methodApi')}
              </div>
              <div onClick={() => setMethod('csv')}
                style={{ flex: 1, textAlign: 'center', padding: '10px', border: `1.5px solid ${method === 'csv' ? ACCENT : '#E0DAD4'}`, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: method === 'csv' ? ACCENT : '#888' }}>
                {t('cadcamImport.methodCsv')}
              </div>
            </div>

            {method === 'api' && (
              <div style={{ padding: 16, background: '#FAFAFA', borderRadius: 8, fontSize: 12, color: '#888', marginBottom: 16, textAlign: 'center' }}>
                {t('cadcamImport.apiComingSoon')}
              </div>
            )}

            {method === 'csv' && (
              <div style={{ marginBottom: 16 }}>
                <input type="file" accept=".csv" onChange={e => setFile(e.target.files[0] || null)}
                  style={{ width: '100%', padding: '10px', border: '1.5px dashed #E0DAD4', borderRadius: 8, fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            )}

            <button onClick={runImport} disabled={importing || (method === 'csv' && !file) || method === 'api'}
              style={{ width: '100%', padding: '12px', background: (method === 'api') ? '#E0DAD4' : ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: (method === 'api') ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700 }}>
              {importing ? t('cadcamImport.importing', { platform: PLATFORMS.find(p => p.id === platform).label }) : t('cadcamImport.importFrom', { platform: PLATFORMS.find(p => p.id === platform).label })}
            </button>
          </div>
        )}

        {job && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              {job.status === 'done' ? (
                <div style={{ color: '#2AC87A', fontSize: 13, fontWeight: 700 }}>✓ {t('cadcamImport.importedFrom', { platform: PLATFORMS.find(p => p.id === job.platform)?.label || job.platform_label })}</div>
              ) : job.status === 'failed' ? (
                <div style={{ color: '#E74C3C', fontSize: 13, fontWeight: 700 }}>⚠ {t('cadcamImport.importFailed')}</div>
              ) : (
                <div style={{ color: '#888', fontSize: 13 }}>{t('cadcamImport.processing')}</div>
              )}
              <button onClick={reset} style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}>
                {t('cadcamImport.importAnother')}
              </button>
            </div>

            {job.status === 'failed' && (
              <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 10, padding: 16, color: '#C0392B', fontSize: 13, marginBottom: 20 }}>
                {job.error_message}
              </div>
            )}

            {job.status === 'done' && !loadingResults && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
                  <StatCard label={t('cadcamImport.statParts')} value={parts.length} />
                  <StatCard label={t('cadcamImport.statSheets')} value={sheetsUsed} />
                  <StatCard label={t('cadcamImport.statEdges')} value={bandedEdges} />
                  <StatCard label={t('cadcamImport.statOffcuts')} value={usableOffcuts} />
                </div>

                <div style={{ fontWeight: 700, fontSize: 14, color: DARK, marginBottom: 10 }}>{t('cadcamImport.partList')}</div>
                {parts.length === 0 ? (
                  <div style={{ color: '#bbb', fontSize: 12, marginBottom: 24 }}>{t('cadcamImport.noParts')}</div>
                ) : (
                  <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 24, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                      <thead>
                        <tr style={{ background: '#FAFAFA' }}>
                          {[t('cadcamImport.colPart'), t('cadcamImport.colMaterial'), t('cadcamImport.colDims'), t('cadcamImport.colGrain'), t('cadcamImport.colEdgebanding'), t('cadcamImport.colMachining')].map((h, hi) => (
                            <th key={hi} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#888' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parts.map(p => (
                          <tr key={p.id} style={{ borderBottom: '1px solid #F7F4F0' }}>
                            <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: DARK }}>{p.part_code}</td>
                            <td style={{ padding: '8px 12px', fontSize: 11, color: '#666' }}>
                              {p.material_name || '—'}
                              <div style={{ color: '#aaa' }}>{p.sheet_ref}</div>
                            </td>
                            <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: 'monospace' }}>{p.width_mm} × {p.height_mm}</td>
                            <td style={{ padding: '8px 12px', fontSize: 11 }}>{p.grain === 'V' ? '↕' : p.grain === 'H' ? '↔' : '—'}</td>
                            <td style={{ padding: '8px 12px', fontSize: 10 }}>
                              <EdgebandCell part={p} />
                            </td>
                            <td style={{ padding: '8px 12px', fontSize: 10, color: '#666' }}>
                              {(p.machining_ops || []).map((op, i) => <div key={i}>• {op}</div>)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ fontWeight: 700, fontSize: 14, color: DARK, marginBottom: 10 }}>{t('cadcamImport.offcutsFound')}</div>
                {offcuts.length === 0 ? (
                  <div style={{ color: '#bbb', fontSize: 12, marginBottom: 24 }}>{t('cadcamImport.noOffcuts')}</div>
                ) : (
                  <div style={{ marginBottom: 24 }}>
                    {offcuts.map(o => (
                      <div key={o.id} style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: DARK, fontFamily: 'monospace' }}>{o.width_mm} × {o.height_mm}</div>
                          <div style={{ fontSize: 11, color: '#888' }}>{o.material_name || '—'} — {o.sheet_ref}</div>
                        </div>
                        {o.added_to_stock ? (
                          <span style={{ fontSize: 11, color: '#2AC87A', fontWeight: 700 }}>✓ {t('cadcamImport.inStock')}</span>
                        ) : o.is_usable ? (
                          <button onClick={() => markUsable(o.id)}
                            style={{ padding: '7px 12px', border: '1.5px solid #2AC87A', color: '#2AC87A', background: '#fff', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                            {t('cadcamImport.addToStock')}
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: '#aaa' }}>{t('cadcamImport.belowThreshold')}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {groups && groups.length > 1 && (
                  <div style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: DARK, marginBottom: 10 }}>{t('cadcamImport.pickGroup')}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {groups.map((g, gi) => (
                        <button key={gi} onClick={() => goToOptimizerWithGroup(g)}
                          style={{ padding: '8px 14px', border: '1.5px solid ' + ACCENT, color: ACCENT, background: '#fff', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                          {g.material_sku} · {g.thickness}mm · {g.parts.length} {t('cadcamImport.parts')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={handleSendToOptimizer} disabled={sending || parts.length === 0}
                  style={{ width: '100%', padding: '13px', background: '#fff', border: '1.5px solid #E0DAD4', color: DARK, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                  {sending ? t('cadcamImport.sending') : t('cadcamImport.sendToOptimizer')} →
                </button>
              </>
            )}
          </div>
        )}

        {recentJobs.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: DARK, marginBottom: 10 }}>{t('cadcamImport.recentImports')}</div>
            {recentJobs.map(rj => (
              <div key={rj.id} onClick={() => loadJobResults(rj)}
                style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', marginBottom: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <span style={{ fontWeight: 600, color: DARK }}>{rj.platform_label}</span>
                <span style={{ color: rj.status === 'done' ? '#2AC87A' : rj.status === 'failed' ? '#E74C3C' : '#888' }}>{rj.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: DARK }}>{value}</div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function EdgebandCell({ part }) {
  const sides = [
    ['T', part.edgeband_top], ['B', part.edgeband_bottom],
    ['L', part.edgeband_left], ['R', part.edgeband_right],
  ]
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {sides.map(([label, on]) => (
        <span key={label} style={{ width: 16, height: 16, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, background: on ? ACCENT : '#F0EBE5', color: on ? '#fff' : '#bbb' }}>
          {label}
        </span>
      ))}
    </div>
  )
}

function MiniField({ label, value, onChange, step }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>{label}</div>
      <input type="number" step={step || '1'} value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK }} />
    </div>
  )
}
