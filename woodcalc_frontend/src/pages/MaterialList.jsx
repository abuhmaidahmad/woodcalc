import React, { useState, useEffect } from 'react'
import { authFetch } from '../api/auth'
import { useNavigate } from 'react-router-dom'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'
const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

const UNIT_LABELS = {
  PCS: 'Pieces', M: 'Meters', M2: 'Square Meters',
  M3: 'Cubic Meters', KG: 'Kilograms', L: 'Liters',
}

const DEFAULT_CATEGORIES = [
  'Wood Panel', 'Solid Wood', 'Countertop/Stone', 'Hardware', 'Glass',
  'Edge Banding', 'Adhesive', 'Finish/Lacquer', 'Fastener', 'Appliance',
]

export default function MaterialList() {
  const [materials, setMaterials] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ sku: '', name: '', category: '', unit: 'PCS', quantity_on_hand: '0', reorder_level: '0', unit_cost: '0', supplier: '' })
  const [customCategory, setCustomCategory] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [mRes, sRes] = await Promise.all([
        authFetch(API + '/api/inventory/materials/'),
        authFetch(API + '/api/inventory/suppliers/'),
      ])
      if (mRes.status === 401) { navigate('/login'); return }
      const mData = await mRes.json()
      const sData = await sRes.json()
      setMaterials(Array.isArray(mData) ? mData : (mData.results || []))
      setSuppliers(Array.isArray(sData) ? sData : (sData.results || []))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const filtered = materials.filter(m =>
    m.sku.toLowerCase().includes(search.toLowerCase()) ||
    m.name.toLowerCase().includes(search.toLowerCase())
  )

  const saveMaterial = async () => {
    if (!form.sku.trim() || !form.name.trim()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        quantity_on_hand: form.quantity_on_hand || 0,
        reorder_level: form.reorder_level || 0,
        unit_cost: form.unit_cost || 0,
        supplier: form.supplier || null,
      }
      const res = await authFetch(API + '/api/inventory/materials/', { method: 'POST', body: JSON.stringify(payload) })
      if (res.ok) {
        setForm({ sku: '', name: '', category: '', unit: 'PCS', quantity_on_hand: '0', reorder_level: '0', unit_cost: '0', supplier: '' })
        setShowAdd(false)
        fetchAll()
      } else {
        const err = await res.json()
        alert(JSON.stringify(err))
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
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Materials (Stock)</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate('/purchase-orders')}
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            Purchase Orders
          </button>
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

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: DARK }}>Materials (Stock)</h1>
            <div style={{ color: '#888', fontSize: 13, marginTop: 2 }}>{materials.length} total</div>
          </div>
          <button onClick={() => setShowAdd(true)}
            style={{ padding: '10px 20px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            + New Material
          </button>
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by SKU or name..."
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E0DAD4', borderRadius: 8, fontSize: 13, outline: 'none', marginBottom: 16, boxSizing: 'border-box', background: '#fff' }} />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
            <div style={{ fontWeight: 600 }}>No materials yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Click "+ New Material" to add stock-tracked SKUs</div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {filtered.map((m, i) => (
              <div key={m.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #F7F4F0' : 'none' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: DARK }}>{m.sku} — {m.name}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    {m.category ? `${m.category} · ` : ''}{UNIT_LABELS[m.unit] || m.unit}{m.unit_cost ? ` · ${m.unit_cost}/unit` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {parseFloat(m.quantity_on_hand) <= parseFloat(m.reorder_level) && (
                    <span style={{ fontSize: 11, color: '#c33', background: '#fee', padding: '2px 8px', borderRadius: 4 }}>LOW STOCK</span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700, color: DARK }}>{m.quantity_on_hand} {m.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 420, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 4 }}>New Material</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>Add a stock-tracked SKU</div>

            {[['sku', 'SKU *'], ['name', 'Name *']].map(([key, label]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{label}</div>
                <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK }} />
              </div>
            ))}

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Category</div>
              {!addingCategory ? (
                <select value={form.category} onChange={e => {
                  if (e.target.value === '__add_new__') { setAddingCategory(true); setForm(f => ({ ...f, category: '' })) }
                  else setForm(f => ({ ...f, category: e.target.value }))
                }}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK, background: '#fff' }}>
                  <option value="">None</option>
                  {[...new Set([...DEFAULT_CATEGORIES, ...materials.map(m => m.category).filter(Boolean)])].sort().map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="__add_new__">+ Add new category...</option>
                </select>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input autoFocus value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                    placeholder="Type new category"
                    style={{ flex: 1, padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK }} />
                  <button onClick={() => {
                    if (customCategory.trim()) setForm(f => ({ ...f, category: customCategory.trim() }))
                    setAddingCategory(false); setCustomCategory('')
                  }}
                    style={{ padding: '8px 12px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    OK
                  </button>
                </div>
              )}
              {!addingCategory && form.category && (
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Selected: {form.category}</div>
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Unit</div>
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK, background: '#fff' }}>
                {Object.entries(UNIT_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Qty on Hand</div>
                <input type="number" value={form.quantity_on_hand} onChange={e => setForm(f => ({ ...f, quantity_on_hand: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Reorder Level</div>
                <input type="number" value={form.reorder_level} onChange={e => setForm(f => ({ ...f, reorder_level: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK }} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Unit Cost</div>
              <input type="number" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Supplier</div>
              <select value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK, background: '#fff' }}>
                <option value="">None</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAdd(false)}
                style={{ flex: 1, padding: '10px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#666' }}>
                Cancel
              </button>
              <button onClick={saveMaterial} disabled={saving || !form.sku.trim() || !form.name.trim()}
                style={{ flex: 2, padding: '10px', background: (form.sku.trim() && form.name.trim()) ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8, cursor: (form.sku.trim() && form.name.trim()) ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
                {saving ? 'Saving...' : 'Save Material'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
