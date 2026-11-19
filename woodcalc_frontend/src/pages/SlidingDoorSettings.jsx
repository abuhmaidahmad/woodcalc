import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { useTranslation } from '../i18n/LanguageContext'
import { getRole } from '../api/auth'
import { getSlidingDoorSettings, updateSlidingDoorSettings } from '../api/slidingDoorSettings'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'

const SLIDING_FIELDS = [
  { group: 'doors', key: 'max_door_width_mm', unit: 'mm' },
  { group: 'doors', key: 'max_door_height_mm', unit: 'mm' },
  { group: 'doors', key: 'door_overlap_mm', unit: 'mm' },
  { group: 'prices', key: 'standard_door_price', unit: 'JD' },
  { group: 'prices', key: 'wide_door_price', unit: 'JD' },
  { group: 'prices', key: 'mirror_price_m2', unit: 'JD/m²' },
  { group: 'channel', key: 'channel_width_mm', unit: 'mm' },
  { group: 'channel', key: 'cover_panel_thickness_mm', unit: 'mm' },
  { group: 'channel', key: 'cover_panel_height_mm', unit: 'mm' },
  { group: 'channel', key: 'partition_tolerance_mm', unit: 'mm' },
]
const GROUPS = ['doors', 'prices', 'channel']
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

export default function SlidingDoorSettings() {
  const { t, language } = useTranslation()
  const navigate = useNavigate()
  const canEdit = ['owner', 'admin'].includes(getRole())
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    getSlidingDoorSettings().then(setForm).catch(() => setLoadFailed(true))
  }, [])

  const save = async () => {
    setSaving(true); setErrors({}); setMessage('')
    try {
      const patch = Object.fromEntries(SLIDING_FIELDS.map(({ key }) => [key, form[key]]))
      setForm(await updateSlidingDoorSettings(patch))
      setMessage(t('slidingSettings.saved'))
    } catch (e) {
      setErrors(e.fields || {})
      setMessage(t('slidingSettings.saveError'))
    }
    setSaving(false)
  }

  const cut = form ? n(form.channel_width_mm) + n(form.partition_tolerance_mm) : 0
  const cutCover = form ? cut + n(form.cover_panel_thickness_mm) : 0
  const card = { background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      <div className="app-topbar" style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 124px 0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Logo forDarkBg onClick={() => navigate('/dashboard')} height={22} />
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{t('slidingSettings.title')}</span>
        </div>
        <button onClick={() => navigate('/settings')} style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          {t('slidingSettings.back')}
        </button>
      </div>
      <div className="app-content" style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: DARK }}>{t('slidingSettings.title')}</h1>
        <div style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>{t('slidingSettings.subtitle')}</div>
        {!form ? (
          <div style={{ color: '#999', fontSize: 13 }}>{loadFailed ? t('slidingSettings.loadError') : t('common.loading')}</div>
        ) : (
          <>
            {GROUPS.map((g) => (
              <div key={g} style={card}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: DARK }}>{t(`slidingSettings.group.${g}`)}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                  {SLIDING_FIELDS.filter((f) => f.group === g).map(({ key, unit }) => (
                    <label key={key} style={{ display: 'block' }}>
                      <span style={{ fontSize: 11, color: '#666', fontWeight: 600, display: 'block', marginBottom: 4 }}>{t(`slidingSettings.field.${key}`)} ({unit})</span>
                      <input type="number" min={0} step="0.1" disabled={!canEdit} value={form[key] ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: `1.5px solid ${errors[key] ? '#c33' : '#E0DAD4'}`, borderRadius: 7, fontSize: 13, background: canEdit ? '#fff' : '#f5f2ed' }} />
                      {errors[key] && <span style={{ fontSize: 11, color: '#c33' }}>{[].concat(errors[key]).join(' ')}</span>}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ ...card, fontSize: 13, color: '#555' }}>
              <div style={{ fontWeight: 700, color: DARK, marginBottom: 6 }}>{t('slidingSettings.preview')}</div>
              <div>{t('slidingSettings.reduction', { mm: cut })}</div>
              <div>{t('slidingSettings.reductionCover', { mm: cutCover })}</div>
            </div>
            {message && <div style={{ fontSize: 12, marginBottom: 12, color: Object.keys(errors).length ? '#c33' : '#3a3' }}>{message}</div>}
            {canEdit ? (
              <button onClick={save} disabled={saving} style={{ padding: '10px 22px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                {saving ? t('slidingSettings.saving') : t('slidingSettings.save')}
              </button>
            ) : (
              <div style={{ fontSize: 12, color: '#888' }}>{t('slidingSettings.readOnly')}</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
