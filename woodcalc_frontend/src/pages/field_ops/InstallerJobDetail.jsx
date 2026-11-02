import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getMyJob } from '../../api/fieldOps'
import { useTranslation } from '../../i18n/LanguageContext'
import { BigLink, FieldTopBar, Section, StatusBadge } from '../../components/field_ops/fieldOpsUi'
import { ACCENT, BG, BORDER, DARK, dims, formatDate, useDir } from '../../components/field_ops/fieldOpsTheme'
import { groupByWall, hardwareList } from '../../components/field_ops/jobDesign'

const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingBlock: 10, borderBottom: '1px solid #F0EBE5' }
const muted = { fontSize: 14, color: '#777' }

function Swatch({ color }) {
  if (!color) return null
  return <span style={{ display: 'inline-block', width: 22, height: 22, borderRadius: 6, background: color, border: `1px solid ${BORDER}`, flexShrink: 0 }} />
}

function finishLabel(cab) {
  return [cab.frontMaterialName, cab.frontMaterialCode].filter(Boolean).join(' · ')
}

function CabinetRow({ cab, t }) {
  return (
    <div style={row}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: DARK }}>{cab.label || cab.subtype}</div>
        <div style={muted}>{[cab.category ? t('fieldOps.category.' + cab.category) : null, cab.subtype].filter(Boolean).join(' · ')}</div>
        {finishLabel(cab) && <div style={muted}>{finishLabel(cab)}</div>}
        {cab.sink && <div style={muted}>{t('fieldOps.sinkLine', { model: [cab.sink.brand, cab.sink.model].filter(Boolean).join(' ') })}</div>}
        {!!cab.elevation && <div style={muted}>{t('fieldOps.elevation', { mm: cab.elevation })}</div>}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#444', whiteSpace: 'nowrap', direction: 'ltr' }}>{dims(cab)}</div>
    </div>
  )
}

