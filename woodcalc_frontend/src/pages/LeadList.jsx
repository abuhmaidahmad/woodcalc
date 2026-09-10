import React, { useState, useEffect } from 'react'
import Logo from '../components/Logo'
import { authFetch } from '../api/auth'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../i18n/LanguageContext'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'
const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

const STATUS_OPTIONS = ['NEW', 'CONTACTED', 'QUALIFIED', 'LOST', 'WON']
const STATUS_COLORS = {
  NEW: '#C8902A', CONTACTED: '#2A6ACC', QUALIFIED: '#2AC87A', LOST: '#999', WON: '#2AC87A',
}
const STATUS_KEYS = {
  NEW: 'leadList.statusNew', CONTACTED: 'leadList.statusContacted', QUALIFIED: 'leadList.statusQualified',
  LOST: 'leadList.statusLost', WON: 'leadList.statusWon',
}

export default function LeadList() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const { t, language } = useTranslation()
  const dir = language === 'ar' ? 'rtl' : 'ltr'

  const fetchLeads = async () => {
    setLoading(true)
    try {
      const res = await authFetch(API + '/api/crm/leads/')
      if (res.status === 401) { navigate('/login'); return }
      const data = await res.json()
      setLeads(Array.isArray(data) ? data : (data.results || []))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchLeads() }, [])

  const filtered = leads.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.email?.toLowerCase().includes(search.toLowerCase()) ||
    l.phone?.toLowerCase().includes(search.toLowerCase())
  )

  const updateStatus = async (lead, newStatus) => {
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: newStatus } : l))
    await authFetch(API + `/api/crm/leads/${lead.id}/`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) })
  }

  const cabinetCount = (lead) => lead.design_snapshot?.cabinets?.length || 0

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Logo forDarkBg onClick={() => navigate('/dashboard')} height={22} />
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{t('leadList.title')}</span>
        </div>
        <button onClick={() => navigate('/dashboard')}
          style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          {t('common.dashboard')}
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: DARK }}>{t('leadList.title')}</h1>
          <div style={{ color: '#888', fontSize: 13, marginTop: 2 }}>{t('leadList.total', { count: leads.length })}</div>
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('leadList.searchPlaceholder')}
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E0DAD4', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff', marginBottom: 16 }} />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>{t('leadList.loading')}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📇</div>
            <div style={{ fontWeight: 600 }}>{t('leadList.emptyTitle')}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>{t('leadList.emptyDesc')}</div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {filtered.map((l, i) => (
              <div key={l.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #F7F4F0' : 'none' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: DARK }}>{l.name}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    {[l.email, l.phone].filter(Boolean).join(' · ') || t('leadList.noContactInfo')}
                    {cabinetCount(l) > 0 && (
                      <> · 🗄 {cabinetCount(l) === 1 ? t('leadList.cabinetCount') : t('leadList.cabinetCountPlural', { count: cabinetCount(l) })}{l.design_total ? ` · ${l.design_total}` : ''}</>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {cabinetCount(l) > 0 && (
                    <button onClick={() => navigate(`/leads/${l.id}/view`)}
                      style={{ padding: '6px 12px', background: '#F7F4F0', border: '1px solid #E0DAD4', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: DARK }}>
                      {t('leadList.viewDesign')}
                    </button>
                  )}
                  <select value={l.status} onChange={e => updateStatus(l, e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: `1.5px solid ${STATUS_COLORS[l.status]}`, color: STATUS_COLORS[l.status], fontSize: 11, fontWeight: 700, background: '#fff', cursor: 'pointer' }}>
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
