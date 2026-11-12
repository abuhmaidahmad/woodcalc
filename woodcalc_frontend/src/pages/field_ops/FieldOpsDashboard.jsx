import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isFieldRole } from '../../api/auth'
import { listCrew, listInstallations, listLockedRooms } from '../../api/fieldOps'
import { useTranslation } from '../../i18n/LanguageContext'
import TeamCard from '../../components/TeamCard'
import InstallationEditor from '../../components/field_ops/InstallationEditor'
import InstallationList from '../../components/field_ops/InstallationList'
import { FieldTopBar, Section } from '../../components/field_ops/fieldOpsUi'
import { ACCENT, BG, BORDER, DARK, STATUSES, useDir } from '../../components/field_ops/fieldOpsTheme'

const EMPTY_FILTERS = { date_from: '', date_to: '', status: '', installer: '' }
const control = { minHeight: 44, padding: '8px 10px', border: `1.5px solid ${BORDER}`, borderRadius: 8, fontSize: 14, background: '#fff', color: DARK, width: '100%', boxSizing: 'border-box' }

export default function FieldOpsDashboard() {
  const { t } = useTranslation()
  const dir = useDir()
  const navigate = useNavigate()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [installations, setInstallations] = useState(null)
  const [rooms, setRooms] = useState([])
  const [crew, setCrew] = useState([])
  const [adding, setAdding] = useState(false)

  const loadInstallations = () => listInstallations(filters).then(setInstallations).catch(() => setInstallations([]))

  useEffect(() => {
    Promise.all([listLockedRooms(), listCrew()]).then(([r, c]) => { setRooms(r); setCrew(c) }).catch(() => {})
  }, [])
  useEffect(() => { loadInstallations() }, [filters])

  const setFilter = (key) => (e) => setFilters(f => ({ ...f, [key]: e.target.value }))
  const reload = () => {
    loadInstallations()
    listLockedRooms().then(setRooms).catch(() => {})
  }

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: BG, fontFamily: "'Inter', sans-serif" }}>
      <FieldTopBar title={t('fieldOps.dashboardTitle')}>
        {!isFieldRole() && (
          <button onClick={() => navigate('/dashboard')}
            style={{ minHeight: 44, paddingInline: 14, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#ccc', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
            {t('fieldOps.backToDashboard')}
          </button>
        )}
      </FieldTopBar>
      <main style={{ maxWidth: 960, marginInline: 'auto', padding: 16, paddingBottom: 96 }}>
        <Section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            <label><span style={{ fontSize: 12, color: '#666' }}>{t('fieldOps.dateFrom')}</span>
              <input type="date" value={filters.date_from} onChange={setFilter('date_from')} style={control} /></label>
            <label><span style={{ fontSize: 12, color: '#666' }}>{t('fieldOps.dateTo')}</span>
              <input type="date" value={filters.date_to} onChange={setFilter('date_to')} style={control} /></label>
            <label><span style={{ fontSize: 12, color: '#666' }}>{t('fieldOps.statusLabel')}</span>
              <select value={filters.status} onChange={setFilter('status')} style={control}>
                <option value="">{t('fieldOps.allStatuses')}</option>
                {STATUSES.map(s => <option key={s} value={s}>{t('fieldOps.status.' + s)}</option>)}
              </select></label>
            <label><span style={{ fontSize: 12, color: '#666' }}>{t('fieldOps.installer')}</span>
              <select value={filters.installer} onChange={setFilter('installer')} style={control}>
                <option value="">{t('fieldOps.allInstallers')}</option>
                {crew.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select></label>
          </div>
        </Section>

        <Section title={t('fieldOps.installations')}>
          {!adding && (
            <button onClick={() => setAdding(true)}
              style={{ minHeight: 48, paddingInline: 18, background: ACCENT, color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
              {t('fieldOps.newInstallation')}
            </button>
          )}
          {adding && (
            <div style={{ marginBottom: 12 }}>
              <InstallationEditor rooms={rooms} crew={crew} onSaved={() => { setAdding(false); reload() }} onCancel={() => setAdding(false)} />
            </div>
          )}
          {installations === null
            ? <div style={{ color: '#999', fontSize: 14 }}>{t('common.loading')}</div>
            : <InstallationList installations={installations} rooms={rooms} crew={crew} onChanged={reload} />}
        </Section>

        <TeamCard />
      </main>
    </div>
  )
}
