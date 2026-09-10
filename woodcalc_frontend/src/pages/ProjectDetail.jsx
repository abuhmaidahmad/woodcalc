import React, { useState, useEffect } from 'react'
import Logo from '../components/Logo'
import { authFetch } from '../api/auth'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from '../i18n/LanguageContext'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'
const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
})

const STATUS_COLORS = {
  DRAFT: '#888', ACTIVE: '#2AC87A', ON_HOLD: '#F39C12',
  COMPLETED: '#3498DB', CANCELLED: '#E74C3C',
}
const STATUS_KEYS = {
  DRAFT: 'projectDetail.statusDraft', ACTIVE: 'projectDetail.statusActive', ON_HOLD: 'projectDetail.statusOnHold',
  COMPLETED: 'projectDetail.statusCompleted', CANCELLED: 'projectDetail.statusCancelled',
}
const PAY_STATUS_KEYS = { PAID: 'projectDetail.paymentStatusPaid', PENDING: 'projectDetail.paymentStatusPending' }
const CHEQUE_STATUS_KEYS = {
  RECEIVED: 'projectDetail.chequeReceived', DEPOSITED: 'projectDetail.chequeDeposited',
  CLEARED: 'projectDetail.chequeCleared', BOUNCED: 'projectDetail.chequeBounced',
}

