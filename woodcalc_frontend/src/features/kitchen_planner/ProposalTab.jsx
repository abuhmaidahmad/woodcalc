import React, { useState, useMemo } from 'react'
import { calculateCabinet } from './formulaEngine'
import { COUNTERTOP_MATERIALS } from './CabinetCatalog'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'

// ─── Default price list (JD) ───────────────────────────────────────────────
const DEFAULT_PRICES = {
  sheet18_m2:       12.00,  // 18mm particleboard per m²
  sheet18_ply_m2:   18.00,  // 18mm plywood per m²
  sheet18_mdf_m2:   14.00,  // 18mm MDF per m²
  hdf8_m2:           4.50,  // 8mm HDF back panel per m²
  edge_banding_m:    0.25,  // per meter
  hinge_pc:          1.20,  // Blum hinge per piece
  leg_pc:            0.80,  // adjustable leg per piece
  confirmat_pc:      0.10,  // per piece
  dowel_pc:          0.05,  // per piece
  back_screw_pc:     0.05,  // per piece
  handle_pc:         3.50,  // per handle
  soft_close_pc:     2.00,  // tip-on per piece
  machining_cab:    15.00,  // CNC machining per cabinet
  labor_cab:        20.00,  // labor per cabinet
  countertop_lm:    85.00,  // per linear meter (installed)
  electric_point:   25.00,  // per electrical point
  delivery:         30.00,  // flat delivery fee
  installation_cab:  8.00,  // installation per cabinet
}

const USD_RATE = 0.71  // 1 JD = x USD (editable)

// ─── Price a single cabinet ────────────────────────────────────────────────
function priceCabinet(cab, prices) {
  let result
  try {
    result = calculateCabinet({
      width: cab.width, height: cab.height, depth: cab.depth,
      material: cab.material, doorStyle: cab.doorStyle, shelves: 0,
    })
  } catch { return { materialCost: 0, hardwareCost: 0, machiningCost: 0, laborCost: 0, total: 0, breakdown: [] } }

  const breakdown = []

  // Material cost
  const matKey = cab.material?.toLowerCase().includes('plywood') ? 'sheet18_ply_m2'
    : cab.material?.toLowerCase().includes('mdf') ? 'sheet18_mdf_m2' : 'sheet18_m2'
  const panels18 = result.panels.filter(p => p.thickness === 18)
  const panels8  = result.panels.filter(p => p.thickness === 8)
  const m2_18 = panels18.reduce((s, p) => s + (p.width * p.depth * p.qty / 1e6), 0)
  const m2_8  = panels8.reduce((s,  p) => s + (p.width * p.depth * p.qty / 1e6), 0)
  const doorM2 = result.doors.reduce((s, d) => s + (d.width * d.height / 1e6), 0)

  const boardCost   = parseFloat((m2_18 * prices[matKey]).toFixed(3))
  const hdfCost     = parseFloat((m2_8  * prices.hdf8_m2).toFixed(3))
  const doorMatCost = parseFloat((doorM2 * prices[matKey]).toFixed(3))

  const edgeM = (2 * cab.height + (cab.width - 36) + result.doors.reduce((s, d) => s + 2 * (d.width + d.height), 0)) / 1000
  const edgeCost = parseFloat((edgeM * prices.edge_banding_m).toFixed(3))

  const materialCost = boardCost + hdfCost + doorMatCost + edgeCost
  breakdown.push({ label: '18mm Board', qty: m2_18.toFixed(3) + ' m²', unit: prices[matKey], cost: boardCost })
  breakdown.push({ label: '8mm HDF',    qty: m2_8.toFixed(3)  + ' m²', unit: prices.hdf8_m2, cost: hdfCost })
  breakdown.push({ label: 'Door Panel', qty: doorM2.toFixed(3) + ' m²', unit: prices[matKey], cost: doorMatCost })
  breakdown.push({ label: 'Edge Band',  qty: edgeM.toFixed(2)  + ' m',  unit: prices.edge_banding_m, cost: edgeCost })

  // Hardware cost
  const h = result.hardware
  const hingeCost    = parseFloat(((h.hinges || 0)     * prices.hinge_pc).toFixed(3))
  const legCost      = parseFloat(((h.legs || 0)       * prices.leg_pc).toFixed(3))
  const confirmCost  = parseFloat(((h.confirmats || 0) * prices.confirmat_pc).toFixed(3))
  const dowelCost    = parseFloat(((h.dowels || 0)     * prices.dowel_pc).toFixed(3))
  const screwCost    = parseFloat(((h.back_screws || 0)* prices.back_screw_pc).toFixed(3))
  const handleCost   = parseFloat(((h.handles || 0)    * prices.handle_pc).toFixed(3))
  const softCost     = parseFloat(((h.tip_on || 0)     * prices.soft_close_pc).toFixed(3))
  const hardwareCost = hingeCost + legCost + confirmCost + dowelCost + screwCost + handleCost + softCost

  breakdown.push({ label: 'Hinges',      qty: (h.hinges || 0)     + ' pcs', unit: prices.hinge_pc,     cost: hingeCost })
  breakdown.push({ label: 'Legs',        qty: (h.legs || 0)       + ' pcs', unit: prices.leg_pc,       cost: legCost })
  breakdown.push({ label: 'Confirmats',  qty: (h.confirmats || 0) + ' pcs', unit: prices.confirmat_pc, cost: confirmCost })
  breakdown.push({ label: 'Handles',     qty: (h.handles || 0)    + ' pcs', unit: prices.handle_pc,    cost: handleCost })

  const machiningCost = prices.machining_cab
  const laborCost     = prices.labor_cab

  breakdown.push({ label: 'Machining', qty: '1 cab', unit: prices.machining_cab, cost: machiningCost })
  breakdown.push({ label: 'Labor',     qty: '1 cab', unit: prices.labor_cab,     cost: laborCost })

  const total = parseFloat((materialCost + hardwareCost + machiningCost + laborCost).toFixed(2))
  return { materialCost: parseFloat(materialCost.toFixed(2)), hardwareCost: parseFloat(hardwareCost.toFixed(2)), machiningCost, laborCost, total, breakdown }
}

