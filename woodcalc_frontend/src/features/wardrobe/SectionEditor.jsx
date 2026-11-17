import React, { useMemo } from 'react'
import { useTranslation } from '../../i18n/LanguageContext'
import { presetZones, newZone, sectionWidths, PRESET_IDS, ZONE_TYPES, MAX_DOORS_PER_SECTION } from './wardrobeEngine'
import NumField from './NumField'
import { ACCENT, DARK, card, label, input, ghost } from './ui'

export default function SectionEditor({ design, setDesign, result, std, selected, setSelected, title, presetIds = PRESET_IDS }) {
  const { t } = useTranslation()
  const widths = useMemo(() => sectionWidths(design), [design])
  const si = Math.min(selected.section, design.sections.length - 1)
  const sec = design.sections[si]
  const secOut = result.sections[si]

  const setSection = (i, patch) => setDesign((d) => ({ ...d, sections: d.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))
  const setZones = (i, fn) => setDesign((d) => ({ ...d, sections: d.sections.map((s, j) => (j === i ? { ...s, preset: null, zones: fn(s.zones || []) } : s)) }))

  const updateZone = (zi, patch) => setZones(si, (zs) => zs.map((z, j) => (j === zi ? { ...z, ...patch } : z)))
  const setAuto = (zi) => setZones(si, (zs) => zs.map((z, j) => ({ ...z, auto: j === zi, h: j === zi ? z.h : (z.auto ? Math.round(secOut?.zones?.[j]?.h || z.h || 400) : z.h) })))
  const moveZone = (zi, by) => setZones(si, (zs) => {
    const out = [...zs]
    const j = zi + by
    if (j < 0 || j >= out.length) return zs
    ;[out[zi], out[j]] = [out[j], out[zi]]
    return out
  })
  const removeZone = (zi) => {
    setZones(si, (zs) => (zs.length > 1 ? zs.filter((_, j) => j !== zi) : zs))
    setSelected((s) => ({ ...s, zone: null }))
  }
  const addZone = (type) => setZones(si, (zs) => [newZone(type, std), ...zs])

  if (!sec) return null
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{title ? `${title} · ` : ''}{t('wardrobe.sectionTitle', { n: si + 1 })}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {design.sections.map((_, i) => (
            <button key={i} onClick={() => setSelected({ section: i, zone: null })}
              style={{ width: 26, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: i === si ? ACCENT : '#eee7dd', color: i === si ? '#fff' : DARK }}>{i + 1}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <NumField title={t('wardrobe.sectionWidth')} value={sec.w} placeholder={`${t('wardrobe.auto')} ${widths[si] ?? ''}`} onChange={(v) => setSection(si, { w: v })} />
        <NumField title={t('wardrobe.doorCount')} value={sec.doors} disabled={design.doorType !== 'hinged'} min={1} max={MAX_DOORS_PER_SECTION}
          placeholder={`${t('wardrobe.auto')} ${secOut?.doors ?? ''}`} onChange={(v) => setSection(si, { doors: v == null ? null : Math.min(MAX_DOORS_PER_SECTION, Math.max(1, Math.round(v))) })} />
      </div>
      <div style={{ marginTop: 10 }}>
        <span style={label}>{t('wardrobe.presetsTitle')}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {presetIds.map((p) => (
            <button key={p} onClick={() => { setSection(si, { preset: p, zones: presetZones(p, std) }); setSelected({ section: si, zone: null }) }}
              style={{ ...ghost, borderColor: sec.preset === p ? ACCENT : '#ddd6cc', color: sec.preset === p ? ACCENT : DARK, fontWeight: sec.preset === p ? 700 : 400 }}>
              {t(`wardrobe.presets.${p}`)}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={label}>{t('wardrobe.zonesTitle')}</span>
          <select style={{ ...input, width: 'auto', padding: '4px 6px', fontSize: 12 }} value="" onChange={(e) => { if (e.target.value) addZone(e.target.value) }}>
            <option value="">{t('wardrobe.addZone')}</option>
            {ZONE_TYPES.map((zt) => <option key={zt} value={zt}>{t(`wardrobe.zone.${zt}`)}</option>)}
          </select>
        </div>
        {(sec.zones || []).map((z, zi) => {
          const rz = secOut?.zones?.[zi]
          const active = selected.zone === zi
          return (
            <div key={zi} onClick={() => setSelected({ section: si, zone: zi })}
              style={{ border: `1px solid ${active ? ACCENT : '#eee7dd'}`, background: active ? '#fdf8ef' : '#fff', borderRadius: 8, padding: 8, marginTop: 6, cursor: 'pointer' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select style={{ ...input, padding: '4px 6px', fontSize: 12 }} value={z.type}
                  onChange={(e) => updateZone(zi, e.target.value === 'drawers' ? { type: 'drawers', n: 2, h: 2 * std.drawerH } : { type: e.target.value, n: e.target.value === 'shelves' ? null : undefined })}>
                  {ZONE_TYPES.map((zt) => <option key={zt} value={zt}>{t(`wardrobe.zone.${zt}`)}</option>)}
                </select>
                <button style={{ ...ghost, padding: '3px 7px' }} title={t('wardrobe.moveUp')} onClick={(e) => { e.stopPropagation(); moveZone(zi, -1) }}>↑</button>
                <button style={{ ...ghost, padding: '3px 7px' }} title={t('wardrobe.moveDown')} onClick={(e) => { e.stopPropagation(); moveZone(zi, 1) }}>↓</button>
                <button style={{ ...ghost, padding: '3px 7px', color: '#b23b3b' }} title={t('wardrobe.remove')} onClick={(e) => { e.stopPropagation(); removeZone(zi) }}>×</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6, marginTop: 6, alignItems: 'end' }}>
                <NumField title={t('wardrobe.zoneHeight')} value={rz?.auto ? null : z.h} placeholder={rz ? `${t('wardrobe.auto')} ${Math.round(rz.h)}` : ''}
                  disabled={rz?.auto} onChange={(v) => updateZone(zi, { h: v ?? 0 })} />
                {z.type === 'shelves' || z.type === 'drawers' ? (
                  <NumField title={z.type === 'shelves' ? t('wardrobe.shelfCount') : t('wardrobe.drawerCount')} value={z.n}
                    placeholder={rz ? `${t('wardrobe.auto')} ${rz.n}` : ''}
                    onChange={(v) => updateZone(zi, z.type === 'drawers' ? { n: v || 1, h: (v || 1) * std.drawerH } : { n: v })} />
                ) : <div />}
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, paddingBottom: 8 }} onClick={(e) => e.stopPropagation()}>
                  <input type="radio" checked={!!rz?.auto} onChange={() => setAuto(zi)} />
                  {t('wardrobe.fillRest')}
                </label>
              </div>
            </div>
          )
        })}
        <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>{t('wardrobe.zonesHint')}</div>
      </div>
    </div>
  )
}
