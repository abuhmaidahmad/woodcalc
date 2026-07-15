import React, { useState, useEffect } from 'react'
import { authFetch } from '../api/auth'
import { useNavigate } from 'react-router-dom'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'
const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

const STATUS_STYLES = {
  draft: { bg: '#F0EBE5', color: '#888' },
  sent: { bg: '#e8f0fe', color: '#3a6fd8' },
  confirmed: { bg: '#eef7ee', color: '#3a3' },
  partially_received: { bg: '#fff7e0', color: '#b8860b' },
  received: { bg: '#eef7ee', color: '#3a3' },
  closed: { bg: '#F0EBE5', color: '#888' },
  cancelled: { bg: '#fee', color: '#c33' },
}
const STATUS_LABELS = {
  draft: 'Draft', sent: 'Sent', confirmed: 'Confirmed',
  partially_received: 'Partially Received', received: 'Received',
  closed: 'Closed', cancelled: 'Cancelled',
}

export default function PurchaseOrderList() {
  const [orders, setOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ supplier: '', expected_delivery_date: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [oRes, sRes] = await Promise.all([
        authFetch(API + '/api/srm/purchase-orders/'),
        authFetch(API + '/api/inventory/suppliers/'),
      ])
      if (oRes.status === 401) { navigate('/login'); return }
      const oData = await oRes.json()
      const sData = await sRes.json()
      setOrders(Array.isArray(oData) ? oData : (oData.results || []))
      setSuppliers(Array.isArray(sData) ? sData : (sData.results || []))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const createOrder = async () => {
    if (!form.supplier) return
    setSaving(true)
    try {
      const payload = { supplier: form.supplier, notes: form.notes }
      if (form.expected_delivery_date) payload.expected_delivery_date = form.expected_delivery_date
      const res = await authFetch(API + '/api/srm/purchase-orders/', { method: 'POST', body: JSON.stringify(payload) })
      if (res.ok) {
        const po = await res.json()
        navigate(`/purchase-orders/${po.id}`)
      }
    } catch {}
    setSaving(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span onClick={() => navigate("/dashboard")} style={{ color: ACCENT, fontWeight: 800, fontSize: 18, cursor: "pointer" }}>WoodCalc</span>
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Purchase Orders</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate('/suppliers')}
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            Suppliers
          </button>
          <button onClick={() => navigate('/dashboard')}
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            Dashboard
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: DARK }}>Purchase Orders</h1>
            <div style={{ color: '#888', fontSize: 13, marginTop: 2 }}>{orders.length} total</div>
          </div>
          <button onClick={() => setShowAdd(true)} disabled={suppliers.length === 0}
            style={{ padding: '10px 20px', background: suppliers.length ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8, cursor: suppliers.length ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
            + New PO
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>Loading...</div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
            <div style={{ fontWeight: 600 }}>No purchase orders yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>{suppliers.length === 0 ? 'Add a supplier first' : 'Click "+ New PO" to create one'}</div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {orders.map((o, i) => {
              const st = STATUS_STYLES[o.status] || STATUS_STYLES.draft
              return (
                <div key={o.id} onClick={() => navigate(`/purchase-orders/${o.id}`)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < orders.length - 1 ? '1px solid #F7F4F0' : 'none', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FDFAF6'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: DARK }}>{o.po_number}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                      {o.supplier_name} {o.expected_delivery_date ? `· expected ${o.expected_delivery_date}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {o.is_late && <span style={{ fontSize: 11, color: '#c33', background: '#fee', padding: '2px 8px', borderRadius: 4 }}>LATE</span>}
                    <span style={{ fontSize: 11, color: st.color, background: st.bg, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>{STATUS_LABELS[o.status] || o.status}</span>
                    <span style={{ color: '#ccc', fontSize: 18 }}>›</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 4 }}>New Purchase Order</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>You'll add line items on the next screen</div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Supplier *</div>
              <select value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK, background: '#fff' }}>
                <option value="">Select a supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Expected Delivery Date</div>
              <input type="date" value={form.expected_delivery_date} onChange={e => setForm(f => ({ ...f, expected_delivery_date: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Notes</div>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAdd(false)}
                style={{ flex: 1, padding: '10px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#666' }}>
                Cancel
              </button>
              <button onClick={createOrder} disabled={saving || !form.supplier}
                style={{ flex: 2, padding: '10px', background: form.supplier ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8, cursor: form.supplier ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
                {saving ? 'Creating...' : 'Create & Add Items'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
