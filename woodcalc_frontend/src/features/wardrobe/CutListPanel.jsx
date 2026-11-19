import React from 'react'
import { useTranslation } from '../../i18n/LanguageContext'
import { cutListCsv } from './wardrobeEngine'
import { ACCENT, card, btn, ghost, th, td } from './ui'

export default function CutListPanel({ result, std, subtitle, csvName }) {
  const { t, language } = useTranslation()
  const errors = result.warnings.filter((w) => w.level === 'error')
  const partName = (p) => (language === 'ar' && p.nameAr ? p.nameAr : p.name)
  const edgeText = (e) => (e ? e.split(',').map((c) => t(`wardrobe.edge.${c}`)).join(' · ') : '—')
  const exportCsv = () => {
    const csv = cutListCsv(result)
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = csvName
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{t('wardrobe.cutListTitle')}</div>
            <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>{subtitle}</div>
          </div>
          <div className="wb-noprint" style={{ display: 'flex', gap: 6 }}>
            <button style={ghost} onClick={exportCsv} disabled={errors.length > 0}>{t('wardrobe.exportCsv')}</button>
            <button style={btn} onClick={() => window.print()}>{t('wardrobe.print')}</button>
          </div>
        </div>
        {errors.length > 0 && <div style={{ fontSize: 12, color: '#9b2c2c', marginBottom: 8 }}>{t('wardrobe.fixErrors')}</div>}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['#', 'part', 'section', 'length', 'width', 'thickness', 'qty', 'material', 'edges'].map((h) => (
                  <th key={h} style={th}>{h === '#' ? '#' : t(`wardrobe.col.${h}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.parts.map((p, i) => (
                <tr key={i}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, fontWeight: 600 }}>
                    <span>{partName(p)}</span>
                    {p.loft && <span style={{ display: 'inline-block', marginInlineStart: 8, fontSize: 10, color: ACCENT }}>{t('wardrobe.loft')}</span>}
                    <div style={{ fontSize: 10, color: '#aaa', fontWeight: 400 }}>{language === 'ar' ? p.name : p.nameAr}</div>
                  </td>
                  <td style={td}>{p.sections.map((s) => (s === 'ALL' ? t('wardrobe.all') : s)).join(' ')}</td>
                  <td style={td}>{p.L}</td>
                  <td style={td}>{p.W}</td>
                  <td style={td}>{p.T}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{p.qty}</td>
                  <td style={td}>{t(`wardrobe.material.${p.material}`)}</td>
                  <td style={td}>{edgeText(p.edges)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {result.bought?.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{t('wardrobe.sliding.boughtTitle')}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>{t('wardrobe.col.part')}</th>
                <th style={th}>{t('wardrobe.col.width')}</th>
                <th style={th}>{t('wardrobe.col.length')}</th>
                <th style={th}>{t('wardrobe.col.qty')}</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {result.bought.map((b) => (
                <tr key={`${b.key}-${b.W}-${b.H}-${b.wide ? 1 : 0}`}>
                  <td style={{ ...td, fontWeight: 600 }}>{t(`wardrobe.sliding.row.${b.key}`)}</td>
                  <td style={td}>{b.W}</td>
                  <td style={td}>{b.H}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{b.qty}</td>
                  <td style={td}>{b.key === 'slidingMirror' ? `${b.areaM2} m²` : t(b.wide ? 'wardrobe.sliding.widePrice' : 'wardrobe.sliding.standardPrice')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{t('wardrobe.hardwareTitle')}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {Object.entries(result.hardware).map(([k, v]) => (
                <tr key={k}><td style={td}>{t(`wardrobe.hw.${k}`)}</td><td style={{ ...td, fontWeight: 700, textAlign: 'end' }}>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{t('wardrobe.materialsTitle')}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr><th style={th}>{t('wardrobe.col.material')}</th><th style={th}>{t('wardrobe.col.thickness')}</th><th style={th}>m²</th><th style={th}>{t('wardrobe.sheetsCol', { l: std.sheetL, w: std.sheetW })}</th></tr>
            </thead>
            <tbody>
              {result.materials.map((m) => (
                <tr key={`${m.material}-${m.T}`}><td style={td}>{t(`wardrobe.material.${m.material}`)}</td><td style={td}>{m.T}</td><td style={td}>{m.areaM2}</td><td style={{ ...td, fontWeight: 700 }}>{m.sheets}</td></tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontWeight: 700, fontSize: 13, margin: '12px 0 6px' }}>{t('wardrobe.edgeTitle')}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {result.edgeBanding.map((e) => (
                <tr key={`${e.material}-${e.thickness}`}><td style={td}>{t(`wardrobe.material.${e.material}`)} · {e.thickness} mm</td><td style={{ ...td, fontWeight: 700, textAlign: 'end' }}>{e.meters} m</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
