import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import KitchenPlanner3D from '../features/kitchen_planner/KitchenPlanner3D'
import ErrorBoundary from '../components/ErrorBoundary'
import { useTranslation } from '../i18n/LanguageContext'

const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'
const ACCENT = '#C8902A'
const DARK = '#1A1A1A'

// Public, read-only 3D-only view for a shared kitchen link (/view/:token).
// Deliberately renders KitchenPlanner3D directly instead of the full
// KitchenPlannerModule — a customer following this link should never see
// the editing tools, pricing/proposal tab or contract tab that module has.
export default function KitchenShareView() {
  const { token } = useParams()
  const { t, language } = useTranslation()
  const dir = language === 'ar' ? 'rtl' : 'ltr'
  const [state, setState] = useState({ loading: true, data: null, notFound: false })

  useEffect(() => {
    let cancelled = false
    fetch(`${API}/api/crm/rooms/shared/${token}/`)
      .then(res => {
        if (res.status === 404) { if (!cancelled) setState({ loading: false, data: null, notFound: true }); return null }
        if (!res.ok) throw new Error('request failed')
        return res.json()
      })
      .then(data => { if (data && !cancelled) setState({ loading: false, data, notFound: false }) })
      .catch(() => { if (!cancelled) setState({ loading: false, data: null, notFound: true }) })
    return () => { cancelled = true }
  }, [token])

  if (state.loading) return (
    <Centered dir={dir}>{t('kitchenShareView.loading')}</Centered>
  )

  if (state.notFound || !state.data) return (
    <Centered dir={dir}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>🔗</div>
      <div style={{ fontWeight: 700, color: '#eee', marginBottom: 6 }}>{t('kitchenShareView.notFound')}</div>
      <div style={{ fontSize: 13, color: '#888' }}>{t('kitchenShareView.notFoundHint')}</div>
    </Centered>
  )

  const room = state.data
  const cabinets = room.cabinets || []

  return (
    <div dir={dir} style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif", background: DARK, overflow: 'hidden' }}>
      <div style={{ height: 56, background: DARK, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: ACCENT, padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {t('kitchenShareView.badge')}
        </span>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{room.name}</span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <ErrorBoundary fallback={<Centered dir={dir}>{t('kitchenPlannerModule.view3dFailed')}</Centered>}>
          <KitchenPlanner3D
            cabinets={cabinets}
            room={room.room}
            walls={room.walls}
            elements={room.elements}
            countertopMat={room.countertopMat}
            countertopThickness={room.countertopThickness}
            backsplashSegments={room.backsplashSegments}
            backsplashHeight={room.backsplashHeight}
            backsplashThickness={room.backsplashThickness}
          />
        </ErrorBoundary>
        {!cabinets.length && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', pointerEvents: 'none' }}>
            {t('kitchenShareView.empty')}
          </div>
        )}
      </div>
    </div>
  )
}

function Centered({ dir, children }) {
  return (
    <div dir={dir} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: '#bbb', background: DARK, textAlign: 'center', padding: 24 }}>
      {children}
    </div>
  )
}
