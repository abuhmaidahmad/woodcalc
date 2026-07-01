import React, { useState, useEffect } from 'react'
import { authFetch } from '../api/auth'
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

const ROOM_ICONS = {
  kitchen: '🍳', bathroom: '🚿', bedroom: '🛏', living: '🛋',
  office: '💼', laundry: '👕', other: '📦',
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [rooms, setRooms] = useState([])
  const [payments, setPayments] = useState([])
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

  const totalPaid = payments.filter(p => p.status === 'PAID').reduce((s, p) => s + parseFloat(p.amount || 0), 0)
  const totalPending = payments.filter(p => p.status === 'PENDING').reduce((s, p) => s + parseFloat(p.amount || 0), 0)

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#bbb', fontFamily: 'Inter, sans-serif' }}>Loading...</div>
  if (!project) return <div style={{ padding: 40, textAlign: 'center', color: '#bbb', fontFamily: 'Inter, sans-serif' }}>Project not found</div>

  return (
    <div style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      {/* Top bar */}
      <div style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span onClick={() => navigate("/dashboard")} style={{ color: ACCENT, fontWeight: 800, fontSize: 18, cursor: "pointer" }}>WoodCalc</span>
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span onClick={() => navigate('/customers')} style={{ color: '#888', fontSize: 13, cursor: 'pointer' }}>Customers</span>
          <span style={{ color: '#666', fontSize: 12 }}>›</span>
          <span onClick={() => navigate(`/customers/${project.client}`)} style={{ color: '#888', fontSize: 13, cursor: 'pointer' }}>{project.client_name}</span>
          <span style={{ color: '#666', fontSize: 12 }}>›</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{project.name}</span>
        </div>
        <button onClick={() => navigate(`/customers/${project.client}`)}
          style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          ← Back
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>

        {/* Project header */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: DARK }}>{project.name}</div>
              <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                Client: <strong style={{ color: DARK }}>{project.client_name}</strong>
                {project.address && <span> · {project.address}</span>}
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                Created: {new Date(project.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>{parseFloat(project.total_value).toFixed(2)} JD</div>
              <select value={project.status} onChange={e => updateStatus(e.target.value)}
                style={{ marginTop: 8, padding: '5px 10px', border: `2px solid ${STATUS_COLORS[project.status] || '#888'}`, borderRadius: 6, fontSize: 11, fontWeight: 700, color: STATUS_COLORS[project.status] || '#888', background: (STATUS_COLORS[project.status] || '#888') + '15', outline: 'none', cursor: 'pointer' }}>
                {['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Payment summary */}
          {payments.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid #F0EBE5' }}>
              {[
                ['Total Value', parseFloat(project.total_value).toFixed(2) + ' JD', ACCENT],
                ['Paid', totalPaid.toFixed(2) + ' JD', '#2AC87A'],
                ['Pending', totalPending.toFixed(2) + ' JD', '#F39C12'],
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
          {[['rooms', '🏠 Rooms'], ['payments', '💰 Payments']].map(([tab, label]) => (
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
              <div style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{rooms.length} room{rooms.length !== 1 ? 's' : ''}</div>
              <button onClick={() => setShowAddRoom(true)}
                style={{ padding: '8px 16px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                + New Room
              </button>
            </div>
            {rooms.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#bbb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🏠</div>
                <div style={{ fontWeight: 600 }}>No rooms yet</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Add a room to start designing</div>
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
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2, textTransform: 'capitalize' }}>{room.room_type}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{parseFloat(room.grand_total).toFixed(2)} JD</span>
                      <span style={{ fontSize: 11, color: '#888' }}>{new Date(room.updated_at).toLocaleDateString('en-GB')}</span>
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
                <div style={{ fontWeight: 600 }}>No payments yet</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Payments are created from the Contract tab</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAFAFA' }}>
                    {['Milestone', 'Amount', 'Due Date', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#888' }}>{h}</th>
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
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Add Room Modal */}
      {showAddRoom && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 4 }}>New Room</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>Add a room to {project.name}</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Room Name *</div>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Main Kitchen"
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Room Type</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {[['kitchen','🍳'],['bathroom','🚿'],['bedroom','🛏'],['living','🛋'],['office','💼'],['laundry','👕'],['other','📦']].map(([type, icon]) => (
                  <div key={type} onClick={() => setForm(f => ({ ...f, room_type: type }))}
                    style={{ padding: '8px 4px', border: `1.5px solid ${form.room_type === type ? ACCENT : '#E0DAD4'}`, borderRadius: 7, cursor: 'pointer', textAlign: 'center', background: form.room_type === type ? ACCENT + '12' : '#FAFAFA' }}>
                    <div style={{ fontSize: 16 }}>{icon}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: form.room_type === type ? ACCENT : '#666', textTransform: 'capitalize', marginTop: 2 }}>{type}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Notes</div>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK }} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAddRoom(false)}
                style={{ flex: 1, padding: '10px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#666' }}>
                Cancel
              </button>
              <button onClick={saveRoom} disabled={saving || !form.name.trim()}
                style={{ flex: 2, padding: '10px', background: form.name.trim() ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8, cursor: form.name.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
                {saving ? 'Saving...' : 'Create Room'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
