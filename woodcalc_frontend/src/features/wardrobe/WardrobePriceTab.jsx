import React, { useMemo } from 'react'
import { useTranslation } from '../../i18n/LanguageContext'
import { computeWardrobe } from './wardrobeEngine'
import { priceWardrobe, MATERIAL_ROLES, ROLE_TYPES, USD_RATE, fmt, otherConstruction, constructionName } from './wardrobePricing'
import { usePricing } from './useWardrobePricing'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'
const card = { background: '#fff', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 14 }
const label = { fontSize: 11, color: '#777', marginBottom: 4, display: 'block' }
const input = { width: '100%', boxSizing: 'border-box', padding: '7px 9px', border: '1px solid #ddd6cc', borderRadius: 7, fontSize: 13, background: '#fff' }
const th = { textAlign: 'start', padding: '7px 8px', fontSize: 11, color: '#777', fontWeight: 600, borderBottom: '1px solid #eee7dd', whiteSpace: 'nowrap' }
const td = { padding: '7px 8px', fontSize: 12, borderBottom: '1px solid #f3eee7', whiteSpace: 'nowrap' }
const ghost = { padding: '6px 10px', background: '#fff', color: DARK, border: '1px solid #ddd6cc', borderRadius: 7, cursor: 'pointer', fontSize: 12 }

function MaterialPicker({ role, value, materials, onChange, t }) {
  const types = ROLE_TYPES[role]
  const match = materials.filter((m) => types.includes(m.material_type))
  const rest = materials.filter((m) => !types.includes(m.material_type))
  const opt = (m) => (
    <option key={m.sku} value={m.sku}>
      {m.name} · {m.sku}{m.board_thickness ? ` · ${m.board_thickness}mm` : ''}{m.price_per_board ? ` · ${fmt(m.price_per_board)} JD` : ` · ${t('wardrobe.price.noPrice')}`}
    </option>
  )
  return (
    <label style={{ display: 'block', marginBottom: 8 }}>
      <span style={label}>{t(`wardrobe.material.${role}`)}</span>
      <select style={input} value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{t('wardrobe.price.standardBoard')}</option>
        {match.length > 0 && <optgroup label={t('wardrobe.price.matching')}>{match.map(opt)}</optgroup>}
        {rest.length > 0 && <optgroup label={t('wardrobe.price.otherMaterials')}>{rest.map(opt)}</optgroup>}
      </select>
    </label>
  )
}

