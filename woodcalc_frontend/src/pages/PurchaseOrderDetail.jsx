import React, { useState, useEffect } from 'react'
import { authFetch } from '../api/auth'
import { useNavigate, useParams } from 'react-router-dom'

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
const STATUS_OPTIONS = Object.keys(STATUS_LABELS)

export default function PurchaseOrderDetail() {
  const { id } = useParams()
  const [po, setPo] = useState(null)
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddItem, setShowAddItem] = useState(false)
  const [itemForm, setItemForm] = useState({ material: '', quantity_ordered: '', unit_price: '' })
  const [saving, setSaving] = useState(false)
  const [receiveQty, setReceiveQty] = useState({})
  const navigate = useNavigate()

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [poRes, mRes] = await Promise.all([
        authFetch(API + `/api/srm/purchase-orders/${id}/`),
        authFetch(API + '/api/inventory/materials/'),
      ])
      if (poRes.status === 401) { navigate('/login'); return }
      const poData = await poRes.json()
      const mData = await mRes.json()
      setPo(poData)
      setMaterials(Array.isArray(mData) ? mData : (mData.results || []))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [id])

  const addLineItem = async () => {
    if (!itemForm.material || !itemForm.quantity_ordered) return
    setSaving(true)
    try {
      const payload = {
        purchase_order: id,
        material: itemForm.material,
        quantity_ordered: itemForm.quantity_ordered,
        unit_price: itemForm.unit_price || 0,
      }
      const res = await authFetch(API + '/api/srm/line-items/', { method: 'POST', body: JSON.stringify(payload) })
      if (res.ok) {
        setItemForm({ material: '', quantity_ordered: '', unit_price: '' })
        setShowAddItem(false)
        fetchAll()
      }
    } catch {}
    setSaving(false)
  }

  const changeStatus = async (status) => {
    try {
      const res = await authFetch(API + `/api/srm/purchase-orders/${id}/`, { method: 'PATCH', body: JSON.stringify({ status }) })
      if (res.ok) fetchAll()
    } catch {}
  }

  const receiveItem = async (lineItemId) => {
    const qty = receiveQty[lineItemId]
    if (!qty || parseFloat(qty) <= 0) return
    try {
      const res = await authFetch(API + `/api/srm/line-items/${lineItemId}/receive/`, { method: 'POST', body: JSON.stringify({ quantity: qty }) })
      if (res.ok) {
        setReceiveQty(r => ({ ...r, [lineItemId]: '' }))
        fetchAll()
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to receive item')
      }
    } catch {}
  }

  if (loading || !po) {
    return <div style={{ minHeight: '100vh', background: '#F7F4F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}>Loading...</div>
  }

  const st = STATUS_STYLES[po.status] || STATUS_STYLES.draft

  return (
    <div style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span onClick={() => navigate("/dashboard")} style={{ color: ACCENT, fontWeight: 800, fontSize: 18, cursor: "pointer" }}>WoodCalc</span>
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span onClick={() => navigate('/purchase-orders')} style={{ color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Purchase Orders</span>
          <span style={{ color: '#666', fontSize: 12 }}>›</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{po.po_number}</span>
        </div>
        <button onClick={() => navigate('/purchase-orders')}
          style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          Back to List
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: DARK }}>{po.po_number}</h1>
              <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>{po.supplier_name}</div>
              <div style={{ color: '#888', fontSize: 12, marginTop: 8 }}>
                Ordered {po.order_date}{po.expected_delivery_date ? ` · Expected ${po.expected_delivery_date}` : ''}{po.actual_delivery_date ? ` · Received ${po.actual_delivery_date}` : ''}
              </div>
              {po.notes && <div style={{ color: '#666', fontSize: 12, marginTop: 8, fontStyle: 'italic' }}>{po.notes}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              {po.is_late && <span style={{ fontSize: 11, color: '#c33', background: '#fee', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>LATE</span>}
              <select value={po.status} onChange={e => changeStatus(e.target.value)}
                style={{ fontSize: 12, color: st.color, background: st.bg, padding: '6px 12px', borderRadius: 20, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: DARK }}>Line Items</h2>
          <button onClick={() => setShowAddItem(true)}
            style={{ padding: '8px 16px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            + Add Item
          </button>
        </div>

        {(!po.line_items || po.line_items.length === 0) ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb', background: '#fff', borderRadius: 12 }}>
            <div style={{ fontSize: 12 }}>No line items yet. Click "+ Add Item" to add materials to this order.</div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {po.line_items.map((li, i) => (
              <div key={li.id} style={{ padding: '14px 20px', borderBottom: i < po.line_items.length - 1 ? '1px solid #F7F4F0' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: DARK }}>{li.material_sku} — {li.material_name}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                      {li.quantity_received} / {li.quantity_ordered} received {li.unit_price ? `· ${li.unit_price}/unit` : ''}
                    </div>
                  </div>
                  {li.is_fully_received ? (
                    <span style={{ fontSize: 11, color: '#3a3', background: '#eef7ee', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>COMPLETE</span>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="number" placeholder="Qty" value={receiveQty[li.id] || ''} onChange={e => setReceiveQty(r => ({ ...r, [li.id]: e.target.value }))}
                        style={{ width: 70, padding: '6px 8px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 12, outline: 'none' }} />
                      <button onClick={() => receiveItem(li.id)}
                        style={{ padding: '6px 12px', background: DARK, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                        Receive
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 4 }}>Add Line Item</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>Select a material and quantity</div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Material *</div>
              <select value={itemForm.material} onChange={e => setItemForm(f => ({ ...f, material: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK, background: '#fff' }}>
                <option value="">Select a material...</option>
                {materials.map(m => <option key={m.id} value={m.id}>{m.sku} — {m.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Quantity Ordered *</div>
              <input type="number" value={itemForm.quantity_ordered} onChange={e => setItemForm(f => ({ ...f, quantity_ordered: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Unit Price</div>
              <input type="number" value={itemForm.unit_price} onChange={e => setItemForm(f => ({ ...f, unit_price: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK }} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAddItem(false)}
                style={{ flex: 1, padding: '10px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#666' }}>
                Cancel
              </button>
              <button onClick={addLineItem} disabled={saving || !itemForm.material || !itemForm.quantity_ordered}
                style={{ flex: 2, padding: '10px', background: (itemForm.material && itemForm.quantity_ordered) ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8, cursor: (itemForm.material && itemForm.quantity_ordered) ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
                {saving ? 'Adding...' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
