import React, { useState } from 'react'
import { useTranslation } from '../../i18n/LanguageContext'
import InstallationEditor from './InstallationEditor'
import { NotFrozenBadge, StatusBadge } from './fieldOpsUi'
import { DARK, formatDate } from './fieldOpsTheme'

function crewNames(installation, t) {
  return (installation.assignments || []).map(a => a.is_lead ? `${a.user_name} (${t('fieldOps.lead')})` : a.user_name).join(', ')
}

export default function InstallationList({ installations, rooms, crew, onChanged, showCustomer = true }) {
  const { t, language } = useTranslation()
  const [editing, setEditing] = useState(null)

  if (installations.length === 0) {
    return <div style={{ fontSize: 14, color: '#888', paddingBlock: 12 }}>{t('fieldOps.noInstallations')}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {installations.map(inst => editing === inst.id ? (
        <InstallationEditor key={inst.id} installation={inst} rooms={rooms} crew={crew}
          onSaved={() => { setEditing(null); onChanged() }} onCancel={() => setEditing(null)} />
      ) : (
        <button key={inst.id} onClick={() => setEditing(inst.id)}
          style={{ display: 'block', width: '100%', textAlign: 'start', background: '#fff', border: '1px solid #F0EBE5', borderRadius: 12, padding: 14, minHeight: 72, cursor: 'pointer', color: DARK, font: 'inherit' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                {showCustomer ? `${inst.customer_name} — ${inst.project_name}` : inst.room_name}
              </div>
              <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
                {[formatDate(inst.scheduled_date, language) || t('fieldOps.noDate'), inst.area,
                  showCustomer && inst.room_name ? `${inst.room_name} · ${t('fieldOps.rev', { n: inst.revision_number })}` : null].filter(Boolean).join(' · ')}
              </div>
              <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{crewNames(inst, t) || t('fieldOps.unassigned')}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <StatusBadge status={inst.status} />
              {inst.hardware_frozen === false && <NotFrozenBadge />}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
