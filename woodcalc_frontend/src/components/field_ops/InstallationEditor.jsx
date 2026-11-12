import React, { useState } from 'react'
import {
  createAssignment, createInstallation, deleteAssignment, deleteInstallation, getLockedRoomCabinets, updateAssignment,
  updateInstallation,
} from '../../api/fieldOps'
import { hardwareList } from './jobDesign'
import { freezeJobHardware } from './hardwareFreeze'
import { useTranslation } from '../../i18n/LanguageContext'
import { ACCENT, BORDER, DARK, STATUSES } from './fieldOpsTheme'

const input = { width: '100%', minHeight: 44, padding: '8px 12px', border: `1.5px solid ${BORDER}`, borderRadius: 8, fontSize: 15, boxSizing: 'border-box', color: DARK, background: '#fff' }
const label = { display: 'block', fontSize: 13, color: '#666', fontWeight: 600, marginBottom: 4 }
const FIELDS = ['scheduled_date', 'area', 'address', 'lat', 'lng', 'site_contact_name', 'site_contact_phone', 'notes']

function initialForm(installation, rooms) {
  const base = { room: installation?.room ?? (rooms.length === 1 ? rooms[0].id : ''), status: installation?.status || 'scheduled' }
  FIELDS.forEach(key => { base[key] = installation?.[key] ?? '' })
  return base
}

function initialCrew(installation) {
  return Object.fromEntries((installation?.assignments || []).map(a => [a.user, { id: a.id, is_lead: a.is_lead }]))
}

function errorText(data) {
  if (!data) return ''
  if (typeof data === 'string') return data
  return Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' · ')
}

function roomLabel(room) {
  return `${room.customer_name} — ${room.project_name} — ${room.name} (Rev ${room.revision_number})`
}