const ROOM_ICONS = {
  kitchen: '🍳', bathroom: '🚿', bedroom: '🛏', living: '🛋',
  office: '💼', laundry: '👕', other: '📦',
}
const ROOM_TYPE_KEYS = {
  kitchen: 'projectDetail.roomKitchen', bathroom: 'projectDetail.roomBathroom', bedroom: 'projectDetail.roomBedroom',
  living: 'projectDetail.roomLiving', office: 'projectDetail.roomOffice', laundry: 'projectDetail.roomLaundry', other: 'projectDetail.roomOther',
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, language } = useTranslation()
  const dir = language === 'ar' ? 'rtl' : 'ltr'
  const locale = language === 'ar' ? 'ar' : 'en-GB'
  const [project, setProject] = useState(null)
  const [rooms, setRooms] = useState([])
  const [payments, setPayments] = useState([])
  const [transactions, setTransactions] = useState([])
  const [showPay, setShowPay] = useState(false)
  const [savingPay, setSavingPay] = useState(false)
  const [payForm, setPayForm] = useState({
    amount: '', currency: 'JOD', method: 'CASH',
    date_received: new Date().toISOString().slice(0, 10),
    installment: '', reference: '',
    cheque_number: '', cheque_bank: '', cheque_due_date: '', notes: ''
  })
  const [loading, setLoading] = useState(true)
  const [showAddRoom, setShowAddRoom] = useState(false)
  const [form, setForm] = useState({ name: '', room_type: 'kitchen', notes: '' })
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('rooms')

  const fetchData = async () => {
    setLoading(true)
    try {
      const [pRes, rRes, pyRes] = await Promise.all([
        fetch(API + `/api/crm/projects/${id}/`, { headers: headers() }),
        fetch(API + `/api/crm/rooms/?project=${id}`, { headers: headers() }),
        fetch(API + `/api/crm/payments/?project=${id}`, { headers: headers() }),
      ])
      const pd = await pRes.json(); setProject({...pd, total_value: parseFloat(pd.total_value || 0), created_at: pd.created_at || new Date().toISOString()})
      setRooms(await rRes.json().then(d => Array.isArray(d) ? d : (d.results || [])))
      setPayments(await pyRes.json().then(d => Array.isArray(d) ? d : (d.results || [])))
      const tRes = await fetch(API + `/api/crm/transactions/?project=${id}`, { headers: headers() })
      setTransactions(await tRes.json().then(d => Array.isArray(d) ? d : (d.results || [])))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const saveRoom = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await authFetch(API + '/api/crm/rooms/', { method: 'POST',
        body: JSON.stringify({ ...form, project: id }),
      })
      if (res.ok) {
        const room = await res.json()
        setForm({ name: '', room_type: 'kitchen', notes: '' })
        setShowAddRoom(false)
        fetchData()
      }
    } catch {}
    setSaving(false)
  }

  const updateStatus = async (status) => {
    try {
      await authFetch(API + `/api/crm/projects/${id}/`, { method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      fetchData()
    } catch {}
  }

  const savePayment = async () => {
    setSavingPay(true)
    try {
      const body = { ...payForm, project: id, amount: parseFloat(payForm.amount) }
      if (!body.installment) delete body.installment
      if (body.method !== 'CHEQUE') {
        delete body.cheque_number; delete body.cheque_bank; delete body.cheque_due_date
      }
      if (!body.cheque_due_date) delete body.cheque_due_date
      const res = await authFetch(API + '/api/crm/transactions/', {
        method: 'POST', headers: headers(), body: JSON.stringify(body)
      })
      if (res.ok) {
        setShowPay(false)
        setPayForm(f => ({ ...f, amount: '', reference: '', cheque_number: '', cheque_bank: '', cheque_due_date: '', notes: '' }))
        fetchData()
      } else {
        alert(t('projectDetail.failedSavePayment', { err: JSON.stringify(await res.json()) }))
      }
    } finally { setSavingPay(false) }
  }

  const setChequeStatus = async (tx, status) => {
    const res = await authFetch(API + `/api/crm/transactions/${tx.id}/set_cheque_status/`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ cheque_status: status })
    })
    if (res.ok) fetchData()
  }

  const totalCollected = transactions.filter(t => t.is_collected).reduce((s, t) => s + parseFloat(t.amount || 0), 0)
  const totalPaid = payments.filter(p => p.status === 'PAID').reduce((s, p) => s + parseFloat(p.amount || 0), 0)
  const totalPending = payments.filter(p => p.status === 'PENDING').reduce((s, p) => s + parseFloat(p.amount || 0), 0)

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#bbb', fontFamily: 'Inter, sans-serif' }}>{t('projectDetail.loading')}</div>
  if (!project) return <div style={{ padding: 40, textAlign: 'center', color: '#bbb', fontFamily: 'Inter, sans-serif' }}>{t('projectDetail.notFound')}</div>

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      {/* Top bar */}
      <div style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo forDarkBg onClick={() => navigate('/dashboard')} height={22} />
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span onClick={() => navigate('/customers')} style={{ color: '#888', fontSize: 13, cursor: 'pointer' }}>{t('projectDetail.customers')}</span>
          <span style={{ color: '#666', fontSize: 12 }}>›</span>
          <span onClick={() => navigate(`/customers/${project.client}`)} style={{ color: '#888', fontSize: 13, cursor: 'pointer' }}>{project.client_name}</span>
          <span style={{ color: '#666', fontSize: 12 }}>›</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{project.name}</span>
        </div>
        <button onClick={() => navigate(`/customers/${project.client}`)}
          style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          {t('projectDetail.back')}
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>

        {/* Project header */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: DARK }}>{project.name}</div>
              <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                {t('projectDetail.clientLabel')} <strong style={{ color: DARK }}>{project.client_name}</strong>
                {project.address && <span> · {project.address}</span>}
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                {t('projectDetail.createdLabel', { date: new Date(project.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}
              </div>
            </div>
            <div style={{ textAlign: 'end' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>{parseFloat(project.total_value).toFixed(2)} JD</div>
              <select value={project.status} onChange={e => updateStatus(e.target.value)}
                style={{ marginTop: 8, padding: '5px 10px', border: `2px solid ${STATUS_COLORS[project.status] || '#888'}`, borderRadius: 6, fontSize: 11, fontWeight: 700, color: STATUS_COLORS[project.status] || '#888', background: (STATUS_COLORS[project.status] || '#888') + '15', outline: 'none', cursor: 'pointer' }}>
                {['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].map(s => <option key={s} value={s}>{t(STATUS_KEYS[s])}</option>)}
              </select>
            </div>
          </div>

          {/* Payment summary */}
          {payments.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid #F0EBE5' }}>
              {[
                [t('projectDetail.totalValue'), parseFloat(project.total_value).toFixed(2) + ' JD', ACCENT],
                [t('projectDetail.paid'), totalPaid.toFixed(2) + ' JD', '#2AC87A'],
                [t('projectDetail.pending'), totalPending.toFixed(2) + ' JD', '#F39C12'],
              ].map(([label, val, color]) => (
                <div key={label} style={{ background: '#F7F4F0', borderRadius: 8, padding: '10px 14px', borderLeft: `3px solid ${color}` }}>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: DARK }}>{val}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {[['rooms', t('projectDetail.tabRooms')], ['payments', t('projectDetail.tabPayments')]].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding: '8px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: activeTab === tab ? ACCENT : '#fff',
                color: activeTab === tab ? '#fff' : '#666',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Rooms tab */}
        {activeTab === 'rooms' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{rooms.length === 1 ? t('projectDetail.roomCount') : t('projectDetail.roomCountPlural', { count: rooms.length })}</div>
              <button onClick={() => setShowAddRoom(true)}
                style={{ padding: '8px 16px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                {t('projectDetail.newRoom')}
              </button>
            </div>
            {rooms.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#bbb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🏠</div>
                <div style={{ fontWeight: 600 }}>{t('projectDetail.noRoomsYet')}</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{t('projectDetail.addRoomHint')}</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {rooms.map(room => (
                  <div key={room.id}
                    style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer', border: '1.5px solid transparent', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.background = '#FDFAF6' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = '#fff' }}
                    onClick={() => navigate(`/rooms/${room.id}`)}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{ROOM_ICONS[room.room_type] || '📦'}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: DARK }}>{room.name}</div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{ROOM_TYPE_KEYS[room.room_type] ? t(ROOM_TYPE_KEYS[room.room_type]) : room.room_type}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{parseFloat(room.grand_total).toFixed(2)} JD</span>
                      <span style={{ fontSize: 11, color: '#888' }}>{new Date(room.updated_at).toLocaleDateString(locale)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Payments tab */}
        {activeTab === 'payments' && (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {payments.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#bbb' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>💰</div>
                <div style={{ fontWeight: 600 }}>{t('projectDetail.noPaymentsYet')}</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{t('projectDetail.paymentsFromContractHint')}</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAFAFA' }}>
                    {[t('projectDetail.colMilestone'), t('projectDetail.colAmount'), t('projectDetail.colDueDate'), t('projectDetail.colStatus')].map((h, hi) => (
                      <th key={hi} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#888' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F7F4F0' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: DARK }}>{p.label}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: DARK }}>{parseFloat(p.amount).toFixed(2)} JD</td>
                      <td style={{ padding: '12px 16px', color: '#888' }}>{p.due_date || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[p.status] || '#888', background: (STATUS_COLORS[p.status] || '#888') + '18', padding: '3px 8px', borderRadius: 4 }}>
                          {PAY_STATUS_KEYS[p.status] ? t(PAY_STATUS_KEYS[p.status]) : p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        {activeTab === 'payments' && (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #F7F4F0' }}>
              <div>
                <div style={{ fontWeight: 800, color: DARK, fontSize: 14 }}>{t('projectDetail.transactions')}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  {t('projectDetail.collected')} <b style={{ color: '#2E7D32' }}>{totalCollected.toFixed(2)} JD</b>
                  {' · '}{t('projectDetail.outstanding')} <b style={{ color: '#C62828' }}>{(parseFloat(project?.total_value || 0) - totalCollected).toFixed(2)} JD</b>
                </div>
              </div>
              <button onClick={() => setShowPay(true)}
                style={{ padding: '8px 14px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                {t('projectDetail.recordPayment')}
              </button>
            </div>
            {transactions.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#bbb', fontSize: 12 }}>{t('projectDetail.noTransactionsYet')}</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAFAFA' }}>
                    {[t('projectDetail.colDate'), t('projectDetail.colAmount'), t('projectDetail.colMethod'), t('projectDetail.colInstallment'), t('projectDetail.colReference'), t('projectDetail.colStatus')].map((h, hi) => (
                      <th key={hi} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#888' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid #F7F4F0' }}>
                      <td style={{ padding: '10px 16px', color: '#888', fontSize: 12 }}>{tx.date_received}</td>
                      <td style={{ padding: '10px 16px', fontWeight: 700, color: DARK }}>{parseFloat(tx.amount).toFixed(2)} {tx.currency}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12 }}>{tx.method}{tx.method === 'CHEQUE' && tx.cheque_due_date ? t('projectDetail.dueSuffix', { date: tx.cheque_due_date }) : ''}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: '#888' }}>{tx.installment_label || '\u2014'}</td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: '#888' }}>{tx.method === 'CHEQUE' ? `${tx.cheque_number || ''} ${tx.cheque_bank || ''}`.trim() || '\u2014' : (tx.reference || '\u2014')}</td>
                      <td style={{ padding: '10px 16px' }}>
                        {tx.method === 'CHEQUE' ? (
                          <select value={tx.cheque_status} onChange={e => setChequeStatus(tx, e.target.value)}
                            style={{ fontSize: 11, fontWeight: 700, padding: '3px 6px', borderRadius: 4, border: '1px solid #E0DAD4', background: '#fff',
                              color: tx.cheque_status === 'CLEARED' ? '#2E7D32' : tx.cheque_status === 'BOUNCED' ? '#C62828' : '#B8860B' }}>
                            {['RECEIVED', 'DEPOSITED', 'CLEARED', 'BOUNCED'].map(s => <option key={s} value={s}>{t(CHEQUE_STATUS_KEYS[s])}</option>)}
                          </select>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#2E7D32', background: '#2E7D3218', padding: '3px 8px', borderRadius: 4 }}>{t('projectDetail.collectedBadge')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {showPay && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 16 }}>{t('projectDetail.recordPaymentTitle')}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 2 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{t('projectDetail.amount')}</div>
                <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{t('projectDetail.currency')}</div>
                <select value={payForm.currency} onChange={e => setPayForm(f => ({ ...f, currency: e.target.value }))}
                  style={{ width: '100%', padding: '8px 6px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, color: DARK, background: '#fff' }}>
                  <option>JOD</option><option>USD</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{t('projectDetail.method')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {[['CASH', t('projectDetail.methodCash')], ['TRANSFER', t('projectDetail.methodTransfer')], ['CHEQUE', t('projectDetail.methodCheque')]].map(([v, label]) => (
                  <div key={v} onClick={() => setPayForm(f => ({ ...f, method: v }))}
                    style={{ padding: '8px 4px', border: `1.5px solid ${payForm.method === v ? ACCENT : '#E0DAD4'}`, borderRadius: 7, cursor: 'pointer', textAlign: 'center',
                      background: payForm.method === v ? ACCENT + '12' : '#FAFAFA', fontSize: 11, fontWeight: 600, color: payForm.method === v ? ACCENT : '#666' }}>
                    {label}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{t('projectDetail.dateReceived')}</div>
                <input type="date" value={payForm.date_received} onChange={e => setPayForm(f => ({ ...f, date_received: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, boxSizing: 'border-box', color: DARK }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{t('projectDetail.installment')}</div>
                <select value={payForm.installment} onChange={e => setPayForm(f => ({ ...f, installment: e.target.value }))}
                  style={{ width: '100%', padding: '8px 6px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, color: DARK, background: '#fff' }}>
                  <option value="">{t('projectDetail.noneGeneral')}</option>
                  {payments.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            </div>
            {payForm.method === 'CHEQUE' ? (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{t('projectDetail.chequeNumber')}</div>
                    <input value={payForm.cheque_number} onChange={e => setPayForm(f => ({ ...f, cheque_number: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, boxSizing: 'border-box', color: DARK }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{t('projectDetail.bank')}</div>
                    <input value={payForm.cheque_bank} onChange={e => setPayForm(f => ({ ...f, cheque_bank: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, boxSizing: 'border-box', color: DARK }} />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{t('projectDetail.chequeDueDate')}</div>
                  <input type="date" value={payForm.cheque_due_date} onChange={e => setPayForm(f => ({ ...f, cheque_due_date: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, boxSizing: 'border-box', color: DARK }} />
                </div>
              </>
            ) : (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{t('projectDetail.reference')}</div>
                <input value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))}
                  placeholder={t('projectDetail.referencePlaceholder')}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, boxSizing: 'border-box', color: DARK }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowPay(false)}
                style={{ flex: 1, padding: '10px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#666' }}>
                {t('projectDetail.cancel')}
              </button>
              <button onClick={savePayment} disabled={savingPay || !payForm.amount || (payForm.method === 'CHEQUE' && !payForm.cheque_number)}
                style={{ flex: 2, padding: '10px', background: payForm.amount ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8,
                  cursor: payForm.amount ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
                {savingPay ? t('projectDetail.saving') : t('projectDetail.savePayment')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add Room Modal */}
      {showAddRoom && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 4 }}>{t('projectDetail.newRoomTitle')}</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>{t('projectDetail.addRoomTo', { name: project.name })}</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{t('projectDetail.roomName')}</div>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t('projectDetail.roomNamePlaceholder')}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{t('projectDetail.roomType')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {[['kitchen','🍳'],['bathroom','🚿'],['bedroom','🛏'],['living','🛋'],['office','💼'],['laundry','👕'],['other','📦']].map(([type, icon]) => (
                  <div key={type} onClick={() => setForm(f => ({ ...f, room_type: type }))}
                    style={{ padding: '8px 4px', border: `1.5px solid ${form.room_type === type ? ACCENT : '#E0DAD4'}`, borderRadius: 7, cursor: 'pointer', textAlign: 'center', background: form.room_type === type ? ACCENT + '12' : '#FAFAFA' }}>
                    <div style={{ fontSize: 16 }}>{icon}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: form.room_type === type ? ACCENT : '#666', marginTop: 2 }}>{t(ROOM_TYPE_KEYS[type])}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{t('projectDetail.notes')}</div>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK }} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAddRoom(false)}
                style={{ flex: 1, padding: '10px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#666' }}>
                {t('projectDetail.cancel')}
              </button>
              <button onClick={saveRoom} disabled={saving || !form.name.trim()}
                style={{ flex: 2, padding: '10px', background: form.name.trim() ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8, cursor: form.name.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
                {saving ? t('projectDetail.saving') : t('projectDetail.createRoom')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
