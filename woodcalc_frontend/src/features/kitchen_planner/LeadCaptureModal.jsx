import React, { useState } from 'react'
import { authFetch } from '../../api/auth'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'
const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

export default function LeadCaptureModal({ companySlug, designSnapshot, designTotal, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await authFetch(API + '/api/crm/leads/public-capture/', {
        method: 'POST',
        body: JSON.stringify({
          company: companySlug,
          name: form.name,
          email: form.email,
          phone: form.phone,
          design_snapshot: designSnapshot,
          design_total: designTotal,
        }),
      })
      if (res.ok) {
        setDone(true)
      } else {
        const err = await res.json()
        setError(err.detail || 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        {done ? (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, color: DARK, marginBottom: 8 }}>Thanks!</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
              Your design has been saved. Their team will be in touch with you soon to discuss the details.
            </div>
            <button onClick={onClose}
              style={{ width: '100%', padding: '12px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
              Done
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, color: DARK, marginBottom: 4 }}>Save my design</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>
              Leave your details and their team will reach out to discuss your kitchen.
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Name *</div>
              <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: DARK }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Phone</div>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: DARK }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Email</div>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: DARK }} />
            </div>

            {error && <div style={{ fontSize: 12, color: '#c33', marginBottom: 12 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose}
                style={{ flex: 1, padding: '11px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#666' }}>
                Cancel
              </button>
              <button onClick={submit} disabled={saving || !form.name.trim()}
                style={{ flex: 2, padding: '11px', background: form.name.trim() ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8, cursor: form.name.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
                {saving ? 'Saving…' : 'Save my design'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
