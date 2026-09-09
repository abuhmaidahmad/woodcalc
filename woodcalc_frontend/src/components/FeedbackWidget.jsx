import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { submitFeedback } from '../api/feedback'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'

export default function FeedbackWidget() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  const close = () => {
    setOpen(false)
    setDone(false)
    setMessage('')
  }

  const send = async () => {
    if (!message.trim()) return
    setSending(true)
    try {
      const res = await submitFeedback(message, location.pathname)
      if (res.id) setDone(true)
    } catch {}
    setSending(false)
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 1500,
          padding: '10px 16px', background: DARK, color: '#fff', border: 'none',
          borderRadius: 24, cursor: 'pointer', fontSize: 13, fontWeight: 700,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 6,
        }}>
        💬 Feedback
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            {done ? (
              <>
                <div style={{ fontSize: 20, fontWeight: 800, color: DARK, marginBottom: 8 }}>Thanks!</div>
                <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
                  Got your feedback about this page. We review every submission before anything changes.
                </div>
                <button onClick={close}
                  style={{ width: '100%', padding: '12px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                  Done
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 20, fontWeight: 800, color: DARK, marginBottom: 4 }}>Send Feedback</div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
                  About this page ({location.pathname}) — or anything else on your mind.
                </div>
                <textarea autoFocus value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="What's wrong, or what would help?"
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: DARK, fontFamily: 'inherit', resize: 'vertical', marginBottom: 16 }} />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={close}
                    style={{ flex: 1, padding: '11px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#666' }}>
                    Cancel
                  </button>
                  <button onClick={send} disabled={sending || !message.trim()}
                    style={{ flex: 2, padding: '11px', background: message.trim() ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8, cursor: message.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700 }}>
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
