import React, { useEffect, useState } from 'react'
import { authFetch } from '../../api/auth'
import { useTranslation } from '../../i18n/LanguageContext'

const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'
const DARK = '#1A1A1A'

const formatValue = value => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function RoomHistoryPanel({ roomId, onClose }) {
  const { t, language } = useTranslation()
  const [logs, setLogs] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    authFetch(API + `/api/crm/rooms/${roomId}/history/`)
      .then(async res => {
        const data = await res.json().catch(() => ({}))
        if (res.ok) setLogs(data)
        else setError(data.detail || t('roomHistory.loadFailed'))
      })
      .catch(() => setError(t('roomHistory.loadFailed')))
  }, [roomId])

  const locale = language === 'ar' ? 'ar' : 'en-GB'

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div dir={language === 'ar' ? 'rtl' : 'ltr'} onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 12, width: 'min(900px, 100%)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #F0EBE5' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: DARK }}>{t('roomHistory.title')}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '8px 18px 18px' }}>
          {error && <div style={{ color: '#E74C3C', fontSize: 12, padding: 12 }}>{error}</div>}
          {!error && logs === null && <div style={{ color: '#bbb', fontSize: 12, padding: 12 }}>{t('roomHistory.loading')}</div>}
          {logs && logs.length === 0 && <div style={{ color: '#bbb', fontSize: 12, padding: 12 }}>{t('roomHistory.empty')}</div>}
          {logs && logs.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  {[t('roomHistory.colWhen'), t('roomHistory.colWho'), t('roomHistory.colAction'), t('roomHistory.colField'), t('roomHistory.colChange'), t('roomHistory.colReason')].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'start', fontSize: 11, fontWeight: 600, color: '#888' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #F7F4F0', verticalAlign: 'top' }}>
                    <td style={{ padding: '8px 10px', color: '#888', whiteSpace: 'nowrap' }}>{new Date(log.timestamp).toLocaleString(locale)}</td>
                    <td style={{ padding: '8px 10px', color: DARK }}>{log.user_name || '—'}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600, color: DARK }}>{t(`roomHistory.action_${log.action}`)}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: '#555' }}>{log.field_path || '—'}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-word', maxWidth: 280 }}>
                      <span style={{ color: '#C62828' }}>{formatValue(log.old_value)}</span>
                      {' → '}
                      <span style={{ color: '#2E7D32' }}>{formatValue(log.new_value)}</span>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#555' }}>{log.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
