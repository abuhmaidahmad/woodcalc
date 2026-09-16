import React, { useState, useEffect } from 'react'
import { authFetch, getCompany } from '../api/auth'
import { useTranslation } from '../i18n/LanguageContext'

const API_URL = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'
const ACCENT = '#C8902A'
const DARK = '#1A1A1A'

export default function CabinetTemplateApprovalQueue() {
  const { t } = useTranslation()
  const company = getCompany()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const canReview = company?.role === 'owner' || company?.role === 'admin'

  const fetchAll = async () => {
    setLoading(true)
    try {
      const res = await authFetch(`${API_URL}/api/inventory/cabinet-templates/`)
      const data = await res.json()
      const list = Array.isArray(data) ? data : (data.results || [])
      setTemplates(list.filter(tpl => tpl.status === 'pending'))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { if (canReview) fetchAll() }, [])

  if (!company || !canReview) return null

  const approve = async (tpl) => {
    setBusyId(tpl.id)
    try {
      await authFetch(`${API_URL}/api/inventory/cabinet-templates/${tpl.id}/approve/`, { method: 'POST' })
      setTemplates(prev => prev.filter(x => x.id !== tpl.id))
    } catch {}
    setBusyId(null)
  }

  const reject = async (tpl) => {
    const notes = window.prompt(t('cabinetTemplateQueue.rejectPrompt')) || ''
    setBusyId(tpl.id)
    try {
      await authFetch(`${API_URL}/api/inventory/cabinet-templates/${tpl.id}/reject/`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      })
      setTemplates(prev => prev.filter(x => x.id !== tpl.id))
    } catch {}
    setBusyId(null)
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: 20 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: DARK }}>{t('cabinetTemplateQueue.title')}</h2>
      <div style={{ color: '#888', fontSize: 12, marginBottom: 16 }}>{t('cabinetTemplateQueue.desc')}</div>

      {loading ? (
        <div style={{ color: '#bbb', fontSize: 13 }}>{t('common.loading')}</div>
      ) : templates.length === 0 ? (
        <div style={{ color: '#bbb', fontSize: 12 }}>{t('cabinetTemplateQueue.empty')}</div>
      ) : (
        templates.map(tpl => (
          <div key={tpl.id} style={{ border: '1px solid #F0EBE5', borderRadius: 8, padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>{tpl.name}</div>
                <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>
                  {tpl.width}×{tpl.depth}×{tpl.height}mm · {tpl.category} · {tpl.subtype}
                </div>
                {tpl.created_by != null && (
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                    {t('cabinetTemplateQueue.submittedBy', { id: tpl.created_by })}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => approve(tpl)} disabled={busyId === tpl.id}
                  style={{ fontSize: 11, fontWeight: 700, padding: '6px 12px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, cursor: busyId === tpl.id ? 'wait' : 'pointer' }}>
                  {t('cabinetTemplateQueue.approve')}
                </button>
                <button onClick={() => reject(tpl)} disabled={busyId === tpl.id}
                  style={{ fontSize: 11, fontWeight: 600, padding: '6px 12px', background: '#FEF2F2', color: '#E74C3C', border: '1.5px solid #FECACA', borderRadius: 6, cursor: busyId === tpl.id ? 'wait' : 'pointer' }}>
                  {t('cabinetTemplateQueue.reject')}
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