export default function WardrobePriceTab({ design, std, result, materialsState, onPricingChange, onOpenStandard }) {
  const { t } = useTranslation()
  const { materials, loading, error } = materialsState
  const settings = design.pricing || {}
  const { price, opts } = usePricing(design, std, materials, result)
  const other = useMemo(() => otherConstruction(design), [design])
  const otherPrice = useMemo(() => priceWardrobe(computeWardrobe(other, std), std, opts), [other, std, opts])
  const set = (patch) => onPricingChange({ ...settings, ...patch })
  const setPick = (role, sku) => set({ picks: { ...(settings.picks || {}), [role]: sku } })
  const shared = design.construction === 'shared' ? price : otherPrice
  const boxes = design.construction === 'shared' ? otherPrice : price
  const saving = boxes.grandTotal - shared.grandTotal
  const sharedDesign = design.construction === 'shared' ? design : other
  const errors = result.warnings.filter((w) => w.level === 'error')

  const totalRows = [
    [t('wardrobe.price.boards'), price.boardsCost],
    [t('wardrobe.price.edge'), price.edge.cost],
    [t('wardrobe.price.hardware'), price.hardwareCost],
    [t('wardrobe.price.materialSubtotal'), price.materialSubtotal, true],
    [t('wardrobe.price.labourRow', { pct: price.labourPct }), price.labourAmount],
    [t('wardrobe.price.costSubtotal'), price.costSubtotal, true],
    [t('wardrobe.price.marginRow', { pct: price.marginPct }), price.marginAmount],
    [t('wardrobe.price.afterMargin'), price.afterMargin, true],
    [t('wardrobe.price.vat16'), price.vatAmount],
  ]

  return (
    <div className="wb-grid">
      <div className="wb-noprint">
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{t('wardrobe.price.materialsTitle')}</div>
          {loading && <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>{t('wardrobe.price.loading')}</div>}
          {error && <div style={{ fontSize: 12, color: '#9b2c2c', marginBottom: 8 }}>{t('wardrobe.price.loadError')}</div>}
          {MATERIAL_ROLES.map((role) => (
            <MaterialPicker key={role} role={role} value={settings.picks?.[role]} materials={materials} onChange={(sku) => setPick(role, sku)} t={t} />
          ))}
          <div style={{ fontSize: 11, color: '#999' }}>{t('wardrobe.price.materialsHint')}</div>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{t('wardrobe.price.marginTitle')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label>
              <span style={label}>{t('wardrobe.price.labourPct')}</span>
              <input type="number" min={0} step={1} style={input} value={settings.labourPct ?? std.labourPct} onChange={(e) => set({ labourPct: e.target.value === '' ? null : Number(e.target.value) })} />
            </label>
            <label>
              <span style={label}>{t('wardrobe.price.marginPct')}</span>
              <input type="number" min={0} step={1} style={input} value={settings.marginPct ?? std.marginPct} onChange={(e) => set({ marginPct: e.target.value === '' ? null : Number(e.target.value) })} />
            </label>
          </div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>{t('wardrobe.price.hardwareHint')}</div>
          <button style={{ ...ghost, marginTop: 8 }} onClick={onOpenStandard}>{t('wardrobe.price.editPrices')}</button>
        </div>
      </div>

      <div className="wb-print-full" style={{ minWidth: 0 }}>
        {errors.length > 0 && <div style={{ ...card, color: '#9b2c2c', fontSize: 12 }}>{t('wardrobe.fixErrors')}</div>}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{t('wardrobe.price.breakdownTitle')}</div>
            <div style={{ fontSize: 12, color: '#777' }}>{t('wardrobe.construction')}: <b>{constructionName(t, design)}</b></div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>{t('wardrobe.col.material')}</th>
                  <th style={th}>{t('wardrobe.price.board')}</th>
                  <th style={th}>{t('wardrobe.col.thickness')}</th>
                  <th style={th}>m²</th>
                  <th style={th}>{t('wardrobe.price.sheets')}</th>
                  <th style={th}>{t('wardrobe.price.unit')}</th>
                  <th style={{ ...th, textAlign: 'end' }}>{t('wardrobe.price.cost')}</th>
                </tr>
              </thead>
              <tbody>
                {price.boards.map((b) => (
                  <tr key={`${b.material}-${b.T}`}>
                    <td style={td}>{t(`wardrobe.material.${b.material}`)}</td>
                    <td style={td}>
                      {b.name || t('wardrobe.price.standardBoard')}
                      <div style={{ fontSize: 10, color: '#aaa' }}>{b.board.L} × {b.board.W}{b.fromCatalog ? '' : ` · ${t('wardrobe.price.standardPrice')}`}</div>
                    </td>
                    <td style={td}>{b.T}</td>
                    <td style={td}>{b.areaM2}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{b.sheets}</td>
                    <td style={td}>{fmt(b.unit)} JD</td>
                    <td style={{ ...td, textAlign: 'end', fontWeight: 600 }}>{fmt(b.cost)} JD</td>
                  </tr>
                ))}
                <tr>
                  <td style={td} colSpan={4}>{t('wardrobe.price.edge')}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{price.edge.meters} m</td>
                  <td style={td}>{fmt(price.edge.unit)} JD</td>
                  <td style={{ ...td, textAlign: 'end', fontWeight: 600 }}>{fmt(price.edge.cost)} JD</td>
                </tr>
                {price.hardware.map((h) => (
                  <tr key={h.key}>
                    <td style={td} colSpan={4}>{t(`wardrobe.price.hw.${h.key}`)}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{h.qty}</td>
                    <td style={td}>{fmt(h.unit)} JD</td>
                    <td style={{ ...td, textAlign: 'end', fontWeight: 600 }}>{fmt(h.cost)} JD</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{t('wardrobe.price.summaryTitle')}</div>
            {totalRows.map(([k, v, strong]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12, borderBottom: '1px solid #f3eee7', fontWeight: strong ? 700 : 400 }}>
                <span>{k}</span><span>{fmt(v)} JD</span>
              </div>
            ))}
            <div style={{ marginTop: 12, padding: '12px 14px', background: ACCENT + '12', borderRadius: 10, border: `2px solid ${ACCENT}33`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800 }}>{t('wardrobe.price.sellingPrice')}</span>
              <div style={{ textAlign: 'end' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>{fmt(price.grandTotal)} JD</div>
                <div style={{ fontSize: 12, color: '#888' }}>${fmt(price.grandTotal / USD_RATE)} USD</div>
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{t('wardrobe.price.compareTitle')}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th} />
                  <th style={{ ...th, textAlign: 'end' }}>{t('wardrobe.constructionTypes.boxes')}</th>
                  <th style={{ ...th, textAlign: 'end' }}>{constructionName(t, sharedDesign)}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [t('wardrobe.price.sheets'), boxes.sheetCount, shared.sheetCount, false],
                  [t('wardrobe.price.boards'), boxes.boardsCost, shared.boardsCost, true],
                  [t('wardrobe.price.edge'), boxes.edge.cost, shared.edge.cost, true],
                  [t('wardrobe.price.hardware'), boxes.hardwareCost, shared.hardwareCost, true],
                  [t('wardrobe.price.costSubtotal'), boxes.costSubtotal, shared.costSubtotal, true],
                  [t('wardrobe.price.sellingPrice'), boxes.grandTotal, shared.grandTotal, true],
                ].map(([k, a, b, money]) => (
                  <tr key={k}>
                    <td style={td}>{k}</td>
                    <td style={{ ...td, textAlign: 'end', fontWeight: design.construction !== 'shared' ? 700 : 400 }}>{money ? `${fmt(a)} JD` : a}</td>
                    <td style={{ ...td, textAlign: 'end', fontWeight: design.construction === 'shared' ? 700 : 400 }}>{money ? `${fmt(b)} JD` : b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: saving >= 0 ? '#eaf6ee' : '#fdecec', color: saving >= 0 ? '#2f7d4f' : '#9b2c2c', fontSize: 13, fontWeight: 700 }}>
              {saving >= 0
                ? t('wardrobe.price.saving', { amount: fmt(saving), pct: boxes.grandTotal > 0 ? ((saving / boxes.grandTotal) * 100).toFixed(1) : '0.0' })
                : t('wardrobe.price.costsMore', { amount: fmt(-saving) })}
            </div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>{t('wardrobe.price.compareHint')}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
