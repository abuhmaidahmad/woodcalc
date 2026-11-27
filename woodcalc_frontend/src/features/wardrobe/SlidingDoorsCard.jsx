import React from 'react'
import { useTranslation } from '../../i18n/LanguageContext'
import NumField from './NumField'
import { SLIDING_STYLES, slidingStyle } from './slidingDoors'
import { ACCENT, DARK, card, ghost, input, label } from './ui'

function Swatch({ style }) {
  const wood = '#c49a6c'
  const glass = '#cfdbe2'
  const frame = style === 'panel' ? 'none' : '#8d9196'
  const fill = style === 'mirror' ? glass : wood
  return (
    <svg width={22} height={34} viewBox="0 0 22 34" style={{ display: 'block', margin: '0 auto 4px' }}>
      <rect x={1} y={1} width={20} height={32} fill={fill} stroke={frame === 'none' ? '#9a8f80' : frame} strokeWidth={frame === 'none' ? 1 : 2} />
      {style === 'split' && <rect x={2} y={9} width={18} height={16} fill={glass} stroke={frame} strokeWidth={1} />}
    </svg>
  )
}

export default function SlidingDoorsCard({ design, result, onChange }) {
  const { t } = useTranslation()
  const sd = design.slidingDoors || {}
  const count = (result?.geometry || []).filter((g) => g.kind === 'slidingDoor').length
  const set = (patch) => onChange({ ...sd, ...patch })
  const doors = Array.from({ length: count }, (_, k) => (Array.isArray(sd.doors) ? sd.doors[k] || null : null))
  const setDoor = (k, v) => set({ doors: doors.map((d, i) => (i === k ? v || null : d)) })
  const anySplit = Array.from({ length: count }, (_, k) => slidingStyle(design, k)).includes('split')
  const all = SLIDING_STYLES.includes(sd.style) ? sd.style : 'panel'
  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{t('wardrobe.sliding.title')}</div>
      <span style={label}>{t('wardrobe.sliding.allDoors')}</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {SLIDING_STYLES.map((s) => (
          <button key={s} onClick={() => set({ style: s })}
            style={{ ...ghost, padding: '6px 4px', fontSize: 11, lineHeight: 1.2, borderColor: all === s ? ACCENT : '#ddd6cc', color: all === s ? ACCENT : DARK }}>
            <Swatch style={s} />
            {t(`wardrobe.sliding.styles.${s}`)}
          </button>
        ))}
      </div>
      {anySplit && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          <NumField title={t('wardrobe.sliding.topH')} value={sd.topH ?? 400} min={0} onChange={(v) => set({ topH: v ?? 0 })} />
          <NumField title={t('wardrobe.sliding.bottomH')} value={sd.bottomH ?? 400} min={0} onChange={(v) => set({ bottomH: v ?? 0 })} />
        </div>
      )}
      {count > 0 && (
        <>
          <span style={{ ...label, marginTop: 10 }}>{t('wardrobe.sliding.perDoor')}</span>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(count, 4)}, 1fr)`, gap: 6 }}>
            {doors.map((d, k) => (
              <label key={k} style={{ display: 'block' }}>
                <span style={{ fontSize: 10, color: '#999' }}>{t('wardrobe.sliding.door', { n: k + 1 })}</span>
                <select style={{ ...input, padding: '5px 4px', fontSize: 11 }} value={d || ''} onChange={(e) => setDoor(k, e.target.value)}>
                  <option value="">{t('wardrobe.sliding.sameAsAll')}</option>
                  {SLIDING_STYLES.map((s) => <option key={s} value={s}>{t(`wardrobe.sliding.styles.${s}`)}</option>)}
                </select>
              </label>
            ))}
          </div>
        </>
      )}
      <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>{t('wardrobe.sliding.hint')}</div>
    </div>
  )
}
