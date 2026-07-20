import React, { useState, useEffect } from 'react'
import { authFetch } from '../api/auth'
import { useNavigate } from 'react-router-dom'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'
const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

const CATEGORY_LABELS = {
  raw_material: 'Raw Material',
  hardware: 'Hardware',
  glass: 'Glass',
  countertop: 'Countertop/Stone',
  appliance: 'Appliance',
  other: 'Other',
}

export default function SupplierList() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', contact_name: '', phone: '', email: '', address: '', category: 'other', payment_terms: '', lead_time_days: '' })
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const navigate = useNavigate()

  const fetchSuppliers = async () => {
    setLoading(true)
    try {
      const res = await authFetch(API + '/api/inventory/suppliers/')
      if (res.status === 401) { navigate('/login'); return }
      const data = await res.json()
      setSuppliers(Array.isArray(data) ? data : (data.results || []))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchSuppliers() }, [])

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  )

  const saveSupplier = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const payload = { ...form, lead_time_days: form.lead_time_days ? parseInt(form.lead_time_days) : null }
      const url = editing ? API + `/api/inventory/suppliers/${editing}/` : API + '/api/inventory/suppliers/'
      const method = editing ? 'PATCH' : 'POST'
      const res = await authFetch(url, { method, body: JSON.stringify(payload) })
      if (res.ok) {
        setForm({ name: '', contact_name: '', phone: '', email: '', address: '', category: 'other', payment_terms: '', lead_time_days: '' })
        setShowAdd(false)
        setEditing(null)
        fetchSuppliers()
      }
    } catch {}
    setSaving(false)
  }

  const openEdit = (s) => {
    setEditing(s.id)
    setForm({
      name: s.name || '', contact_name: s.contact_name || '', phone: s.phone || '',
      email: s.email || '', address: s.address || '', category: s.category || 'other',
      payment_terms: s.payment_terms || '', lead_time_days: s.lead_time_days != null ? String(s.lead_time_days) : '',
    })
    setShowAdd(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span onClick={() => navigate("/dashboard")} style={{ color: ACCENT, fontWeight: 800, fontSize: 18, cursor: "pointer" }}>WoodCalc</span>
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Suppliers</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate('/purchase-orders')}
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            Purchase Orders
          </button>
          <button onClick={() => navigate('/materials')}
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            Materials
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
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: DARK }}>Suppliers</h1>
            <div style={{ color: '#888', fontSize: 13, marginTop: 2 }}>{suppliers.length} total</div>
          </div>
          <button onClick={() => setShowAdd(true)}
            style={{ padding: '10px 20px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            + New Supplier
          </button>
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, contact or email..."
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E0DAD4', borderRadius: 8, fontSize: 13, outline: 'none', marginBottom: 16, boxSizing: 'border-box', background: '#fff' }} />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚚</div>
            <div style={{ fontWeight: 600 }}>No suppliers yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Click "+ New Supplier" to add one</div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {filtered.map((s, i) => (
              <div key={s.id} onClick={() => openEdit(s)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #F7F4F0' : 'none', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#FDFAF6'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: (s.is_active ? ACCENT : '#bbb') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: s.is_active ? ACCENT : '#bbb' }}>
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: DARK }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                      {[s.contact_name, s.phone, s.email].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {s.lead_time_days != null && <span style={{ fontSize: 11, color: '#888' }}>{s.lead_time_days}d lead time</span>}
                  <span style={{ fontSize: 11, color: '#888', background: '#F0EBE5', padding: '2px 8px', borderRadius: 4 }}>{CATEGORY_LABELS[s.category] || s.category}</span>
                  {!s.is_active && <span style={{ fontSize: 11, color: '#c33', background: '#fee', padding: '2px 8px', borderRadius: 4 }}>INACTIVE</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 4 }}>{editing ? 'Edit Supplier' : 'New Supplier'}</div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>Fill in the supplier details</div>
              </div>
              {editing && (
                <button onClick={() => navigate(`/suppliers/${editing}/statement`)}
                  style={{ padding: '6px 12px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: DARK, whiteSpace: 'nowrap' }}>
                  View Statement
                </button>
              )}
            </div>
            {[['name', 'Company Name *'], ['contact_name', 'Contact Name'], ['phone', 'Phone'], ['email', 'Email'], ['address', 'Address'], ['payment_terms', 'Payment Terms (e.g. Net 30)'], ['lead_time_days', 'Lead Time (days)']].map(([key, label]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{label}</div>
                <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK }} />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Category</div>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK, background: '#fff' }}>
                {Object.entries(CATEGORY_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => { setShowAdd(false); setEditing(null); setForm({ name: '', contact_name: '', phone: '', email: '', address: '', category: 'other', payment_terms: '', lead_time_days: '' }) }}
                style={{ flex: 1, padding: '10px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#666' }}>
                Cancel
              </button>
              <button onClick={saveSupplier} disabled={saving || !form.name.trim()}
                style={{ flex: 2, padding: '10px', background: form.name.trim() ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8, cursor: form.name.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
                {saving ? 'Saving...' : editing ? 'Update Supplier' : 'Save Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