// ─── Section header ────────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase',
      letterSpacing: '0.08em', marginBottom: 10, marginTop: 20, paddingBottom: 6,
      borderBottom: '1px solid #F0EBE5' }}>
      {children}
    </div>
  )
}

// ─── Editable price row ────────────────────────────────────────────────────
function PriceRow({ label, value, onChange, unit = 'JD' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '5px 0', borderBottom: '1px solid #F7F4F0' }}>
      <span style={{ fontSize: 11, color: '#555' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input type="number" value={value} step="0.01" min="0"
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{ width: 64, padding: '3px 6px', border: '1.5px solid #E0DAD4', borderRadius: 5,
            fontSize: 11, textAlign: 'right', outline: 'none', color: DARK }} />
        <span style={{ fontSize: 10, color: '#aaa', minWidth: 24 }}>{unit}</span>
      </div>
    </div>
  )
}

// ─── Extra line item ───────────────────────────────────────────────────────
function ExtraItem({ item, onChange, onDelete }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
      <input value={item.label} onChange={e => onChange({ ...item, label: e.target.value })}
        placeholder="Description"
        style={{ flex: 1, padding: '5px 7px', border: '1.5px solid #E0DAD4', borderRadius: 5,
          fontSize: 11, outline: 'none', color: DARK }} />
      <input type="number" value={item.qty} min="0" step="0.1"
        onChange={e => onChange({ ...item, qty: parseFloat(e.target.value) || 0 })}
        style={{ width: 50, padding: '5px 6px', border: '1.5px solid #E0DAD4', borderRadius: 5,
          fontSize: 11, textAlign: 'right', outline: 'none', color: DARK }} />
      <input type="number" value={item.unitPrice} min="0" step="0.01"
        onChange={e => onChange({ ...item, unitPrice: parseFloat(e.target.value) || 0 })}
        style={{ width: 64, padding: '5px 6px', border: '1.5px solid #E0DAD4', borderRadius: 5,
          fontSize: 11, textAlign: 'right', outline: 'none', color: DARK }} />
      <span style={{ fontSize: 10, color: '#aaa' }}>JD</span>
      <button onClick={onDelete}
        style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#E74C3C',
          borderRadius: 5, cursor: 'pointer', padding: '3px 7px', fontSize: 12, fontWeight: 700 }}>×</button>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────
