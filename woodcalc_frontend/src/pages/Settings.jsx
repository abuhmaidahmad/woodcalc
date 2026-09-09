import React, { useState, useEffect } from 'react'
import { authFetch, getCompany } from '../api/auth'
import { createCheckout } from '../api/billing'
import { listFeedback, submitFeedback } from '../api/feedback'
import { useNavigate } from 'react-router-dom'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'
const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

const FEEDBACK_STATUS_COLORS = {
  new: '#C8902A', reviewing: '#2A6ACC', planned: '#8A2AC8', declined: '#999', done: '#2AC87A',
}

const PLANS = [
  { id: 'starter', label: 'Starter', priceJod: 300 },
  { id: 'pro', label: 'Pro', priceJod: 600 },
  { id: 'enterprise', label: 'Enterprise', priceJod: 1200 },
]

function ShareCatalogCard() {
  const company = getCompany()
  const [copied, setCopied] = useState(false)

  if (!company) return null

  const link = `${window.location.origin}/browse/${company.slug}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: 20 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: DARK }}>Share your catalog</h2>
      <div style={{ color: '#888', fontSize: 12, marginBottom: 16 }}>
        Anyone with this link can browse your Kitchen Planner catalog and explore designs — no account needed.
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input readOnly value={link} onFocus={e => e.target.select()}
          style={{ flex: 1, padding: '10px 12px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 13, color: DARK, background: '#F7F4F0' }} />
        <button onClick={copyLink}
          style={{ padding: '10px 18px', background: copied ? '#3a3' : ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
    </div>
  )
}

function BillingCard() {
  const company = getCompany()
  const [activating, setActivating] = useState(null)
  const [error, setError] = useState('')

  if (!company) return null

  const isActive = company.status === 'active'

  const activate = async (plan) => {
    setActivating(plan)
    setError('')
    try {
      const res = await createCheckout(plan)
      if (res.redirect_url) {
        window.location.href = res.redirect_url
      } else {
        setError(res.detail || 'Could not start checkout.')
        setActivating(null)
      }
    } catch {
      setError('Could not start checkout.')
      setActivating(null)
    }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: DARK }}>Billing</h2>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
          color: isActive ? '#3a3' : '#8A5A00',
          background: isActive ? '#eef7ee' : '#FCE9C7',
        }}>
          {company.status.toUpperCase()}
        </span>
      </div>

      {isActive ? (
        <>
          <div style={{ color: '#888', fontSize: 12, marginBottom: 20 }}>
            Current plan: <strong style={{ color: DARK }}>{company.plan}</strong>
            {company.subscription_ends_at && (
              <> · Renews on {new Date(company.subscription_ends_at).toLocaleDateString()}</>
            )}
          </div>
          <button onClick={() => activate(company.plan)} disabled={activating === company.plan}
            style={{ padding: '10px 20px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            {activating === company.plan ? 'Redirecting…' : 'Update card'}
          </button>
        </>
      ) : (
        <>
          <div style={{ color: '#888', fontSize: 12, marginBottom: 20 }}>
            Activate a plan to keep using WoodCalc after your trial ends.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {PLANS.map(p => (
              <button key={p.id} onClick={() => activate(p.id)} disabled={activating === p.id}
                style={{ flex: '1 1 140px', padding: '14px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>{p.label}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{p.priceJod} JOD/year</div>
                <div style={{ fontSize: 11, color: ACCENT, fontWeight: 600, marginTop: 8 }}>
                  {activating === p.id ? 'Redirecting…' : 'Activate →'}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {error && <div style={{ fontSize: 12, color: '#c33', marginTop: 12 }}>{error}</div>}
    </div>
  )
}

function FeedbackCard() {
  const company = getCompany()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const fetchFeedback = async () => {
    setLoading(true)
    try {
      const data = await listFeedback()
      setItems(Array.isArray(data) ? data : (data.results || []))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchFeedback() }, [])

  if (!company) return null

  const send = async () => {
    if (!message.trim()) return
    setSending(true)
    try {
      const res = await submitFeedback(message)
      if (res.id) {
        setMessage('')
        fetchFeedback()
      }
    } catch {}
    setSending(false)
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: 20 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: DARK }}>Send Feedback</h2>
      <div style={{ color: '#888', fontSize: 12, marginBottom: 16 }}>
        Suggest a feature or change — we review every submission before anything changes.
      </div>

      <textarea value={message} onChange={e => setMessage(e.target.value)}
        placeholder="What would help your team?"
        rows={3}
        style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: DARK, fontFamily: 'inherit', resize: 'vertical', marginBottom: 12 }} />

      <button onClick={send} disabled={sending || !message.trim()}
        style={{ padding: '10px 20px', background: message.trim() ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8, cursor: message.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
        {sending ? 'Sending…' : 'Send Feedback'}
      </button>

      {!loading && items.length > 0 && (
        <div style={{ marginTop: 20, borderTop: '1px solid #F7F4F0', paddingTop: 16 }}>
          {items.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: DARK, flex: 1 }}>{item.message}</div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap',
                color: FEEDBACK_STATUS_COLORS[item.status], border: `1.5px solid ${FEEDBACK_STATUS_COLORS[item.status]}`,
              }}>
                {item.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const [emailAccount, setEmailAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ email_address: '', app_password: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  const fetchEmailAccount = async () => {
    setLoading(true)
    try {
      const res = await authFetch(API + '/api/auth/email-account/')
      if (res.status === 401) { navigate('/login'); return }
      const data = await res.json()
      setEmailAccount(data.connected ? data : null)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchEmailAccount() }, [])

  const connectEmail = async () => {
    if (!form.email_address.trim() || !form.app_password.trim()) return
    setSaving(true)
    setMessage('')
    try {
      const res = await authFetch(API + '/api/auth/email-account/', {
        method: 'POST',
        body: JSON.stringify({ email_address: form.email_address, app_password: form.app_password }),
      })
      if (res.ok) {
        setForm({ email_address: '', app_password: '' })
        setMessage('Email account connected successfully.')
        fetchEmailAccount()
      } else {
        const err = await res.json()
        setMessage('Error: ' + JSON.stringify(err))
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
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Settings</span>
        </div>
        <button onClick={() => navigate('/dashboard')}
          style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          Dashboard
        </button>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: DARK }}>Settings</h1>
        <div style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>Manage your account preferences</div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: DARK }}>Purchasing Email</h2>
            {emailAccount && (
              <span style={{ fontSize: 11, color: '#3a3', background: '#eef7ee', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>CONNECTED</span>
            )}
          </div>
          <div style={{ color: '#888', fontSize: 12, marginBottom: 20 }}>
            Connect your email so the system can send Purchase Orders directly to suppliers.
          </div>

          {loading ? (
            <div style={{ color: '#bbb', fontSize: 13 }}>Loading...</div>
          ) : (
            <>
              {emailAccount && (
                <div style={{ background: '#F7F4F0', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 13, color: DARK }}>
                  Currently connected: <strong>{emailAccount.email_address}</strong>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>Gmail Address</div>
                <input type="email" value={form.email_address} onChange={e => setForm(f => ({ ...f, email_address: e.target.value }))}
                  placeholder="purchasing@yourcompany.com"
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: DARK }} />
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 500 }}>App Password</div>
                <input type="password" value={form.app_password} onChange={e => setForm(f => ({ ...f, app_password: e.target.value }))}
                  placeholder="16-character app password"
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: DARK }} />
              </div>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 20 }}>
                Not your regular Gmail password — generate an App Password from your Google Account security settings.
              </div>

              {message && (
                <div style={{ fontSize: 12, color: message.startsWith('Error') ? '#c33' : '#3a3', marginBottom: 12 }}>{message}</div>
              )}

              <button onClick={connectEmail} disabled={saving || !form.email_address.trim() || !form.app_password.trim()}
                style={{ padding: '10px 20px', background: (form.email_address.trim() && form.app_password.trim()) ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8, cursor: (form.email_address.trim() && form.app_password.trim()) ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
                {saving ? 'Connecting...' : emailAccount ? 'Update Email Account' : 'Connect Email Account'}
              </button>
            </>
          )}
        </div>

        <ShareCatalogCard />
        <BillingCard />
        <FeedbackCard />
      </div>
    </div>
  )
}