export default function InstallationEditor({ installation, rooms, crew, onSaved, onCancel }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(() => initialForm(installation, rooms))
  const [selected, setSelected] = useState(() => initialCrew(installation))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [unfrozenId, setUnfrozenId] = useState(null)
  const [freezing, setFreezing] = useState(false)
  const [freezeFailed, setFreezeFailed] = useState(false)
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const toggleCrew = (userId) => setSelected(s => {
    const next = { ...s }
    if (next[userId]) delete next[userId]
    else next[userId] = { id: null, is_lead: Object.keys(next).length === 0 }
    return next
  })
  const setLead = (userId) => setSelected(s => Object.fromEntries(Object.entries(s).map(([uid, a]) => [uid, { ...a, is_lead: String(uid) === String(userId) }])))

  const syncCrew = async (installationId) => {
    const before = initialCrew(installation)
    const calls = []
    Object.entries(before).forEach(([uid, a]) => { if (!selected[uid]) calls.push(deleteAssignment(a.id)) })
    Object.entries(selected).forEach(([uid, a]) => {
      if (!before[uid]) calls.push(createAssignment({ installation: installationId, user: Number(uid), is_lead: a.is_lead }))
      else if (before[uid].is_lead !== a.is_lead) calls.push(updateAssignment(before[uid].id, { is_lead: a.is_lead }))
    })
    const results = await Promise.all(calls)
    const failed = results.find(r => !r.ok)
    if (failed) throw new Error(errorText(failed.data))
  }

  const roomChanged = !installation || String(form.room) !== String(installation.room ?? '')
  const keepsOldRoom = installation?.room && !rooms.some(r => String(r.id) === String(installation.room))

  const save = async () => {
    if (roomChanged && !form.room) { setError(t('fieldOps.pickKitchen')); return }
    const payload = { status: form.status }
    if (roomChanged) {
      const room = rooms.find(r => String(r.id) === String(form.room))
      payload.room = Number(form.room)
      if (room) payload.project = room.project
    }
    FIELDS.forEach(key => { payload[key] = form[key] === '' ? (['scheduled_date', 'lat', 'lng'].includes(key) ? null : '') : form[key] })
    setSaving(true)
    setError('')
    try {
      let cabinets = null
      if (roomChanged) {
        cabinets = await getLockedRoomCabinets(payload.room).catch(() => null)
        if (cabinets) payload.hardware_summary = hardwareList(cabinets)
      }
      const res = installation ? await updateInstallation(installation.id, payload) : await createInstallation(payload)
      if (!res.ok) throw new Error(errorText(res.data))
      await syncCrew(res.data.id)
      if (roomChanged && !cabinets) {
        setUnfrozenId(res.data.id)
        setFreezeFailed(false)
      } else {
        onSaved()
      }
    } catch (err) {
      setError(t('fieldOps.saveFailed', { err: err.message }))
    }
    setSaving(false)
  }

  const retryFreeze = async (installationId) => {
    setFreezing(true)
    setFreezeFailed(false)
    const ok = await freezeJobHardware(installationId)
    setFreezing(false)
    if (ok) onSaved()
    else setFreezeFailed(true)
  }

  const remove = async () => {
    if (!window.confirm(t('fieldOps.deleteConfirm'))) return
    const res = await deleteInstallation(installation.id)
    if (res.ok) onSaved()
    else setError(t('fieldOps.saveFailed', { err: errorText(res.data) }))
  }

  return (
    <div style={{ border: `1.5px solid ${BORDER}`, borderRadius: 12, padding: 16, background: '#FFFCF8', textAlign: 'start' }}>
      <div style={{ marginBottom: 12 }}>
        <span style={label}>{t('fieldOps.kitchen')}</span>
        {rooms.length === 0 && !installation ? (
          <div style={{ fontSize: 14, color: '#888' }}>{t('fieldOps.noLockedKitchens')}</div>
        ) : (
          <select value={form.room} onChange={set('room')} style={input}>
            <option value="">{t('fieldOps.pickKitchen')}</option>
            {keepsOldRoom && <option value={installation.room}>{`${installation.customer_name} — ${installation.project_name} — ${installation.room_name} (Rev ${installation.revision_number})`}</option>}
            {rooms.map(r => <option key={r.id} value={r.id}>{roomLabel(r)}</option>)}
          </select>
        )}
      </div>
      <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <label><span style={label}>{t('fieldOps.date')}</span><input type="date" value={form.scheduled_date} onChange={set('scheduled_date')} style={input} /></label>
        {installation && (
          <label><span style={label}>{t('fieldOps.statusLabel')}</span>
            <select value={form.status} onChange={set('status')} style={input}>
              {STATUSES.map(s => <option key={s} value={s}>{t('fieldOps.status.' + s)}</option>)}
            </select>
          </label>
        )}
        <label><span style={label}>{t('fieldOps.area')}</span><input value={form.area} onChange={set('area')} style={input} /></label>
        <label><span style={label}>{t('fieldOps.address')}</span><input value={form.address} onChange={set('address')} placeholder={t('fieldOps.addressHint')} style={input} /></label>
        <label><span style={label}>{t('fieldOps.lat')}</span><input type="number" step="any" dir="ltr" value={form.lat} onChange={set('lat')} style={input} /></label>
        <label><span style={label}>{t('fieldOps.lng')}</span><input type="number" step="any" dir="ltr" value={form.lng} onChange={set('lng')} style={input} /></label>
        <label><span style={label}>{t('fieldOps.siteContactName')}</span><input value={form.site_contact_name} onChange={set('site_contact_name')} style={input} /></label>
        <label><span style={label}>{t('fieldOps.siteContactPhone')}</span><input type="tel" dir="ltr" value={form.site_contact_phone} onChange={set('site_contact_phone')} style={input} /></label>
      </div>
      <label style={{ display: 'block', marginBottom: 12 }}>
        <span style={label}>{t('fieldOps.notes')}</span>
        <textarea value={form.notes} onChange={set('notes')} rows={3} style={{ ...input, minHeight: 80, resize: 'vertical' }} />
      </label>

      <div style={{ marginBottom: 12 }}>
        <span style={label}>{t('fieldOps.assignCrew')}</span>
        {crew.length === 0 && <div style={{ fontSize: 14, color: '#888' }}>{t('fieldOps.noCrew')}</div>}
        {crew.map(member => {
          const picked = selected[member.id]
          return (
            <div key={member.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48, borderBottom: '1px solid #F0EBE5' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, cursor: 'pointer', flex: 1 }}>
                <input type="checkbox" checked={!!picked} onChange={() => toggleCrew(member.id)} style={{ width: 22, height: 22 }} />
                {member.name} <span style={{ fontSize: 12, color: '#888' }}>({t('team.role' + (member.role === 'driver' ? 'Driver' : 'Installer'))})</span>
              </label>
              {picked && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#555', cursor: 'pointer' }}>
                  <input type="radio" name="lead" checked={picked.is_lead} onChange={() => setLead(member.id)} style={{ width: 20, height: 20 }} />
                  {t('fieldOps.lead')}
                </label>
              )}
            </div>
          )
        })}
      </div>

      {error && <div style={{ fontSize: 13, color: '#c33', marginBottom: 12 }}>{error}</div>}

      {unfrozenId && (
        <div role="alert" style={{ border: '1.5px solid #F5C26B', background: '#FFF6E5', borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#8A5A00', marginBottom: 4 }}>{t('fieldOps.freezeWarningTitle')}</div>
          <div style={{ fontSize: 14, color: '#6B4A00', marginBottom: 10 }}>
            {freezeFailed ? t('fieldOps.freezeRetryFailed') : t('fieldOps.freezeWarningBody')}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => retryFreeze(unfrozenId)} disabled={freezing}
              style={{ minHeight: 44, paddingInline: 18, background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
              {freezing ? t('fieldOps.saving') : t('fieldOps.freezeRetry')}
            </button>
            <button onClick={onSaved}
              style={{ minHeight: 44, paddingInline: 16, background: '#fff', border: `1.5px solid ${BORDER}`, borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#666' }}>
              {t('fieldOps.freezeLater')}
            </button>
          </div>
        </div>
      )}

      {!unfrozenId && installation && installation.hardware_frozen === false && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', border: '1.5px solid #F5C26B', background: '#FFF6E5', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 14, color: '#6B4A00' }}>
            {freezeFailed ? t('fieldOps.freezeRetryFailed') : t('fieldOps.notFrozenHint')}
          </span>
          <button onClick={() => retryFreeze(installation.id)} disabled={freezing}
            style={{ minHeight: 44, paddingInline: 16, background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
            {freezing ? t('fieldOps.saving') : t('fieldOps.freezeNow')}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {installation && (
          <button onClick={remove} style={{ minHeight: 44, paddingInline: 16, background: '#FEF2F2', color: '#E74C3C', border: '1.5px solid #FECACA', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            {t('fieldOps.delete')}
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button onClick={onCancel} style={{ minHeight: 44, paddingInline: 16, background: '#F7F4F0', border: `1.5px solid ${BORDER}`, borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#666' }}>
          {t('fieldOps.cancel')}
        </button>
        <button onClick={save} disabled={saving || (rooms.length === 0 && !installation)}
          style={{ minHeight: 44, paddingInline: 20, background: rooms.length || installation ? ACCENT : BORDER, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
          {saving ? t('fieldOps.saving') : t('fieldOps.save')}
        </button>
      </div>
    </div>
  )
}
