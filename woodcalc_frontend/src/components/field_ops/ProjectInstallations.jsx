import React, { useEffect, useState } from 'react'
import { listCrew, listInstallations, listLockedRooms } from '../../api/fieldOps'
import { useTranslation } from '../../i18n/LanguageContext'
import InstallationEditor from './InstallationEditor'
import InstallationList from './InstallationList'
import { ACCENT, DARK } from './fieldOpsTheme'

export default function ProjectInstallations({ projectId }) {
  const { t } = useTranslation()
  const [installations, setInstallations] = useState([])
  const [rooms, setRooms] = useState([])
  const [crew, setCrew] = useState([])
  const [adding, setAdding] = useState(false)

  const load = async () => {
    const [i, r, c] = await Promise.all([
      listInstallations({ project: projectId }), listLockedRooms({ project: projectId }), listCrew(),
    ])
    setInstallations(i)
    setRooms(r)
    setCrew(c)
  }

  useEffect(() => { load().catch(() => {}) }, [projectId])

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 20, marginTop: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: DARK }}>{t('fieldOps.installationSection')}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{rooms.length ? t('fieldOps.installationSectionDesc') : t('fieldOps.noLockedKitchens')}</div>
        </div>
        {!adding && rooms.length > 0 && (
          <button onClick={() => setAdding(true)}
            style={{ minHeight: 44, paddingInline: 16, background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
            {t('fieldOps.scheduleInstallation')}
          </button>
        )}
      </div>
      {adding && (
        <div style={{ marginBottom: 12 }}>
          <InstallationEditor rooms={rooms} crew={crew} onSaved={() => { setAdding(false); load() }} onCancel={() => setAdding(false)} />
        </div>
      )}
      <InstallationList installations={installations} rooms={rooms} crew={crew} onChanged={load} showCustomer={false} />
    </div>
  )
}
