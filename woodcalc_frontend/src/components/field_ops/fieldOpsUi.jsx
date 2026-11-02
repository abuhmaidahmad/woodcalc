import React from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../Logo'
import { logout } from '../../api/auth'
import { useTranslation } from '../../i18n/LanguageContext'
import { ACCENT, DARK, STATUS_COLORS } from './fieldOpsTheme'


export function StatusBadge({ status }) {
  const { t } = useTranslation()
  const color = STATUS_COLORS[status] || '#888'
  return (
    <span style={{ display: 'inline-block', fontSize: 13, fontWeight: 700, color, background: color + '18', padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {t('fieldOps.status.' + status)}
    </span>
  )
}

export function FieldTopBar({ title, children }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const doLogout = () => { logout(); navigate('/login') }
  return (
    <div className="app-topbar" style={{ minHeight: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingInline: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <Logo forDarkBg height={22} />
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{title}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {children}
        <button onClick={doLogout}
          style={{ minHeight: 44, paddingInline: 16, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#eee', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
          {t('fieldOps.logout')}
        </button>
      </div>
    </div>
  )
}

export function Section({ title, children }) {
  return (
    <section style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      {title && <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 800, color: DARK }}>{title}</h2>}
      {children}
    </section>
  )
}

export function BigLink({ href, children, color = ACCENT, external }) {
  return (
    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, paddingInline: 16, background: color, color: '#fff', borderRadius: 12, fontSize: 16, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>
      {children}
    </a>
  )
}
