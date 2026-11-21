import React from 'react'
import { useTranslation } from '../../i18n/LanguageContext'
import { FRONT_ITEM_TYPES, MAX_DOORS_PER_SECTION, hasCustomFronts, resolveFrontRows, rowsFromZones, frontItemHinge } from './wardrobeEngine'
import NumField from './NumField'
import { ACCENT, DARK, label, input, ghost } from './ui'

function Toggle({ options, value, onChange, labelOf }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map((o) => (
        <button key={o} onClick={(e) => { e.stopPropagation(); onChange(o) }}
          style={{ ...ghost, padding: '4px 10px', flex: 1, background: value === o ? DARK : '#fff', color: value === o ? '#fff' : DARK }}>
          {labelOf(o)}
        </button>
      ))}
    </div>
  )
}

export default function FrontsEditor({ sec, si, secOut, bodyH, T, setSection, selectedRow, onSelectRow }) {
  const { t } = useTranslation()
  const custom = hasCustomFronts(sec)
  const singleHinge = sec.hinge === 'right' ? 'right' : 'left'
  const fronts = custom ? sec.fronts : []
  const resolved = custom ? resolveFrontRows(fronts, bodyH).rows : []
  const setFronts = (next) => setSection(si, { fronts: next })
  const setRow = (ri, patch) => setFronts(fronts.map((r, j) => (j === ri ? { ...r, ...patch } : r)))
  const moveRow = (ri, by) => {
    const j = ri + by
    if (j < 0 || j >= fronts.length) return
    const out = [...fronts]
    ;[out[ri], out[j]] = [out[j], out[ri]]
    setFronts(out)
  }
  const removeRow = (ri) => { if (fronts.length > 1) setFronts(fronts.filter((_, j) => j !== ri)) }
  const setFill = (ri) => setFronts(fronts.map((r, j) => ({ ...r, h: j === ri ? null : (r.h ?? Math.round(resolved[j]?.h || 400)) })))
  const setCount = (ri, n) => {
    const row = fronts[ri]
    const items = n === 2
      ? [row.items[0] || { type: 'door' }, row.items[1] || { type: row.items[0]?.type || 'door' }].map((it) => ({ type: it.type }))
      : [{ type: row.items[0]?.type || 'door', hinge: singleHinge }]
    setRow(ri, { items })
  }
  const setItem = (ri, k, patch) => setRow(ri, {
    items: fronts[ri].items.map((it, j) => {
      if (j !== k) return it
      const next = { ...it, ...patch }
      if (next.type !== 'door') delete next.hinge
      else if (fronts[ri].items.length === 1 && !next.hinge) next.hinge = singleHinge
      return next
    }),
  })
  const startCustom = () => {
    const n = Math.min(MAX_DOORS_PER_SECTION, Math.max(1, secOut?.doors || 1))
    setFronts([{ h: null, items: n === 2 ? [{ type: 'door' }, { type: 'door' }] : [{ type: 'door', hinge: singleHinge }] }])
  }
  const matchZones = () => {
    if (!secOut?.zones?.length) return
    setFronts(rowsFromZones(secOut.zones, bodyH, T).map((r) => ({ ...r, items: [{ type: 'door', hinge: singleHinge }] })))
  }
  const hingeLabel = (o) => t(`wardrobe.fronts.${o}`)

  return (
    <div style={{ marginTop: 12, border: '1px solid #eee7dd', borderRadius: 8, padding: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 12 }}>{t('wardrobe.fronts.title')}</span>
        <div style={{ width: 160 }}>
          <Toggle options={['auto', 'custom']} value={custom ? 'custom' : 'auto'} labelOf={(o) => t(`wardrobe.fronts.${o}`)}
            onChange={(o) => (o === 'custom' ? (!custom && startCustom()) : setSection(si, { fronts: null }))} />
        </div>
      </div>

      {!custom && secOut?.doors === 1 && (
        <div>
          <span style={label}>{t('wardrobe.fronts.hinge')}</span>
          <Toggle options={['left', 'right']} value={singleHinge} labelOf={hingeLabel} onChange={(o) => setSection(si, { hinge: o })} />
        </div>
      )}

      {custom && (
        <>
          {fronts.map((row, ri) => {
            const r = resolved[ri]
            const active = selectedRow === ri
            const n = Math.min(MAX_DOORS_PER_SECTION, Math.max(1, row.items?.length || 1))
            return (
              <div key={ri} onClick={() => onSelectRow(ri)}
                style={{ border: `1px solid ${active ? ACCENT : '#eee7dd'}`, background: active ? '#fdf8ef' : '#fff', borderRadius: 8, padding: 8, marginTop: 6, cursor: 'pointer' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{t('wardrobe.fronts.row', { n: ri + 1 })}</span>
                  <button style={{ ...ghost, padding: '3px 7px' }} title={t('wardrobe.moveUp')} onClick={(e) => { e.stopPropagation(); moveRow(ri, -1) }}>↑</button>
                  <button style={{ ...ghost, padding: '3px 7px' }} title={t('wardrobe.moveDown')} onClick={(e) => { e.stopPropagation(); moveRow(ri, 1) }}>↓</button>
                  <button style={{ ...ghost, padding: '3px 7px', color: '#b23b3b' }} title={t('wardrobe.remove')} onClick={(e) => { e.stopPropagation(); removeRow(ri) }}>×</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, marginTop: 6, alignItems: 'end' }}>
                  <NumField title={t('wardrobe.fronts.height')} value={r?.fill ? null : row.h} placeholder={r ? `${t('wardrobe.auto')} ${Math.round(r.h)}` : ''}
                    disabled={r?.fill} onChange={(v) => setRow(ri, { h: v ?? 0 })} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, paddingBottom: 8 }} onClick={(e) => e.stopPropagation()}>
                    <input type="radio" checked={!!r?.fill} onChange={() => setFill(ri)} />
                    {t('wardrobe.fillRest')}
                  </label>
                </div>
                <div style={{ marginTop: 6 }}>
                  <span style={label}>{t('wardrobe.fronts.pieces')}</span>
                  <Toggle options={[1, 2]} value={n} labelOf={(o) => String(o)} onChange={(o) => setCount(ri, o)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: n === 2 ? '1fr 1fr' : '1fr', gap: 6, marginTop: 6 }}>
                  {row.items.slice(0, n).map((it, k) => (
                    <div key={k} onClick={(e) => e.stopPropagation()}>
                      <select style={{ ...input, padding: '4px 6px', fontSize: 12 }} value={it.type} onChange={(e) => setItem(ri, k, { type: e.target.value })}>
                        {FRONT_ITEM_TYPES.map((ty) => <option key={ty} value={ty}>{t(`wardrobe.fronts.type.${ty}`)}</option>)}
                      </select>
                      {it.type === 'door' && (n === 1 ? (
                        <div style={{ marginTop: 4 }}>
                          <Toggle options={['left', 'right']} value={frontItemHinge(row.items, k)} labelOf={hingeLabel} onChange={(o) => setItem(ri, k, { hinge: o })} />
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{t('wardrobe.fronts.hingedOn', { side: hingeLabel(frontItemHinge(row.items, k)) })}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button style={ghost} onClick={() => setFronts([...fronts, { h: 400, items: [{ type: 'door', hinge: singleHinge }] }])}>{t('wardrobe.fronts.addRow')}</button>
            <button style={ghost} onClick={matchZones}>{t('wardrobe.fronts.matchZones')}</button>
          </div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>{t('wardrobe.fronts.hint')}</div>
        </>
      )}
    </div>
  )
}