export default function ProposalTab({ cabinets, countertopId, projectName }) {
  const [prices, setPrices]           = useState(DEFAULT_PRICES)
  const [margin, setMargin]           = useState(30)
  const [usdRate, setUsdRate]         = useState(USD_RATE)
  const [extras, setExtras]           = useState([
    { id: 1, label: 'Countertop (installed)', qty: 3, unitPrice: prices.countertop_lm },
    { id: 3, label: 'Delivery',               qty: 1, unitPrice: prices.delivery },
    { id: 4, label: 'Installation',           qty: cabinets.length || 1, unitPrice: prices.installation_cab },
  ])
  const [customer, setCustomer]       = useState({ name: '', phone: '', address: '', notes: '' })
  const [expandedCab, setExpandedCab] = useState(null)
  const [showPrices, setShowPrices]   = useState(false)
  const [currency, setCurrency]       = useState('JD')

  const updatePrice = (key, val) => setPrices(p => ({ ...p, [key]: val }))
  const updateExtra = (id, data) => setExtras(p => p.map(e => e.id === id ? data : e))
  const deleteExtra = (id) => setExtras(p => p.filter(e => e.id !== id))
  const addExtra = () => setExtras(p => [...p, { id: Date.now(), label: '', qty: 1, unitPrice: 0 }])

  // Price each cabinet
  const pricedCabinets = useMemo(() =>
    cabinets.map(cab => ({ ...cab, pricing: priceCabinet(cab, prices) })),
    [cabinets, prices]
  )

  const cabinetsSubtotal = pricedCabinets.reduce((s, c) => s + c.pricing.total, 0)
  const extrasSubtotal   = extras.reduce((s, e) => s + (e.qty * e.unitPrice), 0)
  const costSubtotal     = cabinetsSubtotal + extrasSubtotal
  const marginAmount     = costSubtotal * (margin / 100)
  const afterMargin      = costSubtotal + marginAmount
  const vatAmount        = afterMargin * 0.16
  const grandTotal       = afterMargin + vatAmount
  const grandTotalUSD    = grandTotal / usdRate

  const fmt = (n) => n.toFixed(2)
  const fmtC = (n) => currency === 'JD' ? `${fmt(n)} JD` : `$${fmt(n / usdRate)}`

  const countertopMat = COUNTERTOP_MATERIALS.find(m => m.id === countertopId)

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: '#F7F4F0' }}>

      {/* ── LEFT: Settings ── */}
      <div style={{ width: 260, background: '#fff', borderRight: '1px solid #E0DAD4',
        overflowY: 'auto', flexShrink: 0, padding: 16 }}>

        <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 4 }}>Pricing Settings</div>
        <div style={{ fontSize: 11, color: '#999', marginBottom: 12 }}>All prices in JD</div>

        <button onClick={() => setShowPrices(p => !p)}
          style={{ width: '100%', padding: '7px', background: '#F7F4F0', border: '1.5px solid #E0DAD4',
            borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#555',
            marginBottom: 10, textAlign: 'left' }}>
          {showPrices ? '▾' : '▸'} Material & Hardware Prices
        </button>

        {showPrices && <>
          <SectionTitle>Board (per m²)</SectionTitle>
          <PriceRow label="18mm Particleboard" value={prices.sheet18_m2}     onChange={v => updatePrice('sheet18_m2', v)} />
          <PriceRow label="18mm Plywood"        value={prices.sheet18_ply_m2} onChange={v => updatePrice('sheet18_ply_m2', v)} />
          <PriceRow label="18mm MDF"            value={prices.sheet18_mdf_m2} onChange={v => updatePrice('sheet18_mdf_m2', v)} />
          <PriceRow label="8mm HDF"             value={prices.hdf8_m2}        onChange={v => updatePrice('hdf8_m2', v)} />
          <SectionTitle>Finishing (per m)</SectionTitle>
          <PriceRow label="Edge Banding"        value={prices.edge_banding_m} onChange={v => updatePrice('edge_banding_m', v)} />
          <SectionTitle>Hardware (per pc)</SectionTitle>
          <PriceRow label="Blum Hinge"          value={prices.hinge_pc}       onChange={v => updatePrice('hinge_pc', v)} />
          <PriceRow label="Adjustable Leg"      value={prices.leg_pc}         onChange={v => updatePrice('leg_pc', v)} />
          <PriceRow label="Confirmat"           value={prices.confirmat_pc}   onChange={v => updatePrice('confirmat_pc', v)} />
          <PriceRow label="Dowel"               value={prices.dowel_pc}       onChange={v => updatePrice('dowel_pc', v)} />
          <PriceRow label="Handle"              value={prices.handle_pc}      onChange={v => updatePrice('handle_pc', v)} />
          <PriceRow label="Soft-close (tip-on)" value={prices.soft_close_pc}  onChange={v => updatePrice('soft_close_pc', v)} />
          <SectionTitle>Services (per cabinet)</SectionTitle>
          <PriceRow label="CNC Machining"       value={prices.machining_cab}  onChange={v => updatePrice('machining_cab', v)} />
          <PriceRow label="Labor"               value={prices.labor_cab}      onChange={v => updatePrice('labor_cab', v)} />
        </>}

        <SectionTitle>Margin & Currency</SectionTitle>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#555' }}>Margin</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" value={margin} min={0} max={100} step={1}
              onChange={e => setMargin(parseFloat(e.target.value) || 0)}
              style={{ width: 52, padding: '3px 6px', border: '1.5px solid #E0DAD4', borderRadius: 5,
                fontSize: 11, textAlign: 'right', outline: 'none' }} />
            <span style={{ fontSize: 10, color: '#aaa' }}>%</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#555' }}>1 JD =</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" value={usdRate} min={0.01} step={0.001}
              onChange={e => setUsdRate(parseFloat(e.target.value) || 0.71)}
              style={{ width: 64, padding: '3px 6px', border: '1.5px solid #E0DAD4', borderRadius: 5,
                fontSize: 11, textAlign: 'right', outline: 'none' }} />
            <span style={{ fontSize: 10, color: '#aaa' }}>USD</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
          {['JD', 'USD'].map(c => (
            <button key={c} onClick={() => setCurrency(c)}
              style={{ flex: 1, padding: '6px', border: `1.5px solid ${currency === c ? ACCENT : '#E0DAD4'}`,
                borderRadius: 6, background: currency === c ? ACCENT+'18' : '#fff',
                color: currency === c ? ACCENT : '#666', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              {c}
            </button>
          ))}
        </div>

        <SectionTitle>Customer Info</SectionTitle>
        {[['name', 'Name'], ['phone', 'Phone'], ['address', 'Address']].map(([key, label]) => (
          <div key={key} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{label}</div>
            <input value={customer[key]} onChange={e => setCustomer(c => ({ ...c, [key]: e.target.value }))}
              style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #E0DAD4', borderRadius: 6,
                fontSize: 11, outline: 'none', boxSizing: 'border-box', color: DARK }} />
          </div>
        ))}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>Notes</div>
          <textarea value={customer.notes} onChange={e => setCustomer(c => ({ ...c, notes: e.target.value }))}
            rows={3}
            style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #E0DAD4', borderRadius: 6,
              fontSize: 11, outline: 'none', boxSizing: 'border-box', color: DARK, resize: 'vertical', fontFamily: 'inherit' }} />
        </div>
      </div>

      {/* ── CENTER: Proposal ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, marginBottom: 16,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: DARK }}>{projectName}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                Proposal · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              {countertopMat && (
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  Countertop: <strong style={{ color: DARK }}>{countertopMat.brand} {countertopMat.name}</strong>
                </div>
              )}
            </div>
            {customer.name && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>{customer.name}</div>
                {customer.phone && <div style={{ fontSize: 11, color: '#888' }}>{customer.phone}</div>}
                {customer.address && <div style={{ fontSize: 11, color: '#888' }}>{customer.address}</div>}
              </div>
            )}
          </div>

          {/* Cabinets table */}
          {!cabinets.length ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#bbb' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗄</div>
              <div style={{ fontWeight: 600 }}>No cabinets added yet</div>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0EBE5',
                fontWeight: 700, fontSize: 13, color: DARK, display: 'flex', justifyContent: 'space-between' }}>
                <span>Cabinets ({cabinets.length})</span>
                <span style={{ color: ACCENT }}>{fmtC(cabinetsSubtotal)}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAFAFA' }}>
                    {['#', 'Cabinet', 'Dimensions', 'Material', 'Cost', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left',
                        fontSize: 10, fontWeight: 600, color: '#999' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pricedCabinets.map((cab, i) => (
                    <React.Fragment key={cab.id}>
                      <tr style={{ borderBottom: '1px solid #F7F4F0',
                        background: expandedCab === cab.id ? '#FDFAF6' : '#fff' }}>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: '#bbb', fontWeight: 600 }}>
                          {String(i+1).padStart(2,'0')}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: DARK }}>
                          {cab.label}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: '#666', fontFamily: 'monospace' }}>
                          {cab.width}×{cab.height}×{cab.depth}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 11 }}>{cab.material}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: DARK }}>
                          {fmtC(cab.pricing.total)}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <button onClick={() => setExpandedCab(expandedCab === cab.id ? null : cab.id)}
                            style={{ fontSize: 10, color: ACCENT, background: 'none', border: 'none',
                              cursor: 'pointer', fontWeight: 600 }}>
                            {expandedCab === cab.id ? '▲ Hide' : '▼ Detail'}
                          </button>
                        </td>
                      </tr>
                      {expandedCab === cab.id && (
                        <tr>
                          <td colSpan={6} style={{ padding: '0 12px 12px 32px', background: '#FDFAF6' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                              <thead>
                                <tr>
                                  {['Item', 'Qty', 'Unit Price', 'Cost'].map(h => (
                                    <th key={h} style={{ padding: '4px 8px', textAlign: 'left',
                                      color: '#aaa', fontWeight: 600, borderBottom: '1px solid #F0EBE5' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {cab.pricing.breakdown.map((row, ri) => (
                                  <tr key={ri}>
                                    <td style={{ padding: '3px 8px', color: '#555' }}>{row.label}</td>
                                    <td style={{ padding: '3px 8px', color: '#777', fontFamily: 'monospace' }}>{row.qty}</td>
                                    <td style={{ padding: '3px 8px', color: '#777' }}>{fmt(row.unit)} JD</td>
                                    <td style={{ padding: '3px 8px', fontWeight: 600, color: DARK }}>{fmt(row.cost)} JD</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10 }}>
                              <span>Material: <strong>{fmt(cab.pricing.materialCost)} JD</strong></span>
                              <span>Hardware: <strong>{fmt(cab.pricing.hardwareCost)} JD</strong></span>
                              <span>Machining: <strong>{fmt(cab.pricing.machiningCost)} JD</strong></span>
                              <span>Labor: <strong>{fmt(cab.pricing.laborCost)} JD</strong></span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Extra line items */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 16,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: DARK, marginBottom: 12,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Additional Items</span>
              <span style={{ color: ACCENT }}>{fmtC(extrasSubtotal)}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: '#aaa', flex: 1 }}>Description</span>
              <span style={{ fontSize: 10, color: '#aaa', width: 50 }}>Qty</span>
              <span style={{ fontSize: 10, color: '#aaa', width: 64 }}>Unit (JD)</span>
              <span style={{ width: 56 }} />
            </div>
            {extras.map(item => (
              <ExtraItem key={item.id} item={item}
                onChange={data => updateExtra(item.id, data)}
                onDelete={() => deleteExtra(item.id)} />
            ))}
            <button onClick={addExtra}
              style={{ marginTop: 6, padding: '6px 12px', background: '#F7F4F0',
                border: '1.5px solid #E0DAD4', borderRadius: 6, cursor: 'pointer',
                fontSize: 11, fontWeight: 600, color: '#666' }}>
              + Add item
            </button>
          </div>

          {/* Totals */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 20,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: DARK, marginBottom: 14 }}>Summary</div>
            {[
              ['Cabinets subtotal',  cabinetsSubtotal],
              ['Additional items',   extrasSubtotal],
              ['Cost subtotal',      costSubtotal],
              [`Margin (${margin}%)`, marginAmount],
              ['Subtotal after margin', afterMargin],
              ['VAT (16%)',          vatAmount],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
                padding: '6px 0', borderBottom: '1px solid #F7F4F0', fontSize: 12 }}>
                <span style={{ color: '#666' }}>{label}</span>
                <span style={{ color: DARK, fontWeight: 600 }}>{fmtC(val)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 12, padding: '14px 16px', background: ACCENT+'12',
              borderRadius: 10, border: `2px solid ${ACCENT}33` }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: DARK }}>Grand Total</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>{fmt(grandTotal)} JD</div>
                <div style={{ fontSize: 12, color: '#888' }}>${fmt(grandTotalUSD)} USD</div>
              </div>
            </div>
            {customer.notes && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#F7F4F0',
                borderRadius: 8, fontSize: 11, color: '#666', fontStyle: 'italic' }}>
                Note: {customer.notes}
              </div>
            )}
          </div>

          {/* Export buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => exportPDF({ projectName, customer, pricedCabinets, extras,
              cabinetsSubtotal, extrasSubtotal, costSubtotal, marginAmount, margin,
              afterMargin, vatAmount, grandTotal, grandTotalUSD, countertopMat })}
              style={{ flex: 1, padding: '12px', background: DARK, color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              📄 Export PDF
            </button>
            <button onClick={() => exportExcel({ projectName, customer, pricedCabinets, extras,
              cabinetsSubtotal, extrasSubtotal, costSubtotal, marginAmount, margin,
              afterMargin, vatAmount, grandTotal, grandTotalUSD })}
              style={{ flex: 1, padding: '12px', background: '#2AC87A', color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              📊 Export Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── PDF Export ────────────────────────────────────────────────────────────
function exportPDF(data) {
  const { projectName, customer, pricedCabinets, extras,
    cabinetsSubtotal, extrasSubtotal, margin, marginAmount,
    afterMargin, vatAmount, grandTotal, grandTotalUSD, countertopMat } = data

  const fmt = n => Number(n).toFixed(2)
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const cabRows = pricedCabinets.map((c, i) => `
    <tr>
      <td>${String(i+1).padStart(2,'0')}</td>
      <td>${c.label}</td>
      <td style="font-family:monospace">${c.width}×${c.height}×${c.depth}mm</td>
      <td>${c.material}</td>
      <td>${c.doorStyle}</td>
      <td style="text-align:right;font-weight:700">${fmt(c.pricing.total)} JD</td>
    </tr>`).join('')

  const extraRows = extras.map(e => `
    <tr>
      <td colspan="4">${e.label}</td>
      <td style="text-align:right">${e.qty} × ${fmt(e.unitPrice)} JD</td>
      <td style="text-align:right;font-weight:700">${fmt(e.qty * e.unitPrice)} JD</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Proposal - ${projectName}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box }
    body { font-family: 'Inter', Arial, sans-serif; font-size: 12px; color: #1A1A1A; padding: 32px }
    h1 { font-size: 24px; font-weight: 800; margin-bottom: 4px }
    .sub { color: #888; font-size: 12px; margin-bottom: 24px }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px }
    th { background: #F7F4F0; padding: 8px 10px; text-align: left; font-size: 10px; color: #888; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em }
    td { padding: 8px 10px; border-bottom: 1px solid #F0EBE5; font-size: 12px }
    .section { font-size: 11px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.08em; margin: 20px 0 8px; padding-bottom: 6px; border-bottom: 2px solid #F0EBE5 }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #F0EBE5 }
    .grand { background: #FDF6EC; border-radius: 10px; padding: 16px 20px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center; border: 2px solid #C8902A33 }
    .grand-label { font-size: 16px; font-weight: 800 }
    .grand-amount { font-size: 26px; font-weight: 800; color: #C8902A }
    .grand-usd { font-size: 12px; color: #888; margin-top: 2px }
    .customer { float: right; text-align: right; font-size: 12px; line-height: 1.6 }
    .logo { color: #C8902A; font-weight: 800; font-size: 18px; margin-bottom: 2px }
    @media print { body { padding: 16px } }
  </style></head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
    <div>
      <div class="logo">WoodCalc</div>
      <h1>${projectName}</h1>
      <div class="sub">Proposal · ${date}${countertopMat ? ` · Countertop: ${countertopMat.brand} ${countertopMat.name}` : ''}</div>
    </div>
    ${customer.name ? `<div class="customer"><strong>${customer.name}</strong><br>${customer.phone || ''}<br>${customer.address || ''}</div>` : ''}
  </div>

  <div class="section">Cabinets</div>
  <table>
    <thead><tr><th>#</th><th>Cabinet</th><th>Dimensions</th><th>Material</th><th>Door Style</th><th style="text-align:right">Price</th></tr></thead>
    <tbody>${cabRows}</tbody>
  </table>

  <div class="section">Additional Items</div>
  <table>
    <thead><tr><th colspan="4">Description</th><th>Qty × Unit</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${extraRows}</tbody>
  </table>

  <div class="section">Summary</div>
  <div style="max-width:360px;margin-left:auto">
    <div class="total-row"><span>Cabinets subtotal</span><span>${fmt(cabinetsSubtotal)} JD</span></div>
    <div class="total-row"><span>Additional items</span><span>${fmt(extrasSubtotal)} JD</span></div>
    <div class="total-row"><span>Cost subtotal</span><span>${fmt(cabinetsSubtotal + extrasSubtotal)} JD</span></div>
    <div class="total-row"><span>Margin (${margin}%)</span><span>${fmt(marginAmount)} JD</span></div>
    <div class="total-row"><span>Subtotal after margin</span><span>${fmt(afterMargin)} JD</span></div>
    <div class="total-row"><span>VAT (16%)</span><span>${fmt(vatAmount)} JD</span></div>
    <div class="grand">
      <div class="grand-label">Grand Total</div>
      <div style="text-align:right">
        <div class="grand-amount">${fmt(grandTotal)} JD</div>
        <div class="grand-usd">$${fmt(grandTotalUSD)} USD</div>
      </div>
    </div>
    ${customer.notes ? `<div style="margin-top:12px;padding:10px;background:#F7F4F0;border-radius:6px;font-style:italic;color:#666">Note: ${customer.notes}</div>` : ''}
  </div>

  <script>window.onload = () => window.print()</script>
  </body></html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
}

// ─── Excel Export ──────────────────────────────────────────────────────────
function exportExcel(data) {
  const { projectName, customer, pricedCabinets, extras,
    cabinetsSubtotal, extrasSubtotal, margin, marginAmount,
    afterMargin, vatAmount, grandTotal, grandTotalUSD } = data

  const fmt = n => Number(n).toFixed(2)
  const rows = []

  rows.push(['WoodCalc — Proposal'])
  rows.push(['Project:', projectName])
  rows.push(['Date:', new Date().toLocaleDateString('en-GB')])
  if (customer.name)    rows.push(['Customer:', customer.name])
  if (customer.phone)   rows.push(['Phone:',    customer.phone])
  if (customer.address) rows.push(['Address:',  customer.address])
  rows.push([])
  rows.push(['#', 'Cabinet', 'Width', 'Height', 'Depth', 'Material', 'Door Style', 'Material Cost (JD)', 'Hardware Cost (JD)', 'Machining (JD)', 'Labor (JD)', 'Total (JD)'])

  pricedCabinets.forEach((c, i) => {
    rows.push([
      i + 1, c.label, c.width, c.height, c.depth, c.material, c.doorStyle,
      fmt(c.pricing.materialCost), fmt(c.pricing.hardwareCost),
      fmt(c.pricing.machiningCost), fmt(c.pricing.laborCost), fmt(c.pricing.total)
    ])
  })

  rows.push([])
  rows.push(['Additional Items'])
  rows.push(['Description', 'Qty', 'Unit Price (JD)', 'Total (JD)'])
  extras.forEach(e => rows.push([e.label, e.qty, fmt(e.unitPrice), fmt(e.qty * e.unitPrice)]))

  rows.push([])
  rows.push(['Summary'])
  rows.push(['Cabinets subtotal (JD)',   fmt(cabinetsSubtotal)])
  rows.push(['Additional items (JD)',    fmt(extrasSubtotal)])
  rows.push([`Margin (${margin}%) (JD)`, fmt(marginAmount)])
  rows.push(['Subtotal after margin (JD)', fmt(afterMargin)])
  rows.push(['VAT 16% (JD)',             fmt(vatAmount)])
  rows.push(['Grand Total (JD)',         fmt(grandTotal)])
  rows.push(['Grand Total (USD)',        fmt(grandTotalUSD)])
  if (customer.notes) rows.push(['Notes:', customer.notes])

  const csv = rows.map(r => r.map(cell => {
    const s = String(cell ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }).join(',')).join('\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${projectName.replace(/\s+/g, '_')}_Proposal.csv`
  a.click()
  URL.revokeObjectURL(url)
}
