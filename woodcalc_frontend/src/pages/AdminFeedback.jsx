import React, { useState, useEffect } from 'react'
import Logo from '../components/Logo'
import { useNavigate } from 'react-router-dom'
import { listAllFeedback, updateFeedback } from '../api/platformAdmin'
import { useTranslation } from '../i18n/LanguageContext'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'

const STATUS_OPTIONS = ['new', 'reviewing', 'planned', 'declined', 'done']
const STATUS_COLORS = {
  new: '#C8902A', reviewing: '#2A6ACC', planned: '#8A2AC8', declined: '#999', done: '#2AC87A',
}
const STATUS_KEYS = {
  new: 'adminFeedback.statusNew', reviewing: 'adminFeedback.statusReviewing', planned: 'adminFeedback.statusPlanned',
  declined: 'adminFeedback.statusDeclined', done: 'adminFeedback.statusDone',
}

export default function AdminFeedback() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [notesDraft, setNotesDraft] = useState({})
  const navigate = useNavigate()
  const { t, language } = useTranslation()
  const dir = language === 'ar' ? 'rtl' : 'ltr'
  const locale = language === 'ar' ? 'ar' : 'en-US'

  const fetchFeedback = async () => {
    setLoading(true)
    try {
      const data = await listAllFeedback()
      const list = Array.isArray(data) ? data : (data.results || [])
      setItems(list)
      setNotesDraft(Object.fromEntries(list.map(f => [f.id, f.admin_notes || ''])))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchFeedback() }, [])

  const updateStatus = async (item, status) => {
    setItems(prev => prev.map(f => f.id === item.id ? { ...f, status } : f))
    await updateFeedback(item.id, { status })
  }

  const saveNotes = async (item) => {
    const notes = notesDraft[item.id] ?? ''
    if (notes === (item.admin_notes || '')) return
    await updateFeedback(item.id, { admin_notes: notes })
    setItems(prev => prev.map(f => f.id === item.id ? { ...f, admin_notes: notes } : f))
  }

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Logo forDarkBg onClick={() => navigate('/dashboard')} height={22} />
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{t('adminFeedback.headerTitle')}</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate('/admin/companies')}
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            {t('adminFeedback.companies')}
          </button>
          <button onClick={() => navigate('/dashboard')}
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            {t('common.dashboard')}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: DARK }}>{t('adminFeedback.title')}</h1>
          <div style={{ color: '#888', fontSize: 13, marginTop: 2 }}>{t('adminFeedback.total', { count: items.length })}</div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>{t('adminFeedback.loading')}</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>{t('adminFeedback.empty')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map(item => (
              <div key={item.id} style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: DARK }}>{item.tenant_name}</div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                      {item.page || '—'} · {new Date(item.created_at).toLocaleString(locale)}
                    </div>
                  </div>
                  <select value={item.status} onChange={e => updateStatus(item, e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: `1.5px solid ${STATUS_COLORS[item.status]}`, color: STATUS_COLORS[item.status], fontSize: 11, fontWeight: 700, background: '#fff', cursor: 'pointer' }}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{t(STATUS_KEYS[s])}</option>)}
                  </select>
                </div>

                <div style={{ fontSize: 13, color: DARK, marginBottom: 12 }}>{item.message}</div>

                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{t('adminFeedback.yourNotes')}</div>
                <textarea value={notesDraft[item.id] ?? ''} onChange={e => setNotesDraft(d => ({ ...d, [item.id]: e.target.value }))}
                  onBlur={() => saveNotes(item)}
                  placeholder={t('adminFeedback.notesPlaceholder')}
                  rows={2}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK, fontFamily: 'inherit', resize: 'vertical' }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
