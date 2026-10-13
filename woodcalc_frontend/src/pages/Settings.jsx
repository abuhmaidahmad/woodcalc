import React, { useState, useEffect } from 'react'
import Logo from '../components/Logo'
import { authFetch, getCompany, isReadOnly } from '../api/auth'
import { createCheckout } from '../api/billing'
import { listFeedback } from '../api/feedback'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../i18n/LanguageContext'
import TeamCard from '../components/TeamCard'
import CabinetTemplateApprovalQueue from '../components/CabinetTemplateApprovalQueue'
import { ONBOARDING_MODULES } from '../onboardingSteps'
import { getCompanySettings, updateCompanySettings } from '../api/companySettings'
import { BACK_PANEL_THICKNESS_OPTIONS, isBackPanelMaterial, isGlassMaterial, isGlassDoorMaterial } from '../features/kitchen_planner/formulaEngine'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'
const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

const FEEDBACK_STATUS_COLORS = {
  new: '#C8902A', reviewing: '#2A6ACC', planned: '#8A2AC8', declined: '#999', done: '#2AC87A',
}

const PLANS = [
  { id: 'starter', label: 'Starter', priceJod: 300 },
  { id: 'pro', label: 'Pro', priceJod: 600 },
  { id: 'enterprise', label: 'Enterprise', priceJod: 1200 },
]

