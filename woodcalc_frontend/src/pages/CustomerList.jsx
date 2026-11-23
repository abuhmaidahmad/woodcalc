import React, { useState, useEffect } from 'react'
import Logo from '../components/Logo'
import { authFetch, isReadOnly } from '../api/auth'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../i18n/LanguageContext'
import {
  ActionsMenu, DeleteClientsModal, Toast, archiveClient, bulkClients, canArchiveClients, canDeleteClients,
} from '../features/crm/customerArchive'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'
const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
})

export default function CustomerList() {
  const { t, language } = useTranslation()
  // Both tabs are loaded together so the count badges are right and switching tabs is instant.
  const [lists, setLists] = useState({ active: [], archived: [] })
  const [counts, setCounts] = useState({ active: 0, archived: 0 })
  const [tab, setTab] = useState('active')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [deleteTarget, setDeleteTarget] = useState(null) // [{ id, name }]
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', company: '' })
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const readOnly = isReadOnly()
  const canArchive = canArchiveClients()
  const canDelete = canDeleteClients()
  const customers = lists[tab]

  const fetchCustomers = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true)
    try {
      const [aRes, rRes] = await Promise.all([
        authFetch(API + '/api/crm/clients/?status=active'),
        authFetch(API + '/api/crm/clients/?status=archived'),
      ])
      if (aRes.status === 401) { navigate('/login'); return }
      const [a, r] = await Promise.all([aRes.json(), rRes.json()])
      const rows = d => Array.isArray(d) ? d : (d.results || [])
      setLists({ active: rows(a), archived: rows(r) })
      setCounts({ active: a.count ?? rows(a).length, archived: r.count ?? rows(r).length })
    } catch {}
    if (!quiet) setLoading(false)
  }

  useEffect(() => { fetchCustomers() }, [])

  const switchTab = next => { setTab(next); setSelected(new Set()) }
  const toggleSelected = id => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()) }

  const showFailed = () => setToast({ message: t('customerArchive.actionFailed') })

  // Archive needs no confirmation: it's undoable, so it gets a toast with Undo.
  const setArchived = async (ids, archived) => {
    try {
      if (ids.length === 1) await archiveClient(ids[0], archived)
      else await bulkClients(archived ? 'archive' : 'unarchive', ids)
    } catch { showFailed(); return }
    setSelected(new Set())
    await fetchCustomers({ quiet: true })
    const n = ids.length
    setToast({
      message: archived ? t('customerArchive.archivedToast', { n }) : t('customerArchive.restoredToast', { n }),
      action: { label: t('customerArchive.undo'), onClick: () => setArchived(ids, !archived) },
    })
  }

  const onDeleteDone = async ({ deleted, archived }, close) => {
    if (close) setDeleteTarget(null)
    setSelected(new Set())
    await fetchCustomers({ quiet: true })
    if (deleted.length) setToast({ message: t('customerArchive.deletedToast', { n: deleted.length }) })
    else if (archived.length) setToast({ message: t('customerArchive.archivedToast', { n: archived.length }) })
  }

  const rowMenuItems = c => [
    ...(canArchive ? [tab === 'active'
      ? { label: t('customerArchive.archive'), onClick: () => setArchived([c.id], true) }
      : { label: t('customerArchive.restore'), onClick: () => setArchived([c.id], false) }] : []),
    ...(canDelete ? [{ label: t('customerArchive.delete'), danger: true, onClick: () => setDeleteTarget([{ id: c.id, name: c.name }]) }] : []),
  ]

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  const saveCustomer = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await authFetch(API + '/api/crm/clients/', { method: 'POST',
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setForm({ name: '', phone: '', email: '', address: '', company: '' })
        setShowAdd(false)
        fetchCustomers()
      }
    } catch {}
    setSaving(false)
  }

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      {/* Top bar */}
      <div className="app-topbar" style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Logo forDarkBg onClick={() => navigate('/dashboard')} height={22} />
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{t('customerList.title')}</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate('/dashboard')}
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            {t('common.navDashboard')}
          </button>
          <button onClick={() => navigate('/kitchen-planner')}
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            {t('common.navKitchenPlanner')}
          </button>
          <button onClick={() => navigate('/suppliers')}
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            {t('common.navSuppliers')}
          </button>
          <button onClick={() => navigate('/purchase-orders')}
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            {t('common.navPurchaseOrders')}
          </button>
        </div>
      </div>

      <div className="app-content" style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: DARK }}>{t('customerList.title')}</h1>
            <div style={{ color: '#888', fontSize: 13, marginTop: 2 }}>{t('customerArchive.totalCount', { n: counts.active + counts.archived })}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {canArchive && (
            <button onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
              style={{ padding: '10px 16px', background: selectMode ? DARK : '#fff', color: selectMode ? '#fff' : DARK, border: '1.5px solid ' + (selectMode ? DARK : '#E0DAD4'), borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              {selectMode ? t('customerArchive.doneSelecting') : t('customerArchive.select')}
            </button>
          )}
          {!readOnly && tab === 'active' && (
            <button onClick={() => setShowAdd(true)}
              style={{ padding: '10px 20px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              + {t('customerList.newCustomer')}
            </button>
          )}
          </div>
        </div>

        {/* Active | Archived tabs */}
        <div role="tablist" style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1.5px solid #E0DAD4' }}>
          {['active', 'archived'].map(key => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => switchTab(key)}
              style={{ padding: '8px 14px', background: 'none', border: 'none', borderBottom: '2.5px solid ' + (tab === key ? ACCENT : 'transparent'), marginBottom: -1.5,
                cursor: 'pointer', fontSize: 13, fontWeight: tab === key ? 700 : 500, color: tab === key ? DARK : '#888', display: 'flex', alignItems: 'center', gap: 6 }}>
              {key === 'active' ? t('customerArchive.tabActive') : t('customerArchive.tabArchived')}
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: tab === key ? ACCENT + '22' : '#EEE9E3', color: tab === key ? ACCENT : '#888' }}>
                {counts[key]}
              </span>
            </button>
          ))}
        </div>

        {/* Bulk bar */}
        {selectMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#fff', borderRadius: 10, padding: '10px 14px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', cursor: 'pointer' }}>
              <input type="checkbox" checked={filtered.length > 0 && filtered.every(c => selected.has(c.id))}
                onChange={e => setSelected(e.target.checked ? new Set(filtered.map(c => c.id)) : new Set())} />
              {t('customerArchive.selectAll')}
            </label>
            <span style={{ fontSize: 12, color: '#888', flex: 1 }}>{t('customerArchive.selectedCount', { n: selected.size })}</span>
            {tab === 'active' ? (
              <button disabled={!selected.size} onClick={() => setArchived([...selected], true)}
                style={{ padding: '7px 14px', background: selected.size ? DARK : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 7, cursor: selected.size ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 700 }}>
                {t('customerArchive.archiveSelected')}
              </button>
            ) : (
              <button disabled={!selected.size} onClick={() => setArchived([...selected], false)}
                style={{ padding: '7px 14px', background: selected.size ? DARK : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 7, cursor: selected.size ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 700 }}>
                {t('customerArchive.restoreSelected')}
              </button>
            )}
            {canDelete && (
              <button disabled={!selected.size}
                onClick={() => setDeleteTarget(customers.filter(c => selected.has(c.id)).map(c => ({ id: c.id, name: c.name })))}
                style={{ padding: '7px 14px', background: selected.size ? '#D64545' : '#E8C5C5', color: '#fff', border: 'none', borderRadius: 7, cursor: selected.size ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 700 }}>
                {t('customerArchive.deleteSelected')}
              </button>
            )}
          </div>
        )}

        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('customerList.searchPlaceholder')}
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E0DAD4', borderRadius: 8, fontSize: 13, outline: 'none', marginBottom: 16, boxSizing: 'border-box', background: '#fff' }} />

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <div style={{ fontWeight: 600 }}>{tab === 'archived' ? t('customerArchive.emptyArchivedTitle') : t('customerList.emptyTitle')}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>{tab === 'archived' ? t('customerArchive.emptyArchivedHint') : t('customerList.emptyHint')}</div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {filtered.map((c, i) => (
              <div key={c.id} onClick={() => selectMode ? toggleSelected(c.id) : navigate(`/customers/${c.id}`)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #F7F4F0' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#FDFAF6'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {selectMode && (
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelected(c.id)} onClick={e => e.stopPropagation()}
                      aria-label={c.name} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  )}
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: ACCENT + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: ACCENT }}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: DARK }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                      {[c.phone, c.email].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {c.company && <span style={{ fontSize: 11, color: '#888', background: '#F0EBE5', padding: '2px 8px', borderRadius: 4 }}>{c.company}</span>}
                  {!selectMode && <ActionsMenu items={rowMenuItems(c)} />}
                  <span style={{ color: '#ccc', fontSize: 18 }}>{language === 'ar' ? '‹' : '›'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteTarget && (
        <DeleteClientsModal clients={deleteTarget} onClose={() => setDeleteTarget(null)} onDone={onDeleteDone} />
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Add Customer Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 400, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 4 }}>{t('customerList.modalTitle')}</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>{t('customerList.modalDesc')}</div>
            {[['name', t('customerList.fieldName')], ['phone', t('customerList.fieldPhone')], ['email', t('customerList.fieldEmail')], ['company', t('customerList.fieldCompany')], ['address', t('customerList.fieldAddress')]].map(([key, label]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{label}</div>
                <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAdd(false)}
                style={{ flex: 1, padding: '10px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#666' }}>
                {t('common.cancel')}
              </button>
              <button onClick={saveCustomer} disabled={saving || !form.name.trim()}
                style={{ flex: 2, padding: '10px', background: form.name.trim() ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8, cursor: form.name.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
                {saving ? t('common.saving') : t('customerList.saveCustomer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
