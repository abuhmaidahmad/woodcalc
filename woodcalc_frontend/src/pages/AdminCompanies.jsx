import React, { useState, useEffect } from 'react'
import Logo from '../components/Logo'
import { useNavigate } from 'react-router-dom'
import { listCompanies, updateCompany, extendTrial } from '../api/platformAdmin'
import { useTranslation } from '../i18n/LanguageContext'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'

const STATUS_OPTIONS = ['trialing', 'active', 'past_due', 'canceled', 'suspended']
const STATUS_COLORS = {
  trialing: '#C8902A', active: '#2AC87A', past_due: '#e07b00', canceled: '#999', suspended: '#c33',
}
const STATUS_KEYS = {
  trialing: 'adminCompanies.statusTrialing', active: 'adminCompanies.statusActive', past_due: 'adminCompanies.statusPastDue',
  canceled: 'adminCompanies.statusCanceled', suspended: 'adminCompanies.statusSuspended',
}

function fmtDate(d, locale) {
  return d ? new Date(d).toLocaleDateString(locale) : '—'
}

export default function AdminCompanies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [extending, setExtending] = useState(null)
  const navigate = useNavigate()
  const { t, language } = useTranslation()
  const dir = language === 'ar' ? 'rtl' : 'ltr'
  const locale = language === 'ar' ? 'ar' : 'en-US'

  const fetchCompanies = async () => {
    setLoading(true)
    try {
      const data = await listCompanies()
      setCompanies(Array.isArray(data) ? data : (data.results || []))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchCompanies() }, [])

  const filtered = companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  const updateStatus = async (company, status) => {
    setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, status } : c))
    await updateCompany(company.id, { status })
  }

  const doExtendTrial = async (company) => {
    setExtending(company.id)
    try {
      const updated = await extendTrial(company.id)
      setCompanies(prev => prev.map(c => c.id === company.id ? updated : c))
    } catch {}
    setExtending(null)
  }

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Logo forDarkBg onClick={() => navigate('/dashboard')} height={22} />
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{t('adminCompanies.headerTitle')}</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate('/admin/feedback')}
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            {t('adminCompanies.feedback')}
          </button>
          <button onClick={() => navigate('/dashboard')}
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            {t('common.dashboard')}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: DARK }}>{t('adminCompanies.title')}</h1>
          <div style={{ color: '#888', fontSize: 13, marginTop: 2 }}>{t('adminCompanies.total', { count: companies.length })}</div>
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('adminCompanies.searchPlaceholder')}
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E0DAD4', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff', marginBottom: 16 }} />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>{t('adminCompanies.loading')}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>{t('adminCompanies.empty')}</div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {filtered.map((c, i) => (
              <div key={c.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #F7F4F0' : 'none', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: DARK }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    {c.member_count === 1
                      ? t('adminCompanies.planLine', { plan: c.plan })
                      : t('adminCompanies.planLinePlural', { plan: c.plan, count: c.member_count })}
                    {' · '}{t('adminCompanies.trialEnds', { date: fmtDate(c.trial_ends_at, locale) })}
                    {' · '}{t('adminCompanies.subEnds', { date: fmtDate(c.subscription_ends_at, locale) })}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => doExtendTrial(c)} disabled={extending === c.id}
                    style={{ padding: '6px 12px', background: '#F7F4F0', border: '1px solid #E0DAD4', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: DARK }}>
                    {extending === c.id ? t('adminCompanies.extending') : t('adminCompanies.extendTrial')}
                  </button>
                  <select value={c.status} onChange={e => updateStatus(c, e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: `1.5px solid ${STATUS_COLORS[c.status]}`, color: STATUS_COLORS[c.status], fontSize: 11, fontWeight: 700, background: '#fff', cursor: 'pointer' }}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{t(STATUS_KEYS[s])}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
