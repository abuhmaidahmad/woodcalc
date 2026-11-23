// Customer archive + delete, shared by CustomerList and CustomerDetail.
// Archive hides a finished customer but keeps everything; delete is only for
// junk/test records and the backend refuses it when real business data exists.
// See docs/customer-archive-delete-spec.md.
import React, { useEffect, useRef, useState } from 'react'
import { authFetch, getRole, isReadOnly } from '../../api/auth'
import { useTranslation } from '../../i18n/LanguageContext'

const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'
const DARK = '#1A1A1A'
const RED = '#D64545'

export const canArchiveClients = () => !isReadOnly()
export const canDeleteClients = () => ['owner', 'admin'].includes(getRole())

export async function archiveClient(id, archived) {
  const res = await authFetch(API + `/api/crm/clients/${id}/${archived ? 'archive' : 'unarchive'}/`, { method: 'POST' })
  if (!res.ok) throw new Error('archive failed')
  return res.json()
}

export async function bulkClients(action, ids) {
  const res = await authFetch(API + '/api/crm/clients/bulk/', { method: 'POST', body: JSON.stringify({ action, ids }) })
  if (!res.ok) throw new Error('bulk failed')
  return res.json()
}

async function deleteCheck(id) {
  const res = await authFetch(API + `/api/crm/clients/${id}/delete-check/`)
  if (!res.ok) throw new Error('check failed')
  return res.json()
}

// "3 payments recorded, 1 signed contract" from a delete-check payload.
export function blockedReasonText(t, check) {
  const c = check.counts || {}
  const parts = (check.blocked_by || []).map(code => {
    if (code === 'payments') return t('customerArchive.reasonPayments', { n: (c.payments || 0) + (c.transactions || 0) })
    if (code === 'signed_contracts') return t('customerArchive.reasonContracts', { n: c.signed_contracts || 0 })
    if (code === 'work_orders') return t('customerArchive.reasonWorkOrders', { n: c.work_orders || 0 })
    if (code === 'not_found') return t('customerArchive.reasonNotFound')
    return check.reason || code
  })
  return parts.join(' · ')
}