function ManufacturingStandardsCard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const readOnly = isReadOnly()
  const [saved, setSaved] = useState(null) // { sku, mm, glassSku }
  const [sku, setSku] = useState('')
  const [glassSku, setGlassSku] = useState('')
  const [glassMaterials, setGlassMaterials] = useState([])
  const [doorSku, setDoorSku] = useState('')
  const [doorMaterials, setDoorMaterials] = useState([])
  const [mm, setMm] = useState(8)
  const [materials, setMaterials] = useState([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    getCompanySettings()
      .then(flags => {
        const v = { sku: flags.back_panel_material_sku || '', mm: Number(flags.back_panel_thickness_mm) || 8, glassSku: flags.glass_shelf_material_sku || '', doorSku: flags.glass_door_material_sku || '' }
        setSaved(v); setSku(v.sku); setMm(v.mm); setGlassSku(v.glassSku); setDoorSku(v.doorSku)
      })
      .catch(() => { setSaved({ sku: '', mm: 8, glassSku: '', doorSku: '' }) })
    const fetchAll = async (url, acc = []) => {
      const data = await (await authFetch(url)).json()
      const list = acc.concat(data.results || data || [])
      return data.next ? fetchAll(data.next.replace(/^https?:/, new URL(API).protocol), list) : list
    }
    fetchAll(API + '/api/inventory/materials/')
      .then(list => { setMaterials(list.filter(isBackPanelMaterial)); setGlassMaterials(list.filter(isGlassMaterial)); setDoorMaterials(list.filter(isGlassDoorMaterial)) })
      .catch(() => {})
  }, [])

  const selectedMat = materials.find(m => m.sku === sku)
  const effectiveMm = sku ? (selectedMat?.board_thickness || saved?.mm) : mm

  const save = async () => {
    setSaving(true); setMessage('')
    try {
      const flags = await updateCompanySettings({
        ...(sku ? { back_panel_material_sku: sku } : { back_panel_material_sku: null, back_panel_thickness_mm: mm }),
        glass_shelf_material_sku: glassSku || null,
        glass_door_material_sku: doorSku || null,
      })
      const v = { sku: flags.back_panel_material_sku || '', mm: Number(flags.back_panel_thickness_mm) || 8, glassSku: flags.glass_shelf_material_sku || '', doorSku: flags.glass_door_material_sku || '' }
      setSaved(v); setSku(v.sku); setMm(v.mm); setGlassSku(v.glassSku); setDoorSku(v.doorSku)
      setMessage(t('settings.standardsSaved'))
    } catch (e) {
      setMessage(`${t('settings.standardsError')}: ${e.message}`)
    }
    setSaving(false)
  }

  const dirty = saved != null && (sku !== saved.sku || (!sku && mm !== saved.mm) || glassSku !== saved.glassSku || doorSku !== saved.doorSku)
  const selectedGlass = glassMaterials.find(m => m.sku === glassSku)
  const labelStyle = { fontSize: 11, color: '#666', marginBottom: 6, fontWeight: 500 }
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: 20 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: DARK }}>{t('settings.standardsTitle')}</h2>
      <div style={{ color: '#888', fontSize: 12, marginBottom: 16 }}>{t('settings.standardsDesc')}</div>
      {saved == null ? (
        <div style={{ color: '#bbb', fontSize: 13 }}>{t('common.loading')}</div>
      ) : (
        <>
          <div style={labelStyle}>{t('settings.backPanelMaterial')}</div>
          <select value={sku} disabled={readOnly} onChange={e => { setSku(e.target.value); setMessage('') }}
            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 13, color: DARK, background: '#fff', marginBottom: 6, boxSizing: 'border-box' }}>
            <option value="">{t('settings.backPanelNoMaterial')}</option>
            {materials.map(m => (
              <option key={m.sku} value={m.sku}>{m.name} · {m.sku} ({m.board_thickness || '?'}mm)</option>
            ))}
            {sku && !selectedMat && <option value={sku}>{sku}</option>}
          </select>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 16 }}>
            {sku ? t('settings.backPanelMaterialHint') : (
              <>
                {t('settings.backPanelNoMaterialsHint')}{' '}
                <span onClick={() => navigate('/catalog')} style={{ color: ACCENT, cursor: 'pointer', fontWeight: 600 }}>→</span>
              </>
            )}
          </div>

          <div style={labelStyle}>{t('settings.backPanelThickness')}</div>
          {sku ? (
            <div style={{ fontSize: 14, fontWeight: 700, color: DARK, marginBottom: 6 }}>{effectiveMm}mm</div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              {BACK_PANEL_THICKNESS_OPTIONS.map(th => (
                <button key={th} onClick={() => { setMm(th); setMessage('') }} disabled={readOnly}
                  style={{ flex: 1, padding: '10px 6px', border: `2px solid ${mm === th ? ACCENT : '#E0DAD4'}`, borderRadius: 8, cursor: readOnly ? 'default' : 'pointer', background: mm === th ? ACCENT + '10' : '#FAFAFA', color: mm === th ? ACCENT : DARK, fontSize: 13, fontWeight: 700 }}>
                  {th}mm
                </button>
              ))}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#999', marginBottom: 16 }}>{t('settings.backPanelHint')}</div>

          <div style={labelStyle}>{t('settings.glassShelfMaterial')}</div>
          <select value={glassSku} disabled={readOnly} onChange={e => { setGlassSku(e.target.value); setMessage('') }}
            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 13, color: DARK, background: '#fff', marginBottom: 6, boxSizing: 'border-box' }}>
            <option value="">{t('settings.glassShelfNoMaterial')}</option>
            {glassMaterials.map(m => (
              <option key={m.sku} value={m.sku}>{m.name} · {m.sku} ({m.board_thickness || '?'}mm)</option>
            ))}
            {glassSku && !selectedGlass && <option value={glassSku}>{glassSku}</option>}
          </select>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 16 }}>{t('settings.glassShelfHint')}</div>

          <div style={labelStyle}>{t('settings.glassDoorMaterial')}</div>
          <select value={doorSku} disabled={readOnly} onChange={e => { setDoorSku(e.target.value); setMessage('') }}
            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 13, color: DARK, background: '#fff', marginBottom: 6, boxSizing: 'border-box' }}>
            <option value="">{t('settings.glassDoorNoMaterial')}</option>
            {doorMaterials.map(m => (
              <option key={m.sku} value={m.sku}>{m.name} · {m.sku}</option>
            ))}
            {doorSku && !doorMaterials.some(m => m.sku === doorSku) && <option value={doorSku}>{doorSku}</option>}
          </select>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 16 }}>{t('settings.glassDoorHint')}</div>
          {message && (
            <div style={{ fontSize: 12, color: message === t('settings.standardsSaved') ? '#3a3' : '#c33', marginBottom: 12 }}>{message}</div>
          )}
          {!readOnly && (
            <button onClick={save} disabled={saving || !dirty}
              style={{ padding: '10px 20px', background: dirty ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8, cursor: dirty ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
              {saving ? t('settings.standardsSaving') : t('settings.standardsSave')}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function ShareCatalogCard() {
  const { t } = useTranslation()
  const company = getCompany()
  const [copied, setCopied] = useState(false)

  if (!company) return null

  const link = `${window.location.origin}/browse/${company.slug}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: 20 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: DARK }}>{t('settings.shareTitle')}</h2>
      <div style={{ color: '#888', fontSize: 12, marginBottom: 16 }}>
        {t('settings.shareDesc')}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input readOnly value={link} onFocus={e => e.target.select()}
          style={{ flex: 1, padding: '10px 12px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 13, color: DARK, background: '#F7F4F0' }} />
        <button onClick={copyLink}
          style={{ padding: '10px 18px', background: copied ? '#3a3' : ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {copied ? t('settings.shareCopied') : t('settings.shareCopy')}
        </button>
      </div>
    </div>
  )
}

function BillingCard() {
  const { t, language } = useTranslation()
  const company = getCompany()
  const [activating, setActivating] = useState(null)
  const [error, setError] = useState('')

  // Auditors can't change the subscription, so there's nothing for them here.
  if (!company || isReadOnly()) return null

  const isActive = company.status === 'active'
  const arrow = language === 'ar' ? '←' : '→'

  const activate = async (plan) => {
    setActivating(plan)
    setError('')
    try {
      const res = await createCheckout(plan)
      if (res.redirect_url) {
        window.location.href = res.redirect_url
      } else {
        setError(res.detail || t('settings.billingError'))
        setActivating(null)
      }
    } catch {
      setError(t('settings.billingError'))
      setActivating(null)
    }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: DARK }}>{t('settings.billingTitle')}</h2>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
          color: isActive ? '#3a3' : '#8A5A00',
          background: isActive ? '#eef7ee' : '#FCE9C7',
        }}>
          {company.status.toUpperCase()}
        </span>
      </div>

      {isActive ? (
        <>
          <div style={{ color: '#888', fontSize: 12, marginBottom: 20 }}>
            {t('settings.billingActivePlan')} <strong style={{ color: DARK }}>{company.plan}</strong>
            {company.subscription_ends_at && (
              <> · {t('settings.billingRenews')} {new Date(company.subscription_ends_at).toLocaleDateString()}</>
            )}
          </div>
          <button onClick={() => activate(company.plan)} disabled={activating === company.plan}
            style={{ padding: '10px 20px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            {activating === company.plan ? t('settings.billingRedirecting') : t('settings.billingUpdateCard')}
          </button>
        </>
      ) : (
        <>
          <div style={{ color: '#888', fontSize: 12, marginBottom: 20 }}>
            {t('settings.billingInactiveDesc')}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {PLANS.map(p => (
              <button key={p.id} onClick={() => activate(p.id)} disabled={activating === p.id}
                style={{ flex: '1 1 140px', padding: '14px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', textAlign: 'start' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>{p.label}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{p.priceJod} JOD/year</div>
                <div style={{ fontSize: 11, color: ACCENT, fontWeight: 600, marginTop: 8 }}>
                  {activating === p.id ? t('settings.billingRedirecting') : `${t('settings.billingActivate')} ${arrow}`}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {error && <div style={{ fontSize: 12, color: '#c33', marginTop: 12 }}>{error}</div>}
    </div>
  )
}

function FeedbackCard() {
  const { t } = useTranslation()
  const company = getCompany()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchFeedback = async () => {
    setLoading(true)
    try {
      const data = await listFeedback()
      setItems(Array.isArray(data) ? data : (data.results || []))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchFeedback() }, [])

  if (!company) return null

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: 20 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: DARK }}>{t('settings.feedbackTitle')}</h2>
      <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>
        {t('settings.feedbackDesc')}
      </div>

      {!loading && items.length === 0 && (
        <div style={{ color: '#bbb', fontSize: 12, marginTop: 16 }}>{t('settings.feedbackEmpty')}</div>
      )}

      {!loading && items.length > 0 && (
        <div style={{ marginTop: 20, borderTop: '1px solid #F7F4F0', paddingTop: 16 }}>
          {items.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: DARK, flex: 1 }}>{item.message}</div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap',
                color: FEEDBACK_STATUS_COLORS[item.status], border: `1.5px solid ${FEEDBACK_STATUS_COLORS[item.status]}`,
              }}>
                {item.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TourCard() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const replay = (module) => {
    sessionStorage.setItem(`replay_tour_${module.key}`, '1')
    navigate(module.path)
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: 20 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: DARK }}>{t('onboarding.settingsTitle')}</h2>
      <div style={{ color: '#888', fontSize: 12, marginBottom: 16 }}>
        {t('onboarding.settingsDesc')}
      </div>
      <div>
        {ONBOARDING_MODULES.map(module => (
          <div key={module.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid #F7F4F0' }}>
            <div style={{ fontSize: 13, color: DARK, fontWeight: 600 }}>{t(module.labelKey)}</div>
            <button onClick={() => replay(module)}
              style={{ padding: '7px 14px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: DARK }}>
              {t('onboarding.replayBtn')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Settings() {
  const { t, language } = useTranslation()
  const [emailAccount, setEmailAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ email_address: '', app_password: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  const fetchEmailAccount = async () => {
    setLoading(true)
    try {
      const res = await authFetch(API + '/api/auth/email-account/')
      if (res.status === 401) { navigate('/login'); return }
      const data = await res.json()
      setEmailAccount(data.connected ? data : null)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchEmailAccount() }, [])

  const connectEmail = async () => {
    if (!form.email_address.trim() || !form.app_password.trim()) return
    setSaving(true)
    setMessage('')
    try {
      const res = await authFetch(API + '/api/auth/email-account/', {
        method: 'POST',
        body: JSON.stringify({ email_address: form.email_address, app_password: form.app_password }),
      })
      if (res.ok) {
        setForm({ email_address: '', app_password: '' })
        setMessage(t('settings.emailSuccess'))
        fetchEmailAccount()
      } else {
        const err = await res.json()
        setMessage(t('settings.emailError') + ' ' + JSON.stringify(err))
      }
    } catch {}
    setSaving(false)
  }

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Logo forDarkBg onClick={() => navigate('/dashboard')} height={22} />
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{t('settings.title')}</span>
        </div>
        <button onClick={() => navigate('/dashboard')}
          style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          {t('common.dashboard')}
        </button>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: DARK }}>{t('settings.title')}</h1>
        <div style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>{t('settings.subtitle')}</div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: DARK }}>{t('settings.emailTitle')}</h2>
            {emailAccount && (
              <span style={{ fontSize: 11, color: '#3a3', background: '#eef7ee', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{t('settings.emailConnected')}</span>
            )}
          </div>
          <div style={{ color: '#888', fontSize: 12, marginBottom: 20 }}>
            {t('settings.emailDesc')}
          </div>

          {loading ? (
            <div style={{ color: '#bbb', fontSize: 13 }}>{t('common.loading')}</div>
          ) : (
            <>
              {emailAccount && (
                <div style={{ background: '#F7F4F0', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 13, color: DARK }}>
                  {t('settings.emailCurrentlyConnected')} <strong>{emailAccount.email_address}</strong>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{t('settings.emailGmailLabel')}</div>
                <input type="email" value={form.email_address} onChange={e => setForm(f => ({ ...f, email_address: e.target.value }))}
                  placeholder={t('settings.emailGmailPlaceholder')}
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: DARK }} />
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{t('settings.emailAppPasswordLabel')}</div>
                <input type="password" value={form.app_password} onChange={e => setForm(f => ({ ...f, app_password: e.target.value }))}
                  placeholder={t('settings.emailAppPasswordPlaceholder')}
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: DARK }} />
              </div>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 20 }}>
                {t('settings.emailAppPasswordHint')}
              </div>

              {message && (
                <div style={{ fontSize: 12, color: message.startsWith(t('settings.emailError')) ? '#c33' : '#3a3', marginBottom: 12 }}>{message}</div>
              )}

              <button onClick={connectEmail} disabled={saving || !form.email_address.trim() || !form.app_password.trim()}
                style={{ padding: '10px 20px', background: (form.email_address.trim() && form.app_password.trim()) ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8, cursor: (form.email_address.trim() && form.app_password.trim()) ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
                {saving ? t('settings.emailConnecting') : emailAccount ? t('settings.emailUpdateBtn') : t('settings.emailConnectBtn')}
              </button>
            </>
          )}
        </div>

        <ManufacturingStandardsCard />
        <ShareCatalogCard />
        <BillingCard />
        <TeamCard />
        <CabinetTemplateApprovalQueue />
        <TourCard />
        <FeedbackCard />
      </div>
    </div>
  )
}
