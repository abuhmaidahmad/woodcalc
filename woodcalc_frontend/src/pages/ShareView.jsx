import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import KitchenShareView from './KitchenShareView'
import WardrobeShareView from '../features/wardrobe/WardrobeShareView'
import { shareKind } from '../features/rooms/shareKind'
import { useTranslation } from '../i18n/LanguageContext'

const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'
const DARK = '#1A1A1A'

export function SharedRoom({ data }) {
  return shareKind(data) === 'wardrobe' ? <WardrobeShareView data={data} /> : <KitchenShareView data={data} />
}

export default function ShareView() {
  const { token } = useParams()
  const { t, language } = useTranslation()
  const dir = language === 'ar' ? 'rtl' : 'ltr'
  const [state, setState] = useState({ loading: true, data: null, notFound: false })

  useEffect(() => {
    let cancelled = false
    fetch(`${API}/api/crm/rooms/shared/${token}/`)
      .then((res) => {
        if (res.status === 404) { if (!cancelled) setState({ loading: false, data: null, notFound: true }); return null }
        if (!res.ok) throw new Error('request failed')
        return res.json()
      })
      .then((data) => { if (data && !cancelled) setState({ loading: false, data, notFound: false }) })
      .catch(() => { if (!cancelled) setState({ loading: false, data: null, notFound: true }) })
    return () => { cancelled = true }
  }, [token])

  if (state.loading) return <Centered dir={dir}>{t('kitchenShareView.loading')}</Centered>

  if (state.notFound || !state.data) return (
    <Centered dir={dir}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>🔗</div>
      <div style={{ fontWeight: 700, color: '#eee', marginBottom: 6 }}>{t('kitchenShareView.notFound')}</div>
      <div style={{ fontSize: 13, color: '#888' }}>{t('kitchenShareView.notFoundHint')}</div>
    </Centered>
  )

  return <SharedRoom data={state.data} />
}

function Centered({ dir, children }) {
  return (
    <div dir={dir} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: '#bbb', background: DARK, textAlign: 'center', padding: 24 }}>
      {children}
    </div>
  )
}
