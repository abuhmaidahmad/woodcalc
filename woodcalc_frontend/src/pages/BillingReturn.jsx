import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authFetch, saveSession } from '../api/auth'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'
const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'
const POLL_MS = 2000
const TIMEOUT_MS = 30000

export default function BillingReturn() {
  const navigate = useNavigate()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const startedAt = Date.now()

    const poll = async () => {
      try {
        const res = await authFetch(API + '/api/auth/me/')
        if (res.ok) {
          const userData = await res.json()
          if (userData.company?.status === 'active') {
            const tokens = { access: localStorage.getItem('access_token'), refresh: localStorage.getItem('refresh_token') }
            saveSession(tokens, userData)
            navigate('/dashboard')
            return
          }
        }
      } catch {}

      if (Date.now() - startedAt >= TIMEOUT_MS) {
        setTimedOut(true)
        return
      }
      setTimeout(poll, POLL_MS)
    }

    poll()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '48px 40px', maxWidth: 420, textAlign: 'center', boxShadow: '0 8px 48px rgba(0,0,0,0.10)' }}>
        {timedOut ? (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: DARK, margin: '0 0 10px' }}>Still confirming your payment</h1>
            <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px' }}>
              This is taking longer than expected. Refresh in a minute, or contact support if your account isn't activated shortly.
            </p>
            <button onClick={() => navigate('/dashboard')}
              style={{ padding: '10px 20px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              Go to Dashboard
            </button>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: DARK, margin: '0 0 10px' }}>Confirming your payment…</h1>
            <p style={{ fontSize: 13, color: '#888', margin: 0 }}>This usually takes a few seconds.</p>
          </>
        )}
      </div>
    </div>
  )
}
