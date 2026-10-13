import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authFetch } from '../../api/auth'
import { useTranslation } from '../../i18n/LanguageContext'
import { glassOrderItems } from './formulaEngine'

const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'
const ACCENT = '#C8902A'
const DARK = '#1A1A1A'

// Drafts the glass suppliers' purchase orders for this room: every glass shelf and
// aluminium glass door at its size (doors at outer size -- the supplier sizes the
// glass). One draft PO per supplier, reviewed and emailed from the PO page.
export default function GlassOrderModal({ cabinets, roomId, projectName, materialsMap, onClose }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const items = useMemo(() => glassOrderItems(cabinets), [cabinets])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [existing, setExisting] = useState(null)
  const [created, setCreated] = useState(null)

  const missing = items.filter(i => !i.materialCode)
  const noSupplier = items.filter(i => i.materialCode && materialsMap[i.materialCode] && !materialsMap[i.materialCode].supplier)
  const totalM2 = items.reduce((s, i) => s + i.width * i.height * i.qty / 1e6, 0)

  const submit = async (force = false) => {
    setBusy(true); setError('')
    try {
      const res = await authFetch(API + '/api/srm/purchase-orders/from-cut-list/', {
        method: 'POST',
        body: JSON.stringify({
          source_ref: roomId ? `room:${roomId}:glass` : '',
          notes: t('glassOrder.poNotes', { room: projectName }),
          force,
          items: items.map(i => ({ material_sku: i.materialCode, description: i.description, width: i.width, height: i.height, quantity: i.qty })),
        }),
      })
      const data = await res.json()
      if (res.status === 409) setExisting(data.purchase_orders || [])
      else if (!res.ok) setError(data.error || t('glassOrder.error'))
      else setCreated(data)
    } catch {
      setError(t('glassOrder.error'))
    }
    setBusy(false)
  }

  const cell = { padding: '8px 10px', fontSize: 12, borderBottom: '1px solid #F0EBE5' }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: 640, maxWidth: 'calc(100vw - 32px)', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 4 }}>{t('glassOrder.title')}</div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>{t('glassOrder.desc')}</div>

        {items.length === 0 ? (
          <div style={{ color: '#999', fontSize: 13, marginBottom: 16 }}>{t('glassOrder.nothing')}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
            <thead><tr style={{ background: '#FAFAFA' }}>
              {[t('glassOrder.colItem'), t('glassOrder.colSize'), t('glassOrder.colQty'), t('glassOrder.colMaterial')].map(h => (
                <th key={h} style={{ ...cell, textAlign: 'start', fontWeight: 600, color: '#888', fontSize: 11 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {items.map((i, idx) => (
                <tr key={idx}>
                  <td style={cell}>{i.description}</td>
                  <td style={{ ...cell, fontFamily: 'monospace' }}>{i.width} × {i.height}</td>
                  <td style={cell}>{i.qty}</td>
                  <td style={{ ...cell, color: i.materialCode ? '#444' : '#c33' }}>
                    {i.materialCode ? `${i.materialCode}${materialsMap[i.materialCode]?.supplier_name ? ` · ${materialsMap[i.materialCode].supplier_name}` : ''}` : t('glassOrder.noMaterial')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {items.length > 0 && <div style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>{t('glassOrder.totalM2', { m2: totalM2.toFixed(2) })}</div>}

        {missing.length > 0 && <div style={{ fontSize: 12, color: '#c33', marginBottom: 12 }}>{t('glassOrder.missingMaterial')}</div>}
        {noSupplier.length > 0 && <div style={{ fontSize: 12, color: '#c33', marginBottom: 12 }}>{t('glassOrder.missingSupplier', { skus: noSupplier.map(i => i.materialCode).join(', ') })}</div>}
        {error && <div style={{ fontSize: 12, color: '#c33', marginBottom: 12 }}>{error}</div>}

        {existing && (
          <div style={{ background: '#FFF7E8', borderRadius: 8, padding: 12, fontSize: 12, color: '#8A6D3B', marginBottom: 12 }}>
            {t('glassOrder.alreadyOrdered')}{' '}
            {existing.map(po => (
              <span key={po.id} onClick={() => navigate(`/purchase-orders/${po.id}`)} style={{ color: ACCENT, cursor: 'pointer', fontWeight: 700, marginInlineEnd: 8 }}>{po.po_number} ({po.status})</span>
            ))}
            <div style={{ marginTop: 8 }}>
              <button onClick={() => submit(true)} disabled={busy}
                style={{ padding: '6px 12px', background: '#fff', border: `1.5px solid ${ACCENT}`, color: ACCENT, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                {t('glassOrder.orderAgain')}
              </button>
            </div>
          </div>
        )}

        {created ? (
          <div style={{ background: '#eef7ee', borderRadius: 8, padding: 12, fontSize: 12, color: '#2a7a2a', marginBottom: 12 }}>
            {t('glassOrder.created')}{' '}
            {created.map(po => (
              <span key={po.id} onClick={() => navigate(`/purchase-orders/${po.id}`)} style={{ color: ACCENT, cursor: 'pointer', fontWeight: 700, marginInlineEnd: 8 }}>{po.po_number} · {po.supplier_name}</span>
            ))}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: 11, background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#666', fontWeight: 600 }}>
            {created ? t('glassOrder.close') : t('glassOrder.cancel')}
          </button>
          {!created && (
            <button onClick={() => submit(false)} disabled={busy || items.length === 0 || missing.length > 0 || noSupplier.length > 0 || !!existing}
              style={{ flex: 2, padding: 11, background: (items.length && !missing.length && !noSupplier.length && !existing) ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              {busy ? t('glassOrder.creating') : t('glassOrder.create')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
