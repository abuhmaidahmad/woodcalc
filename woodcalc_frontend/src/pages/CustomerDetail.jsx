import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

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

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddProject, setShowAddProject] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', notes: '', status: 'DRAFT' })
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(API + `/api/crm/clients/${id}/`, { headers: headers() }),
        fetch(API + `/api/crm/projects/?client=${id}`, { headers: headers() }),
      ])
      const cData = await cRes.json()
      const pData = await pRes.json()
      setCustomer(cData)
setProjects(Array.isArray(pData) ? pData : (pData.results || []))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const saveProject = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch(API + '/api/crm/projects/', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ ...form, client: id }),
      })
      if (res.ok) {
        setForm({ name: '', address: '', notes: '', status: 'DRAFT' })
        setShowAddProject(false)
        fetchData()
      }
    } catch {}
    setSaving(false)
  }

  const totalValue = projects.reduce((s, p) => s + parseFloat(p.total_value || 0), 0)

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#bbb', fontFamily: 'Inter, sans-serif' }}>Loading...</div>
  if (!customer) return <div style={{ padding: 40, textAlign: 'center', color: '#bbb', fontFamily: 'Inter, sans-serif' }}>Customer not found</div>

  return (
    <div style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      {/* Top bar */}
      <div style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: ACCENT, fontWeight: 800, fontSize: 18 }}>WoodCalc</span>
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span onClick={() => navigate('/customers')} style={{ color: '#888', fontSize: 13, cursor: 'pointer' }}>Customers</span>
          <span style={{ color: '#666', fontSize: 12 }}>›</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{customer.name}</span>
        </div>
        <button onClick={() => navigate('/customers')}
          style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          ← Back
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>

        {/* Customer card */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: ACCENT + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: ACCENT }}>
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: DARK }}>{customer.name}</div>
              {customer.company && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{customer.company}</div>}
              <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                {customer.phone && <span style={{ fontSize: 12, color: '#555' }}>📱 {customer.phone}</span>}
                {customer.email && <span style={{ fontSize: 12, color: '#555' }}>✉️ {customer.email}</span>}
                {customer.address && <span style={{ fontSize: 12, color: '#555' }}>📍 {customer.address}</span>}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Total Value</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>{totalValue.toFixed(2)} JD</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{projects.length} project{projects.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* Projects */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: DARK }}>Projects</div>
          <button onClick={() => setShowAddProject(true)}
            style={{ padding: '8px 16px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            + New Project
          </button>
        </div>

        {projects.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#bbb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📁</div>
            <div style={{ fontWeight: 600 }}>No projects yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Click "+ New Project" to start one</div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {projects.map((p, i) => (
              <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < projects.length - 1 ? '1px solid #F7F4F0' : 'none', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#FDFAF6'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: DARK }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    {p.room_count} room{p.room_count !== 1 ? 's' : ''} · {new Date(p.created_at).toLocaleDateString('en-GB')}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{parseFloat(p.total_value).toFixed(2)} JD</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLORS[p.status] || '#888', background: (STATUS_COLORS[p.status] || '#888') + '18', padding: '3px 8px', borderRadius: 4 }}>
                    {p.status}
                  </span>
                  <span style={{ color: '#ccc', fontSize: 18 }}>›</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Project Modal */}
      {showAddProject && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 4 }}>New Project</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>For {customer.name}</div>
            {[['name', 'Project Name *'], ['address', 'Site Address'], ['notes', 'Notes']].map(([key, label]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>{label}</div>
                <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK }} />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Status</div>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', color: DARK, background: '#fff' }}>
                {['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAddProject(false)}
                style={{ flex: 1, padding: '10px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#666' }}>
                Cancel
              </button>
              <button onClick={saveProject} disabled={saving || !form.name.trim()}
                style={{ flex: 2, padding: '10px', background: form.name.trim() ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8, cursor: form.name.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
                {saving ? 'Saving...' : 'Save Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