// ⋯ menu. items: [{ label, onClick, danger }]
export function ActionsMenu({ items, dark = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  if (!items.length) return null
  return (
    <div ref={ref} style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(o => !o)} aria-label="More actions" aria-haspopup="menu" aria-expanded={open}
        style={{ width: 30, height: 30, borderRadius: 6, border: dark ? '1px solid rgba(255,255,255,0.15)' : '1.5px solid #E0DAD4',
          background: dark ? 'rgba(255,255,255,0.08)' : '#fff', color: dark ? '#ccc' : '#666', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>
        ⋯
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', insetInlineEnd: 0, top: 34, zIndex: 50, minWidth: 150, background: '#fff',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: 4 }}>
          {items.map(item => (
            <button key={item.label} role="menuitem" onClick={() => { setOpen(false); item.onClick() }}
              style={{ display: 'block', width: '100%', textAlign: 'start', padding: '8px 12px', border: 'none', background: 'none',
                borderRadius: 6, cursor: 'pointer', fontSize: 13, color: item.danger ? RED : DARK }}
              onMouseEnter={e => e.currentTarget.style.background = '#F7F4F0'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Bottom toast with an optional action (Undo). Disappears after 6s.
export function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onClose, 6000)
    return () => clearTimeout(timer)
  }, [toast])
  if (!toast) return null
  return (
    <div role="status" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1100,
      background: DARK, color: '#fff', borderRadius: 8, padding: '10px 16px', display: 'flex', gap: 16, alignItems: 'center',
      fontSize: 13, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', maxWidth: 'calc(100vw - 32px)' }}>
      <span>{toast.message}</span>
      {toast.action && (
        <button onClick={() => { toast.action.onClick(); onClose() }}
          style={{ background: 'none', border: 'none', color: '#E8B65C', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
          {toast.action.label}
        </button>
      )}
    </div>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const card = { background: '#fff', borderRadius: 14, padding: 28, width: 440, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 64px)', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }
const secondaryBtn = { flex: 1, padding: '10px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#666' }

// Delete one customer or several. Runs delete-check first; blocked customers
// get an "Archive instead" option. clients: [{ id, name }].
// onDone({ deleted: [ids], archived: [ids] }) after anything changed.
export function DeleteClientsModal({ clients, onClose, onDone }) {
  const { t } = useTranslation()
  const bulk = clients.length > 1
  const [checks, setChecks] = useState(null)
  const [error, setError] = useState('')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null) // bulk outcome: { ok, blocked }

  useEffect(() => {
    let cancelled = false
    Promise.all(clients.map(c => deleteCheck(c.id).catch(() => ({ id: c.id, name: c.name, can_delete: false, blocked_by: ['not_found'], counts: {} }))))
      .then(list => { if (!cancelled) setChecks(list) })
    return () => { cancelled = true }
  }, [])

  const allowed = (checks || []).filter(c => c.can_delete)
  const blocked = (checks || []).filter(c => !c.can_delete)
  const confirmWord = bulk ? 'DELETE' : clients[0].name
  const confirmed = typed.trim() === confirmWord.trim()
  const totals = allowed.reduce((s, c) => ({
    projects: s.projects + (c.counts.projects || 0), rooms: s.rooms + (c.counts.rooms || 0),
    quotations: s.quotations + (c.counts.quotations || 0),
  }), { projects: 0, rooms: 0, quotations: 0 })

  const doDelete = async () => {
    setBusy(true); setError('')
    try {
      if (bulk) {
        const res = await bulkClients('delete', allowed.map(c => c.id))
        // Clients blocked before we started never reached the server; report them too.
        const outcome = { ok: res.ok, blocked: [...blocked, ...res.blocked] }
        if (outcome.blocked.length) setResult(outcome)
        onDone({ deleted: res.ok, archived: [] }, !outcome.blocked.length)
      } else {
        const res = await authFetch(API + `/api/crm/clients/${clients[0].id}/`, { method: 'DELETE' })
        if (res.status === 409) { setChecks([await res.json()]); setTyped('') }
        else if (!res.ok) setError(t('customerArchive.deleteFailed'))
        else onDone({ deleted: [clients[0].id], archived: [] }, true)
      }
    } catch { setError(t('customerArchive.deleteFailed')) }
    setBusy(false)
  }

  const archiveInstead = async () => {
    setBusy(true); setError('')
    try {
      const ids = blocked.map(c => c.id)
      if (ids.length === 1) await archiveClient(ids[0], true)
      else await bulkClients('archive', ids)
      setChecks(allowed)
      onDone({ deleted: [], archived: ids }, !allowed.length)
    } catch { setError(t('customerArchive.actionFailed')) }
    setBusy(false)
  }

  const BlockedList = ({ items }) => (
    <div style={{ background: '#FFF6E8', border: '1px solid #F2D8A7', borderRadius: 8, padding: 12, marginBottom: 14 }}>
      {items.map(c => (
        <div key={c.id} style={{ fontSize: 12, color: '#7A5A1E', marginBottom: 4 }}>
          {bulk && <strong>{c.name || `#${c.id}`}: </strong>}{blockedReasonText(t, c)}
        </div>
      ))}
    </div>
  )

  let body
  if (result) {
    body = (
      <>
        <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 8 }}>{t('customerArchive.bulkResultTitle')}</div>
        <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
          {t('customerArchive.bulkResultDeleted', { n: result.ok.length })} {t('customerArchive.bulkResultSkipped', { n: result.blocked.length })}
        </div>
        <BlockedList items={result.blocked} />
        <button onClick={onClose} style={{ ...secondaryBtn, width: '100%' }}>{t('customerArchive.close')}</button>
      </>
    )
  } else if (!checks) {
    body = <div style={{ padding: 20, textAlign: 'center', color: '#999', fontSize: 13 }}>{t('customerArchive.checking')}</div>
  } else {
    body = (
      <>
        <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 6 }}>
          {bulk ? t('customerArchive.deleteBulkTitle', { n: clients.length }) : t('customerArchive.deleteTitle', { name: clients[0].name })}
        </div>
        {blocked.length > 0 && (
          <>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 10 }}>
              {bulk ? t('customerArchive.blockedBulkIntro', { n: blocked.length }) : t('customerArchive.blockedIntro')}
            </div>
            <BlockedList items={blocked} />
            <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>{t('customerArchive.archiveHint')}</div>
          </>
        )}
        {allowed.length > 0 && (
          <>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
              {bulk ? t('customerArchive.willDeleteBulk', { n: allowed.length }) : t('customerArchive.willDelete')}
            </div>
            <ul style={{ margin: '0 0 14px', paddingInlineStart: 20, fontSize: 13, color: DARK }}>
              <li>{t('customerArchive.countProjects', { n: totals.projects })}</li>
              <li>{t('customerArchive.countRooms', { n: totals.rooms })}</li>
              {totals.quotations > 0 && <li>{t('customerArchive.countQuotations', { n: totals.quotations })}</li>}
            </ul>
            <div style={{ fontSize: 12, color: RED, fontWeight: 600, marginBottom: 10 }}>{t('customerArchive.permanentWarning')}</div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
              {bulk ? t('customerArchive.typeDelete') : t('customerArchive.typeName', { name: clients[0].name })}
            </div>
            <input value={typed} onChange={e => setTyped(e.target.value)} autoFocus dir="auto"
              aria-label={bulk ? t('customerArchive.typeDelete') : t('customerArchive.typeName', { name: clients[0].name })}
              style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 14 }} />
          </>
        )}
        {error && <div style={{ color: RED, fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={onClose} disabled={busy} style={secondaryBtn}>{t('common.cancel')}</button>
          {blocked.length > 0 && (
            <button onClick={archiveInstead} disabled={busy}
              style={{ flex: 1, padding: '10px', background: DARK, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              {blocked.length > 1 ? t('customerArchive.archiveInsteadN', { n: blocked.length }) : t('customerArchive.archiveInstead')}
            </button>
          )}
          {allowed.length > 0 && (
            <button onClick={doDelete} disabled={busy || !confirmed}
              style={{ flex: 1, padding: '10px', background: confirmed ? RED : '#E8C5C5', color: '#fff', border: 'none', borderRadius: 8,
                cursor: confirmed && !busy ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
              {busy ? t('customerArchive.deleting') : (bulk ? t('customerArchive.deleteN', { n: allowed.length }) : t('customerArchive.deleteForever'))}
            </button>
          )}
        </div>
      </>
    )
  }

  return (
    <div style={overlay} onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" style={card} onClick={e => e.stopPropagation()}>{body}</div>
    </div>
  )
}
