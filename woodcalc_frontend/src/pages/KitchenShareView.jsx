import React from 'react'
import KitchenPlanner3D from '../features/kitchen_planner/KitchenPlanner3D'
import ErrorBoundary from '../components/ErrorBoundary'
import { useTranslation } from '../i18n/LanguageContext'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'

// Public, read-only 3D-only view for a shared kitchen link (/view/:token).
// Deliberately renders KitchenPlanner3D directly instead of the full
// KitchenPlannerModule — a customer following this link should never see
// the editing tools, pricing/proposal tab or contract tab that module has.
export default function KitchenShareView({ data }) {
  const { t, language } = useTranslation()
  const dir = language === 'ar' ? 'rtl' : 'ltr'

  const room = data
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
            stairs={room.stairs || []}
            elements={room.elements}
            countertopMat={room.countertopMat}
            countertopThickness={room.countertopThickness}
            backsplashSegments={room.backsplashSegments}
            backsplashHeight={room.backsplashHeight}
            backsplashThickness={room.backsplashThickness}
            companySlug={room.company_slug}
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
