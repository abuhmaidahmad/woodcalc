import React from 'react'
import { useTranslation } from '../../i18n/LanguageContext'
import { card } from './ui'

export default function ChecksCard({ warnings, runLabel = (r) => r }) {
  const { t } = useTranslation()
  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{t('wardrobe.checksTitle')}</div>
      {warnings.length === 0 && <div style={{ fontSize: 12, color: '#2f7d4f' }}>{t('wardrobe.allGood')}</div>}
      {warnings.map((w, i) => (
        <div key={i} style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, marginBottom: 6, background: w.level === 'error' ? '#fdecec' : '#fff6e5', color: w.level === 'error' ? '#9b2c2c' : '#7a5410' }}>
          {w.run ? `${runLabel(w.run)}: ` : ''}{t(`wardrobe.warn.${w.code}`, w.params)}
        </div>
      ))}
    </div>
  )
}
