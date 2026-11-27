import React from 'react'
import { useTranslation } from '../../i18n/LanguageContext'
import NumField from './NumField'
import { card, ghost } from './ui'

export default function AccessoriesCard({ accessories, onChange }) {
  const { t } = useTranslation()
  const acc = accessories || {}
  const mirrors = Array.isArray(acc.mirrors) ? acc.mirrors : []
  const set = (patch) => onChange({ ...acc, ...patch })
  const setMirror = (i, patch) => set({ mirrors: mirrors.map((m, k) => (k === i ? { ...m, ...patch } : m)) })
  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{t('wardrobe.acc.title')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'end' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, paddingBottom: 8 }}>
          <input type="checkbox" checked={!!acc.led} onChange={(e) => set({ led: e.target.checked })} />
          {t('wardrobe.acc.led')}
        </label>
        <NumField title={t('wardrobe.acc.ledRows')} value={acc.ledRows ?? 1} min={1} disabled={!acc.led} onChange={(v) => set({ ledRows: v || 1 })} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, margin: '8px 0' }}>
        <input type="checkbox" checked={!!acc.doorSensors} onChange={(e) => set({ doorSensors: e.target.checked })} />
        {t('wardrobe.acc.doorSensors')}
      </label>
      {mirrors.map((m, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end', marginBottom: 6 }}>
          <NumField title={t('wardrobe.acc.mirrorW')} value={m.w} onChange={(v) => setMirror(i, { w: v ?? 0 })} />
          <NumField title={t('wardrobe.acc.mirrorH')} value={m.h} onChange={(v) => setMirror(i, { h: v ?? 0 })} />
          <button style={{ ...ghost, marginBottom: 2 }} onClick={() => set({ mirrors: mirrors.filter((_, k) => k !== i) })}>×</button>
        </div>
      ))}
      <button style={ghost} onClick={() => set({ mirrors: [...mirrors, { w: 400, h: 1200 }] })}>{t('wardrobe.acc.addMirror')}</button>
    </div>
  )
}
