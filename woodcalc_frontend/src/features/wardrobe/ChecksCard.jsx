import React from 'react'
import { useTranslation } from '../../i18n/LanguageContext'
import { card, ghost } from './ui'

export default function ChecksCard({ warnings, runLabel = (r) => r, fixesFor = null }) {
  const { t } = useTranslation()
  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{t('wardrobe.checksTitle')}</div>
      {warnings.length === 0 && <div style={{ fontSize: 12, color: '#2f7d4f' }}>{t('wardrobe.allGood')}</div>}
      {warnings.map((w, i) => {
        const fixes = fixesFor ? fixesFor(w) : null
        return (
          <div key={i} style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, marginBottom: 6, background: w.level === 'error' ? '#fdecec' : '#fff6e5', color: w.level === 'error' ? '#9b2c2c' : '#7a5410' }}>
            {w.run ? `${runLabel(w.run)}: ` : ''}{t(`wardrobe.warn.${w.code}`, w.params)}
            {fixes && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {fixes.map((f) => <button key={f.label} style={{ ...ghost, padding: '3px 8px', fontSize: 11 }} onClick={f.run}>{f.label}</button>)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
