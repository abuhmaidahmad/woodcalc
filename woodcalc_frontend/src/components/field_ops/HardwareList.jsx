import React from 'react'
import { useTranslation } from '../../i18n/LanguageContext'
import { cleanHardware } from './jobDesign'

const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingBlock: 10, borderBottom: '1px solid #F0EBE5' }

export default function HardwareList({ items }) {
  const { t } = useTranslation()
  const rows = cleanHardware(items)
  if (rows.length === 0) return <div style={{ fontSize: 14, color: '#777' }}>{t('fieldOps.noHardware')}</div>
  return rows.map(item => (
    <div key={item.key + (item.spec || '')} style={row} data-hardware-key={item.key}>
      <span style={{ fontSize: 15 }}>{t('fieldOps.hw.' + item.key)}{item.spec ? ` · ${item.spec}` : ''}</span>
      <span style={{ fontSize: 16, fontWeight: 700 }}>{item.qty}</span>
    </div>
  ))
}
