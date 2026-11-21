import React, { lazy, Suspense, useMemo, useState } from 'react'
import ErrorBoundary from '../../components/ErrorBoundary'
import { useTranslation } from '../../i18n/LanguageContext'
import { normalizeStandard } from './wardrobeStandard'
import { computeDesign } from './closetEngine'
import { validFrontColor } from './wardrobeRoom'
import ClosetPlan from './ClosetPlan'

const Wardrobe3D = lazy(() => import('./Wardrobe3D'))
const Closet3D = lazy(() => import('./Closet3D'))

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'
const CARCASS = '#f1ede6'

function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ padding: '7px 12px', borderRadius: 18, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${active ? DARK : '#d9d1c5'}`, background: active ? DARK : '#fff', color: active ? '#fff' : DARK, whiteSpace: 'nowrap' }}>
      {children}
    </button>
  )
}

export default function WardrobeShareView({ data }) {
  const { t, language } = useTranslation()
  const dir = language === 'ar' ? 'rtl' : 'ltr'
  const design = useMemo(() => data.design || {}, [data.design])
  const closet = design.mode === 'closet' && design.closet ? design.closet : null
  const std = useMemo(() => normalizeStandard(data.standard), [data.standard])
  const result = useMemo(() => computeDesign(design, std), [design, std])
  const frontColor = validFrontColor(data.frontColor)
  const [view, setView] = useState('3d')
  const [doorMode, setDoorMode] = useState('closed')
  const size = closet
    ? `${Math.round(closet.width)} × ${Math.round(closet.roomDepth)} × ${Math.round(closet.height)}`
    : `${Math.round(design.width)} × ${Math.round(design.height)}`
  const loading = <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>{t('wardrobe.loading3d')}</div>

  return (
    <div dir={dir} data-share="wardrobe" style={{ height: '100dvh', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif", background: '#F7F4F0', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', paddingInlineEnd: 120, background: '#fff', borderBottom: '1px solid #eee7dd', flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{data.company_name}</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: DARK, marginTop: 2 }}>{data.name}</div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{closet ? t('wardrobeShare.closet') : t('wardrobeShare.wardrobe')} · {t('wardrobeShare.size', { size })}</div>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '10px 12px', overflowX: 'auto', flexShrink: 0 }}>
        {closet && (
          <>
            <Pill active={view === '3d'} onClick={() => setView('3d')}>{t('wardrobe.closet.view.3d')}</Pill>
            <Pill active={view === 'plan'} onClick={() => setView('plan')}>{t('wardrobe.closet.view.plan')}</Pill>
            <span style={{ width: 8, flexShrink: 0 }} />
          </>
        )}
        {view === '3d' && ['closed', 'open', 'hidden'].map((m) => (
          <Pill key={m} active={doorMode === m} onClick={() => setDoorMode(m)}>{t(`wardrobe.doorMode.${m}`)}</Pill>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative', margin: '0 12px 12px' }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
          <ErrorBoundary fallback={<div style={{ padding: 24, textAlign: 'center', color: '#999' }}>{t('kitchenPlannerModule.view3dFailed')}</div>}>
            {view === 'plan' && closet ? (
              <ClosetPlan result={result} selected={null} onSelect={() => {}} wallLabel={(id) => t(`wardrobe.closet.wall.${id}`)} />
            ) : (
              <Suspense fallback={loading}>
                {closet ? (
                  <Closet3D result={result} closet={closet} std={std} frontColor={frontColor} carcassColor={CARCASS} doorMode={doorMode} height="100%" />
                ) : (
                  <Wardrobe3D result={result} design={design} frontColor={frontColor} carcassColor={CARCASS} doorMode={doorMode} height="100%" />
                )}
              </Suspense>
            )}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
