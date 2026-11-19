import React from 'react'
import { useTranslation } from '../../i18n/LanguageContext'
import NumField from './NumField'

export default function SlidingOptions({ value, onChange, autoDoors }) {
  const { t } = useTranslation()
  const box = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8, alignItems: 'end' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 6 }}>
        <label style={box}>
          <input type="checkbox" checked={!!value.slidingCover} onChange={(e) => onChange({ slidingCover: e.target.checked })} />
          {t('wardrobe.sliding.cover')}
        </label>
        <label style={box}>
          <input type="checkbox" checked={!!value.slidingMirror} onChange={(e) => onChange({ slidingMirror: e.target.checked })} />
          {t('wardrobe.sliding.mirror')}
        </label>
      </div>
      <NumField title={t('wardrobe.sliding.doors')} value={value.slidingDoors} min={2}
        placeholder={`${t('wardrobe.auto')} ${autoDoors ?? ''}`}
        onChange={(v) => onChange({ slidingDoors: v == null ? null : Math.max(2, Math.round(v)) })} />
    </div>
  )
}
