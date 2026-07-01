import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authFetch } from '../api/auth'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'
const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

const TYPE_LABELS = { front: 'Front / Door', worktop: 'Worktop / Countertop', carcass: 'Carcass / Interior' }
const TYPE_COLORS = { front: '#C8902A', worktop: '#2A7AC8', carcass: '#2A8A4A' }
const FINISH_OPTIONS = ['matt', 'gloss', 'wood', 'metal', 'other']

const EMPTY_FORM = {
  name: '', code: '', material_type: 'front', finish: 'matt',
  supplier: '', fallback_hex: '#C8902A',
  board_width: 2440, board_height: 1220, thickness: 18,
  price_per_board: '', roughness: 0.4, metalness: 0.0,
}

const EMPTY_SUPPLIER = { name: '', contact_name: '', phone: '', email: '', address: '' }

function forceHttps(url) {
  if (!url) return url
  return url.replace(/^http:\/\//i, 'https://')
}

export default function MaterialCatalog() {
  const navigate = useNavigate()
  const [textures, setTextures] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null) // null = add, object = edit
  const [form, setForm] = useState(EMPTY_FORM)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER)
  const [savingSupplier, setSavingSupplier] = useState(false)
  const fileRef = useRef()

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [tRes, sRes] = await Promise.all([
        authFetch(API + '/api/inventory/textures/'),
        authFetch(API + '/api/inventory/suppliers/'),
      ])
      const tData = await tRes.json()
      const sData = await sRes.json()
      setTextures(Array.isArray(tData) ? tData : (tData.results || []))
      setSuppliers(Array.isArray(sData) ? sData : (sData.results || []))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setImageFile(null)
    setImagePreview(null)
    setShowModal(true)
  }

  const openEdit = (t) => {
    setEditing(t)
    setForm({
      name: t.name || '',
      code: t.code || '',
      material_type: t.material_type || 'front',
      finish: t.finish || 'matt',
      supplier: t.supplier || '',
      fallback_hex: t.fallback_hex || '#C8902A',
      board_width: t.board_width || 2440,
      board_height: t.board_height || 1220,
      thickness: t.thickness || 18,
      price_per_board: t.price_per_board || '',
      roughness: t.roughness ?? 0.4,
      metalness: t.metalness ?? 0.0,
    })
    setImageFile(null)
    setImagePreview(forceHttps(t.texture_image))
    setShowModal(true)
  }

  const handleImage = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const save = async () => {
    if (!form.name.trim()) return
    if (!editing && !imageFile) return
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) fd.append(k, v)
      })
      if (imageFile) fd.append('texture_image', imageFile)

      const url = editing
        ? API + `/api/inventory/textures/${editing.id}/`
        : API + '/api/inventory/textures/'
      const method = editing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') },
        body: fd,
      })
      if (res.ok) {
        setShowModal(false)
        fetchAll()
      }
    } catch {}
    setSaving(false)
  }

  const deleteMaterial = async (id) => {
    if (!window.confirm('Delete this material?')) return
    setDeleting(id)
    try {
      await authFetch(API + `/api/inventory/textures/${id}/`, { method: 'DELETE' })
      fetchAll()
    } catch {}
    setDeleting(null)
  }

  const openSupplierModal = () => {
    setSupplierForm(EMPTY_SUPPLIER)
    setShowSupplierModal(true)
  }

  const saveSupplier = async () => {
    if (!supplierForm.name.trim()) return
    setSavingSupplier(true)
    try {
      const res = await authFetch(API + '/api/inventory/suppliers/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierForm),
      })
      if (res.ok) {
        const newSupplier = await res.json()
        setSuppliers(prev => [...prev, newSupplier])
        setForm(f => ({ ...f, supplier: newSupplier.id }))
        setShowSupplierModal(false)
      }
    } catch {}
    setSavingSupplier(false)
  }

  const filtered = textures.filter(t => {
    const matchType = filter === 'all' || t.material_type === filter
    const matchSearch = !search ||
      t.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.code?.toLowerCase().includes(search.toLowerCase()) ||
      t.supplier_name?.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  return (
    <div style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>

      {/* Top bar */}
      <div style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: ACCENT, fontWeight: 800, fontSize: 18 }}>WoodCalc</span>
          <span style={{ color: '#555', fontSize: 12 }}>|</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Materials Catalog</span>
        </div>
        <button onClick={() => navigate('/dashboard')}
          style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          ← Dashboard
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: DARK }}>Materials Catalog</h1>
            <div style={{ color: '#888', fontSize: 13, marginTop: 2 }}>{textures.length} material{textures.length !== 1 ? 's' : ''}</div>
          </div>
          <button onClick={openAdd}
            style={{ padding: '10px 20px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            + Add Material
          </button>
        </div>

        {/* Filters + Search */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['all', 'All'], ['front', 'Front / Door'], ['worktop', 'Worktop'], ['carcass', 'Carcass']].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)}
                style={{ padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: filter === val ? ACCENT : '#fff',
                  color: filter === val ? '#fff' : '#666',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                {label}
              </button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, code, supplier..."
            style={{ flex: 1, minWidth: 200, padding: '8px 14px', border: '1.5px solid #E0DAD4', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }} />
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🪵</div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>No materials yet</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Click "+ Add Material" to upload the first one</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {filtered.map(t => (
              <MaterialCard
                key={t.id} texture={t}
                onEdit={() => openEdit(t)}
                onDelete={() => deleteMaterial(t.id)}
                deleting={deleting === t.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Supplier Modal */}
      {showSupplierModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>

            <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 4 }}>Add Supplier</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>Create a new supplier to link with your materials</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Supplier Name *" value={supplierForm.name} onChange={v => setSupplierForm(f => ({ ...f, name: v }))} placeholder="e.g. Egger Europe" />
              <Field label="Contact Name" value={supplierForm.contact_name} onChange={v => setSupplierForm(f => ({ ...f, contact_name: v }))} placeholder="e.g. Ali Hassan" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Phone" value={supplierForm.phone} onChange={v => setSupplierForm(f => ({ ...f, phone: v }))} placeholder="+962 7x xxx xxxx" />
                <Field label="Email" value={supplierForm.email} onChange={v => setSupplierForm(f => ({ ...f, email: v }))} placeholder="supplier@example.com" />
              </div>
              <Field label="Address" value={supplierForm.address} onChange={v => setSupplierForm(f => ({ ...f, address: v }))} placeholder="Amman, Jordan" />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowSupplierModal(false)}
                style={{ flex: 1, padding: '11px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#666', fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={saveSupplier} disabled={savingSupplier || !supplierForm.name.trim()}
                style={{ flex: 2, padding: '11px', background: supplierForm.name.trim() ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                {savingSupplier ? 'Saving...' : 'Create Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Material Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>

            <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 4 }}>
              {editing ? 'Edit Material' : 'Add Material'}
            </div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>
              {editing ? `Editing: ${editing.name}` : 'Fill in the material details and upload a texture photo'}
            </div>

            {/* Image upload */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 6, fontWeight: 600 }}>TEXTURE PHOTO {!editing && '*'}</div>
              <div
                onClick={() => fileRef.current.click()}
                style={{ width: '100%', height: 160, borderRadius: 10, border: '2px dashed #E0DAD4', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAFA', position: 'relative' }}>
                {imagePreview ? (
                  <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ textAlign: 'center', color: '#bbb' }}>
                    <div style={{ fontSize: 32, marginBottom: 6 }}>📷</div>
                    <div style={{ fontSize: 12 }}>Click to upload texture photo</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
              {imageFile && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{imageFile.name}</div>}
            </div>

            {/* Row: Name + Code */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label="Material Name *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Cambrian Oak" />
              <Field label="Code" value={form.code} onChange={v => setForm(f => ({ ...f, code: v }))} placeholder="e.g. 03R-CAM-OAK" />
            </div>

            {/* Row: Type + Finish */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 600 }}>TYPE *</div>
                <select value={form.material_type} onChange={e => setForm(f => ({ ...f, material_type: e.target.value }))}
                  style={selectStyle}>
                  <option value="front">Front / Door</option>
                  <option value="worktop">Worktop / Countertop</option>
                  <option value="carcass">Carcass / Interior</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 600 }}>FINISH</div>
                <select value={form.finish} onChange={e => setForm(f => ({ ...f, finish: e.target.value }))}
                  style={selectStyle}>
                  {FINISH_OPTIONS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                </select>
              </div>
            </div>

            {/* Supplier */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 600 }}>SUPPLIER</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                  style={{ ...selectStyle, flex: 1 }}>
                  <option value="">— No supplier —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button onClick={openSupplierModal} title="Add new supplier"
                  style={{ flexShrink: 0, width: 38, height: 38, background: ACCENT + '18', border: `1.5px solid ${ACCENT}55`, borderRadius: 7, cursor: 'pointer', fontSize: 18, color: ACCENT, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  +
                </button>
              </div>
              {suppliers.length === 0 && (
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>No suppliers yet — click + to add one</div>
              )}
            </div>

            {/* Board dimensions */}
            <div style={{ fontSize: 11, color: '#666', marginBottom: 6, fontWeight: 600 }}>BOARD SIZE & THICKNESS (mm)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label="Width" value={form.board_width} type="number" onChange={v => setForm(f => ({ ...f, board_width: v }))} placeholder="2440" />
              <Field label="Height" value={form.board_height} type="number" onChange={v => setForm(f => ({ ...f, board_height: v }))} placeholder="1220" />
              <Field label="Thickness" value={form.thickness} type="number" onChange={v => setForm(f => ({ ...f, thickness: v }))} placeholder="18" />
            </div>

            {/* Price + Fallback color */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label="Price per Board (JD)" value={form.price_per_board} type="number" onChange={v => setForm(f => ({ ...f, price_per_board: v }))} placeholder="0.00" />
              <div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 600 }}>FALLBACK COLOR</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" value={form.fallback_hex} onChange={e => setForm(f => ({ ...f, fallback_hex: e.target.value }))}
                    style={{ width: 36, height: 36, border: '1.5px solid #E0DAD4', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
                  <input value={form.fallback_hex} onChange={e => setForm(f => ({ ...f, fallback_hex: e.target.value }))}
                    style={{ ...inputStyle, flex: 1 }} placeholder="#C8902A" />
                </div>
              </div>
            </div>

            {/* Roughness + Metalness */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 600 }}>ROUGHNESS <span style={{ color: '#bbb' }}>(0 = mirror, 1 = matte)</span></div>
                <input type="range" min="0" max="1" step="0.05" value={form.roughness}
                  onChange={e => setForm(f => ({ ...f, roughness: parseFloat(e.target.value) }))}
                  style={{ width: '100%' }} />
                <div style={{ fontSize: 11, color: '#888', textAlign: 'right' }}>{form.roughness}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 600 }}>METALNESS <span style={{ color: '#bbb' }}>(0 = plastic, 1 = metal)</span></div>
                <input type="range" min="0" max="1" step="0.05" value={form.metalness}
                  onChange={e => setForm(f => ({ ...f, metalness: parseFloat(e.target.value) }))}
                  style={{ width: '100%' }} />
                <div style={{ fontSize: 11, color: '#888', textAlign: 'right' }}>{form.metalness}</div>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowModal(false)}
                style={{ flex: 1, padding: '11px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#666', fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={save}
                disabled={saving || !form.name.trim() || (!editing && !imageFile)}
                style={{ flex: 2, padding: '11px', background: (form.name.trim() && (editing || imageFile)) ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Material'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MaterialCard({ texture, onEdit, onDelete, deleting }) {
  const [hovered, setHovered] = useState(false)
  const typeColor = TYPE_COLORS[texture.material_type] || ACCENT
  const imgUrl = forceHttps(texture.texture_image)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: hovered ? '0 6px 20px rgba(0,0,0,0.10)' : '0 1px 4px rgba(0,0,0,0.06)', border: '1.5px solid', borderColor: hovered ? ACCENT : 'transparent', transition: 'all 0.15s' }}>

      {/* Texture photo */}
      <div style={{ height: 140, background: texture.fallback_hex || '#E0DAD4', position: 'relative', overflow: 'hidden' }}>
        {imgUrl && (
          <img src={imgUrl} alt={texture.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { e.target.style.display = 'none' }} />
        )}
        <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 700, color: '#fff', background: typeColor, padding: '3px 8px', borderRadius: 4 }}>
          {TYPE_LABELS[texture.material_type] || texture.material_type}
        </span>
        {texture.finish && (
          <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 600, color: '#555', background: 'rgba(255,255,255,0.9)', padding: '3px 8px', borderRadius: 4, textTransform: 'capitalize' }}>
            {texture.finish}
          </span>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: DARK, marginBottom: 2 }}>{texture.name}</div>
        {texture.code && <div style={{ fontSize: 11, color: '#888', marginBottom: 6, fontFamily: 'monospace' }}>{texture.code}</div>}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          <Chip label={`${texture.board_width || 2440} × ${texture.board_height || 1220} mm`} />
          <Chip label={`${texture.thickness || 18} mm thick`} />
          {texture.price_per_board && <Chip label={`${parseFloat(texture.price_per_board).toFixed(2)} JD`} accent />}
        </div>

        {texture.supplier_name && (
          <div style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>Supplier: <strong style={{ color: DARK }}>{texture.supplier_name}</strong></div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onEdit}
            style={{ flex: 1, padding: '7px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#555' }}>
            Edit
          </button>
          <button onClick={onDelete} disabled={deleting}
            style={{ padding: '7px 12px', background: '#FFF0F0', border: '1.5px solid #FFCCCC', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#E74C3C' }}>
            {deleting ? '...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 600 }}>{label.toUpperCase()}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle} />
    </div>
  )
}

function Chip({ label, accent }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: accent ? ACCENT + '18' : '#F0EBE5', color: accent ? ACCENT : '#666' }}>
      {label}
    </span>
  )
}

const inputStyle = {
  width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7,
  fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK, background: '#fff',
}

const selectStyle = {
  width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7,
  fontSize: 12, outline: 'none', color: DARK, background: '#fff',
}