export default function InstallerJobDetail() {
  const { id } = useParams()
  const { t, language } = useTranslation()
  const dir = useDir()
  const [job, setJob] = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    getMyJob(id).then(res => {
      setJob(res.job)
      setStatus(res.ok ? 'ready' : 'failed')
    }).catch(() => setStatus('failed'))
  }, [id])

  const design = useMemo(() => job?.design || {}, [job])
  const groups = useMemo(() => groupByWall(design), [design])
  const hardware = useMemo(() => hardwareList(design.cabinets || []), [design])

  const page = (content) => (
    <div dir={dir} style={{ minHeight: '100vh', background: BG, fontFamily: "'Inter', sans-serif" }}>
      <FieldTopBar title={t('fieldOps.jobTitle')} />
      <main style={{ maxWidth: 720, marginInline: 'auto', padding: 16, paddingBottom: 96 }}>
        <Link to="/installer/jobs" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 48, paddingInline: 4, fontSize: 16, fontWeight: 700, color: ACCENT, textDecoration: 'none', marginBottom: 8 }}>
          {t('fieldOps.backToJobs')}
        </Link>
        {content}
      </main>
    </div>
  )

  if (status === 'loading') return page(<div style={muted}>{t('common.loading')}</div>)
  if (status === 'failed' || !job) return page(<div style={{ color: '#c33', fontSize: 16 }}>{t('fieldOps.jobNotFound')}</div>)

  const countertop = design.countertop || {}
  const completed = job.status === 'completed'

  return page(
    <>
      <Section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: DARK }}>{job.customer_name}</div>
            <div style={{ fontSize: 15, color: '#666', marginTop: 4 }}>{job.project_name} · {job.room_name}{job.revision_number ? ` · ${t('fieldOps.rev', { n: job.revision_number })}` : ''}</div>
            <div style={{ fontSize: 16, color: '#333', marginTop: 8, fontWeight: 600 }}>{formatDate(job.scheduled_date, language) || t('fieldOps.noDate')}</div>
          </div>
          <StatusBadge status={job.status} />
        </div>
      </Section>

      <Section title={t('fieldOps.contactAndSite')}>
        {completed && <div style={{ ...muted, marginBottom: 12 }}>{t('fieldOps.contactHidden')}</div>}
        <div style={{ display: 'grid', gap: 10 }}>
          {job.customer_phone && <BigLink href={`tel:${job.customer_phone}`}>{t('fieldOps.callCustomer')} · <span dir="ltr">{job.customer_phone}</span></BigLink>}
          {job.site_contact_phone && (
            <BigLink href={`tel:${job.site_contact_phone}`} color={DARK}>
              {t('fieldOps.callSiteContact', { name: job.site_contact_name || '' })} · <span dir="ltr">{job.site_contact_phone}</span>
            </BigLink>
          )}
          {job.maps_url && <BigLink href={job.maps_url} color="#2A7AC8" external>{t('fieldOps.openInMaps')}</BigLink>}
        </div>
        {(job.address || job.area) && (
          <div style={{ fontSize: 16, color: '#333', marginTop: 12 }}>{[job.area, job.address].filter(Boolean).join(' — ')}</div>
        )}
        {job.site_contact_name && !job.site_contact_phone && <div style={{ ...muted, marginTop: 8 }}>{t('fieldOps.siteContact')}: {job.site_contact_name}</div>}
        {job.crew?.length > 0 && (
          <div style={{ ...muted, marginTop: 12 }}>
            {t('fieldOps.crew')}: {job.crew.map(c => c.is_lead ? `${c.name} (${t('fieldOps.lead')})` : c.name).join(', ')}
          </div>
        )}
      </Section>

      {job.notes && (
        <Section title={t('fieldOps.notes')}>
          <div style={{ fontSize: 16, color: '#333', whiteSpace: 'pre-wrap' }}>{job.notes}</div>
        </Section>
      )}

      {(design.room?.width_mm || design.walls?.length > 0) && (
        <Section title={t('fieldOps.roomAndWalls')}>
          {design.room?.width_mm && (
            <div style={{ ...row, borderBottom: design.walls?.length ? row.borderBottom : 'none' }}>
              <span style={{ fontSize: 15 }}>{t('fieldOps.roomSize')}</span>
              <span dir="ltr" style={{ fontSize: 15, fontWeight: 600 }}>
                {[design.room.width_mm, design.room.depth_mm, design.room.ceiling_height_mm].filter(Boolean).join(' × ')} mm
              </span>
            </div>
          )}
          {(design.walls || []).map(w => (
            <div key={w.index} style={row}>
              <span style={{ fontSize: 15 }}>{t('fieldOps.wallN', { n: w.index + 1 })}</span>
              <span dir="ltr" style={{ fontSize: 15, fontWeight: 600 }}>{w.length_mm} mm</span>
            </div>
          ))}
        </Section>
      )}

      <Section title={t('fieldOps.cabinets')}>
        {groups.length === 0 && <div style={muted}>{t('fieldOps.noCabinets')}</div>}
        {groups.map(group => (
          <div key={group.wall ? group.wall.index : 'free'} style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '8px 0 4px', fontSize: 16, fontWeight: 800, color: ACCENT }}>
              {group.wall ? t('fieldOps.wallWithLength', { n: group.wall.index + 1, mm: group.wall.length_mm }) : t('fieldOps.freeStanding')}
            </h3>
            {group.elements.length > 0 && (
              <div style={{ ...muted, marginBottom: 4 }}>
                {group.elements.map(e => [e.label || e.type, e.elevation ? t('fieldOps.atHeight', { mm: e.elevation }) : null].filter(Boolean).join(' ')).join(' · ')}
              </div>
            )}
            {group.cabinets.map(cab => <CabinetRow key={cab.id} cab={cab} t={t} />)}
          </div>
        ))}
      </Section>

      <Section title={t('fieldOps.hardware')}>
        {hardware.length === 0 && <div style={muted}>{t('fieldOps.noHardware')}</div>}
        {hardware.map(item => (
          <div key={item.key + (item.spec || '')} style={row}>
            <span style={{ fontSize: 15 }}>{t('fieldOps.hw.' + item.key)}{item.spec ? ` · ${item.spec}` : ''}</span>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{item.qty}</span>
          </div>
        ))}
      </Section>

      <Section title={t('fieldOps.countertop')}>
        {countertop.material ? (
          <div style={row}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Swatch color={countertop.material.color} />
              <span style={{ fontSize: 15, fontWeight: 600 }}>{[countertop.material.brand, countertop.material.name, countertop.material.code].filter(Boolean).join(' · ')}</span>
            </div>
            {countertop.thickness_mm && <span dir="ltr" style={{ fontSize: 15 }}>{countertop.thickness_mm} mm</span>}
          </div>
        ) : <div style={muted}>{t('fieldOps.noCountertop')}</div>}
        {(countertop.sink_cutouts || []).map(cut => (
          <div key={cut.cabinet_id} style={row}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{t('fieldOps.sinkCutout')} · {[cut.brand, cut.model].filter(Boolean).join(' ')}</div>
              <div style={muted}>{cut.cabinet_label}{cut.bowls ? ` · ${t('fieldOps.bowls', { n: cut.bowls })}` : ''}</div>
            </div>
            <span dir="ltr" style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {cut.cutout_width_mm && cut.cutout_depth_mm ? `${cut.cutout_width_mm} × ${cut.cutout_depth_mm} mm` : '—'}
            </span>
          </div>
        ))}
        {(countertop.hob_cabinets || []).map(hob => (
          <div key={hob.cabinet_id} style={row}>
            <span style={{ fontSize: 15 }}>{t('fieldOps.hobCutout')} · {hob.cabinet_label}</span>
            <span dir="ltr" style={{ fontSize: 15 }}>{hob.width} mm</span>
          </div>
        ))}
      </Section>

      <Section title={t('fieldOps.appliances')}>
        {(design.appliances || []).length === 0 && <div style={muted}>{t('fieldOps.noAppliances')}</div>}
        {(design.appliances || []).map(app => (
          <div key={app.cabinet_id} style={row}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{app.label || app.subtype}</div>
              <div style={muted}>{[app.subtype, app.finish].filter(Boolean).join(' · ')}</div>
            </div>
            <span dir="ltr" style={{ fontSize: 15, whiteSpace: 'nowrap' }}>{dims(app)}</span>
          </div>
        ))}
      </Section>

      <Section title={t('fieldOps.finishes')}>
        {(design.finishes || []).map(f => (
          <div key={[f.role, f.code, f.name, f.color].join('|')} style={row}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Swatch color={f.color} />
              <span style={{ fontSize: 15, fontWeight: 600 }}>{[f.name, f.code].filter(Boolean).join(' · ') || f.color}</span>
            </div>
            <span style={muted}>{t('fieldOps.finishRole.' + f.role)}</span>
          </div>
        ))}
      </Section>
    </>
  )
}
