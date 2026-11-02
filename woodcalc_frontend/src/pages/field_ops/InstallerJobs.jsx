import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMyJobs } from '../../api/fieldOps'
import { useTranslation } from '../../i18n/LanguageContext'
import { FieldTopBar, StatusBadge } from '../../components/field_ops/fieldOpsUi'
import { BG, DARK, formatDate, useDir } from '../../components/field_ops/fieldOpsTheme'

const byDate = (a, b) => (a.scheduled_date || '9999').localeCompare(b.scheduled_date || '9999') || a.id - b.id

export default function InstallerJobs() {
  const { t, language } = useTranslation()
  const dir = useDir()
  const [jobs, setJobs] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    listMyJobs().then(res => {
      setFailed(!res.ok)
      setJobs([...res.jobs].sort(byDate))
    }).catch(() => { setFailed(true); setJobs([]) })
  }, [])

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: BG, fontFamily: "'Inter', sans-serif" }}>
      <FieldTopBar title={t('fieldOps.myJobs')} />
      <main style={{ maxWidth: 640, marginInline: 'auto', padding: 16, paddingBottom: 96 }}>
        {jobs === null && <div style={{ color: '#999', fontSize: 15 }}>{t('common.loading')}</div>}
        {failed && <div style={{ color: '#c33', fontSize: 15 }}>{t('fieldOps.loadFailed')}</div>}
        {jobs && !failed && jobs.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888', fontSize: 16, paddingBlock: 48 }}>{t('fieldOps.noJobs')}</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(jobs || []).map(job => (
            <Link key={job.id} to={`/installer/jobs/${job.id}`}
              style={{ display: 'block', background: '#fff', borderRadius: 14, padding: 16, minHeight: 88, textDecoration: 'none', color: DARK, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textAlign: 'start' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{job.customer_name}</div>
                  <div style={{ fontSize: 15, color: '#666', marginTop: 4 }}>{job.area || job.address || job.project_name}</div>
                </div>
                <StatusBadge status={job.status} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 12, fontSize: 15, color: '#444' }}>
                <span>{formatDate(job.scheduled_date, language) || t('fieldOps.noDate')}</span>
                <span style={{ color: '#888' }}>{job.room_name}{job.revision_number ? ` · ${t('fieldOps.rev', { n: job.revision_number })}` : ''}</span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
