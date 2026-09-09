import React, { useState, useRef, useEffect } from 'react'
import { COUNTERTOP_MATERIALS } from './CabinetCatalog'
import { useTranslation } from '../../i18n/LanguageContext'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'

const DEFAULT_COMPANY = {
  name: '',
  address: '',
  phone: '',
  email: '',
  taxNumber: '',
}

function SignaturePad({ onSave }) {
  const { t } = useTranslation()
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const lastPos = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches?.[0]
    return {
      x: (touch ? touch.clientX : e.clientX) - rect.left,
      y: (touch ? touch.clientY : e.clientY) - rect.top,
    }
  }

  const startDraw = (e) => {
    drawing.current = true
    lastPos.current = getPos(e, canvasRef.current)
  }

  const draw = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
  }

  const stopDraw = () => {
    drawing.current = false
    lastPos.current = null
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const save = () => {
    const canvas = canvasRef.current
    onSave(canvas.toDataURL())
  }

  return (
    <div>
      <div style={{ border: '1.5px solid #E0DAD4', borderRadius: 8, overflow: 'hidden', background: '#fff', marginBottom: 8 }}>
        <canvas
          ref={canvasRef}
          width={400}
          height={160}
          style={{ display: 'block', width: '100%', cursor: 'crosshair', touchAction: 'none' }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={clear}
          style={{ flex: 1, padding: '7px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#666' }}>
          {t('contractTab.clear')}
        </button>
        <button onClick={save}
          style={{ flex: 2, padding: '7px', background: ACCENT, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#fff' }}>
          {t('contractTab.saveSignature')}
        </button>
      </div>
    </div>
  )
}

function PaymentRow({ item, onChange, onDelete }) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
      <input value={item.label} onChange={e => onChange({ ...item, label: e.target.value })}
        placeholder={t('contractTab.milestonePlaceholder')}
        style={{ flex: 1, padding: '5px 7px', border: '1.5px solid #E0DAD4', borderRadius: 5, fontSize: 11, outline: 'none', color: DARK }} />
      <input type="number" value={item.pct} min={0} max={100} step={1}
        onChange={e => onChange({ ...item, pct: +e.target.value })}
        style={{ width: 52, padding: '5px 6px', border: '1.5px solid #E0DAD4', borderRadius: 5, fontSize: 11, textAlign: 'right', outline: 'none', color: DARK }} />
      <span style={{ fontSize: 10, color: '#aaa' }}>%</span>
      <input type="date" value={item.dueDate}
        onChange={e => onChange({ ...item, dueDate: e.target.value })}
        style={{ width: 110, padding: '5px 6px', border: '1.5px solid #E0DAD4', borderRadius: 5, fontSize: 11, outline: 'none', color: DARK }} />
      <button onClick={onDelete}
        style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#E74C3C', borderRadius: 5, cursor: 'pointer', padding: '3px 7px', fontSize: 12, fontWeight: 700 }}>×</button>
    </div>
  )
}

export default function ContractTab({ cabinets, projectName, countertopId, grandTotal, customer: propCustomer }) {
  const { t, language } = useTranslation()
  const dir = language === 'ar' ? 'rtl' : 'ltr'
  const locale = language === 'ar' ? 'ar' : 'en-GB'
  const [company, setCompany] = useState(DEFAULT_COMPANY)
  const [customer, setCustomer] = useState(propCustomer || { name: '', phone: '', address: '', notes: '' })
  const [deliveryDate, setDeliveryDate] = useState('')
  const [payments, setPayments] = useState([
    { id: 1, label: t('contractTab.depositLabel'),      pct: 40, dueDate: '' },
    { id: 2, label: t('contractTab.onDeliveryLabel'),  pct: 40, dueDate: '' },
    { id: 3, label: t('contractTab.onCompletionLabel'),pct: 20, dueDate: '' },
  ])
  const [terms, setTerms] = useState(t('contractTab.defaultTerms'))
  const [signature, setSignature] = useState(null)
  const [signedDate, setSignedDate] = useState('')
  const [showTermsEdit, setShowTermsEdit] = useState(false)
  const [contractNo, setContractNo] = useState('WC-' + Date.now().toString().slice(-6))

  const totalPct = payments.reduce((s, p) => s + p.pct, 0)
  const fmt = n => Number(n || 0).toFixed(2)
  const countertopMat = COUNTERTOP_MATERIALS.find(m => m.id === countertopId)

  const updatePayment = (id, data) => setPayments(p => p.map(x => x.id === id ? data : x))
  const deletePayment = (id) => setPayments(p => p.filter(x => x.id !== id))
  const addPayment = () => setPayments(p => [...p, { id: Date.now(), label: '', pct: 0, dueDate: '' }])

  const exportPDF = () => {
    const sigHtml = signature
      ? `<img src="${signature}" style="width:200px;height:80px;border:1px solid #ddd;border-radius:4px" />`
      : `<div style="width:200px;height:80px;border:1px solid #ddd;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:11px">${t('contractTab.notSigned')}</div>`

    const payRows = payments.map(p => `
      <tr>
        <td>${p.label}</td>
        <td style="text-align:end">${p.pct}%</td>
        <td style="text-align:end">${fmt((grandTotal || 0) * p.pct / 100)} JD</td>
        <td style="text-align:end">${p.dueDate || '—'}</td>
      </tr>`).join('')

    const cabRows = cabinets.map((c, i) => `
      <tr>
        <td>${String(i+1).padStart(2,'0')}</td>
        <td>${c.label}</td>
        <td>${c.width}×${c.height}×${c.depth}mm</td>
        <td>${c.material}</td>
        <td>${c.doorStyle}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html><html dir="${dir}"><head><meta charset="UTF-8">
    <title>${t('contractTab.supplyInstallContract')} - ${projectName}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box }
      body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 32px }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 16px; border-bottom: 3px solid #C8902A }
      .logo { font-size: 22px; font-weight: 800; color: #C8902A }
      .contract-no { font-size: 11px; color: #888; margin-top: 4px }
      h2 { font-size: 18px; font-weight: 800; margin-bottom: 16px; color: #1a1a1a }
      .section { margin-bottom: 20px }
      .section-title { font-size: 10px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #F0EBE5 }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px }
      .info-block { background: #F7F4F0; padding: 12px; border-radius: 6px }
      .info-label { font-size: 10px; color: #888; margin-bottom: 2px }
      .info-value { font-size: 12px; font-weight: 600; color: #1a1a1a }
      table { width: 100%; border-collapse: collapse; margin-bottom: 4px }
      th { background: #F7F4F0; padding: 7px 10px; text-align: start; font-size: 10px; color: #888; font-weight: 700; text-transform: uppercase }
      td { padding: 7px 10px; border-bottom: 1px solid #F0EBE5; font-size: 11px }
      .total-box { background: #FDF6EC; border: 2px solid #C8902A33; border-radius: 8px; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; margin: 12px 0 }
      .total-label { font-size: 14px; font-weight: 800 }
      .total-amount { font-size: 22px; font-weight: 800; color: #C8902A }
      .pct-warning { font-size: 10px; color: #e74c3c; margin-top: 4px }
      .terms { white-space: pre-wrap; font-size: 10px; line-height: 1.6; color: #444; background: #FAFAFA; padding: 12px; border-radius: 6px; border: 1px solid #F0EBE5 }
      .sig-section { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 24px }
      .sig-box { text-align: center }
      .sig-label { font-size: 10px; color: #888; margin-bottom: 8px }
      .sig-line { border-top: 1px solid #333; margin-top: 80px; padding-top: 4px; font-size: 10px; color: #555 }
      @media print { body { padding: 16px } }
    </style></head><body>

    <div class="header">
      <div>
        <div class="logo">${company.name || 'WoodCalc'}</div>
        ${company.address ? `<div style="font-size:11px;color:#555;margin-top:2px">${company.address}</div>` : ''}
        ${company.phone ? `<div style="font-size:11px;color:#555">${company.phone}</div>` : ''}
        ${company.email ? `<div style="font-size:11px;color:#555">${company.email}</div>` : ''}
        ${company.taxNumber ? `<div style="font-size:11px;color:#555">${t('contractTab.taxNumber')}: ${company.taxNumber}</div>` : ''}
      </div>
      <div style="text-align:end">
        <div style="font-size:18px;font-weight:800">${t('contractTab.supplyInstallContract')}</div>
        <div class="contract-no">${t('contractTab.contractNo')} ${contractNo}</div>
        <div class="contract-no">${t('contractTab.date')} ${new Date().toLocaleDateString(locale, { day:'numeric', month:'long', year:'numeric' })}</div>
        ${deliveryDate ? `<div class="contract-no">${t('contractTab.deliveryLabel')} ${new Date(deliveryDate).toLocaleDateString(locale, { day:'numeric', month:'long', year:'numeric' })}</div>` : ''}
      </div>
    </div>

    <div class="grid2" style="margin-bottom:20px">
      <div class="info-block">
        <div class="section-title">${t('contractTab.contractor')}</div>
        <div class="info-value">${company.name || '—'}</div>
        <div style="font-size:11px;color:#555;margin-top:4px">${company.address || ''}</div>
      </div>
      <div class="info-block">
        <div class="section-title">${t('contractTab.client')}</div>
        <div class="info-value">${customer.name || '—'}</div>
        <div style="font-size:11px;color:#555;margin-top:4px">${customer.phone || ''}</div>
        <div style="font-size:11px;color:#555">${customer.address || ''}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">${t('contractTab.projectLabel')} ${projectName}</div>
      <table>
        <thead><tr><th>${t('contractTab.colNum')}</th><th>${t('contractTab.colCabinet')}</th><th>${t('contractTab.colDimensions')}</th><th>${t('contractTab.colMaterial')}</th><th>${t('contractTab.colDoorStyle')}</th></tr></thead>
        <tbody>${cabRows}</tbody>
      </table>
      ${countertopMat ? `<div style="font-size:11px;color:#555;margin-top:6px">${t('proposalTab.countertop')} <strong>${countertopMat.brand} ${countertopMat.name}</strong></div>` : ''}
    </div>

    <div class="total-box">
      <div class="total-label">${t('contractTab.totalContractValue')}</div>
      <div class="total-amount">${fmt(grandTotal)} JD</div>
    </div>

    <div class="section">
      <div class="section-title">${t('contractTab.paymentSchedule')}</div>
      <table>
        <thead><tr><th>${t('contractTab.milestone')}</th><th style="text-align:end">${t('contractTab.colPct')}</th><th style="text-align:end">${t('contractTab.colAmountJd')}</th><th style="text-align:end">${t('contractTab.colDueDate')}</th></tr></thead>
        <tbody>${payRows}</tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">${t('contractTab.termsConditions')}</div>
      <div class="terms">${terms}</div>
    </div>

    <div class="sig-section">
      <div class="sig-box">
        <div class="sig-label">${t('contractTab.contractorSignature')}</div>
        ${sigHtml}
        <div class="sig-line">${company.name || t('contractTab.contractor')} · ${signedDate || '____/____/________'}</div>
      </div>
      <div class="sig-box">
        <div class="sig-label">${t('contractTab.clientSignature')}</div>
        <div style="width:200px;height:80px;border:1px solid #ddd;border-radius:4px;margin:0 auto"></div>
        <div class="sig-line">${customer.name || t('contractTab.client')} · ____/____/________</div>
      </div>
    </div>

    <script>window.onload = () => window.print()</script>
    </body></html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
  }

  return (
    <div dir={dir} style={{ flex: 1, display: 'flex', overflow: 'hidden', background: '#F7F4F0' }}>

      {/* LEFT: Company + Payment + Signature */}
      <div style={{ width: 280, background: '#fff', borderInlineEnd: '1px solid #E0DAD4', overflowY: 'auto', flexShrink: 0, padding: 16 }}>

        <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 4 }}>{t('contractTab.contractSettings')}</div>
        <div style={{ fontSize: 11, color: '#999', marginBottom: 14 }}>{t('contractTab.contractNo')} <strong style={{ color: DARK }}>{contractNo}</strong></div>

        {/* Company Info */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{t('contractTab.yourCompany')}</div>
        {[['name',t('contractTab.companyName')],['address',t('contractTab.address')],['phone',t('contractTab.phone')],['email',t('contractTab.email')],['taxNumber',t('contractTab.taxNumber')]].map(([key, label]) => (
          <div key={key} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{label}</div>
            <input value={company[key]} onChange={e => setCompany(c => ({ ...c, [key]: e.target.value }))}
              style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 11, outline: 'none', boxSizing: 'border-box', color: DARK }} />
          </div>
        ))}

        {/* Customer Info */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginTop: 14 }}>{t('contractTab.client')}</div>
        {[['name',t('contractTab.name')],['phone',t('contractTab.phone')],['address',t('contractTab.address')]].map(([key, label]) => (
          <div key={key} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{label}</div>
            <input value={customer[key] || ''} onChange={e => setCustomer(c => ({ ...c, [key]: e.target.value }))}
              style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 11, outline: 'none', boxSizing: 'border-box', color: DARK }} />
          </div>
        ))}

        {/* Delivery Date */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginTop: 14 }}>{t('contractTab.delivery')}</div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{t('contractTab.expectedDeliveryDate')}</div>
          <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 11, outline: 'none', boxSizing: 'border-box', color: DARK }} />
        </div>

        {/* Payment Schedule */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginTop: 14 }}>{t('contractTab.paymentSchedule')}</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 9, color: '#aaa', flex: 1 }}>{t('contractTab.milestone')}</span>
          <span style={{ fontSize: 9, color: '#aaa', width: 52 }}>%</span>
          <span style={{ fontSize: 9, color: '#aaa', width: 110 }}>{t('contractTab.dueDate')}</span>
          <span style={{ width: 28 }} />
        </div>
        {payments.map(p => (
          <PaymentRow key={p.id} item={p} onChange={data => updatePayment(p.id, data)} onDelete={() => deletePayment(p.id)} />
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 8 }}>
          <button onClick={addPayment}
            style={{ padding: '5px 10px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#666' }}>
            {t('contractTab.addMilestone')}
          </button>
          <span style={{ fontSize: 11, fontWeight: 700, color: totalPct === 100 ? '#2AC87A' : '#E74C3C' }}>
            {totalPct}% {totalPct === 100 ? '✓' : t('contractTab.remaining', { pct: 100 - totalPct })}
          </span>
        </div>

        {/* Signature */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginTop: 14 }}>{t('contractTab.yourSignature')}</div>
        <SignaturePad onSave={sig => { setSignature(sig); setSignedDate(new Date().toLocaleDateString(locale)) }} />
        {signature && (
          <div style={{ marginTop: 8, padding: '6px 10px', background: '#F0FFF4', borderRadius: 6, fontSize: 11, color: '#2AC87A', fontWeight: 600 }}>
            {t('contractTab.signedOn', { date: signedDate })}
          </div>
        )}
      </div>

      {/* CENTER: Contract Preview */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>{company.name || t('contractTab.yourCompanyName')}</div>
                {company.address && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{company.address}</div>}
                {company.phone && <div style={{ fontSize: 11, color: '#888' }}>{company.phone}</div>}
                {company.email && <div style={{ fontSize: 11, color: '#888' }}>{company.email}</div>}
              </div>
              <div style={{ textAlign: 'end' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: DARK }}>{t('contractTab.supplyInstallContract')}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{t('contractTab.contractNo')} {contractNo}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{t('contractTab.date')} {new Date().toLocaleDateString(locale, { day:'numeric', month:'long', year:'numeric' })}</div>
                {deliveryDate && <div style={{ fontSize: 11, color: '#888' }}>{t('contractTab.deliveryLabel')} {new Date(deliveryDate).toLocaleDateString(locale, { day:'numeric', month:'long', year:'numeric' })}</div>}
              </div>
            </div>
          </div>

          {/* Parties */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[[t('contractTab.contractor'), company.name, company.address, company.phone],
              [t('contractTab.client'), customer.name, customer.address, customer.phone]].map(([role, name, addr, phone]) => (
              <div key={role} style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{role}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>{name || '—'}</div>
                {addr && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{addr}</div>}
                {phone && <div style={{ fontSize: 11, color: '#888' }}>{phone}</div>}
              </div>
            ))}
          </div>

          {/* Cabinet list */}
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0EBE5', fontWeight: 700, fontSize: 13, color: DARK }}>
              {cabinets.length === 1
                ? t('contractTab.projectCabinets', { name: projectName })
                : t('contractTab.projectCabinetsPlural', { name: projectName, count: cabinets.length })}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  {[t('contractTab.colNum'),t('contractTab.colCabinet'),t('contractTab.colDimensions'),t('contractTab.colMaterial'),t('contractTab.colDoorStyle')].map((h, hi) => (
                    <th key={hi} style={{ padding: '8px 12px', textAlign: 'start', fontSize: 10, fontWeight: 600, color: '#999' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cabinets.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #F7F4F0' }}>
                    <td style={{ padding: '8px 12px', fontSize: 11, color: '#bbb', fontWeight: 600 }}>{String(i+1).padStart(2,'0')}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: DARK }}>{c.label}</td>
                    <td style={{ padding: '8px 12px', fontSize: 11, color: '#666', fontFamily: 'monospace' }}>{c.width}×{c.height}×{c.depth}mm</td>
                    <td style={{ padding: '8px 12px', fontSize: 11 }}>{c.material}</td>
                    <td style={{ padding: '8px 12px', fontSize: 11 }}>{c.doorStyle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: ACCENT+'12', borderRadius: 10, border: `2px solid ${ACCENT}33`, marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: DARK }}>{t('contractTab.totalContractValue')}</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>{fmt(grandTotal)} JD</span>
          </div>

          {/* Payment Schedule */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: DARK, marginBottom: 12 }}>{t('contractTab.paymentSchedule')}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  {[[t('contractTab.milestone'), true], [t('contractTab.colPct'), false], [t('contractTab.colAmountJd'), false], [t('contractTab.colDueDate'), false]].map(([h, isStart], hi) => (
                    <th key={hi} style={{ padding: '8px 12px', textAlign: isStart ? 'start' : 'end', fontSize: 10, fontWeight: 600, color: '#999' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F7F4F0' }}>
                    <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: DARK }}>{p.label || '—'}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, textAlign: 'end' }}>{p.pct}%</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, textAlign: 'end', color: DARK }}>{fmt((grandTotal || 0) * p.pct / 100)} JD</td>
                    <td style={{ padding: '8px 12px', fontSize: 11, textAlign: 'end', color: '#888' }}>{p.dueDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPct !== 100 && (
              <div style={{ marginTop: 8, fontSize: 11, color: '#E74C3C', fontWeight: 600 }}>
                {t('contractTab.scheduleWarning', { pct: totalPct })}
              </div>
            )}
          </div>

          {/* Terms */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: DARK }}>{t('contractTab.termsConditions')}</div>
              <button onClick={() => setShowTermsEdit(e => !e)}
                style={{ padding: '4px 10px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#666' }}>
                {showTermsEdit ? t('contractTab.done') : t('contractTab.editTerms')}
              </button>
            </div>
            {showTermsEdit ? (
              <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={16}
                style={{ width: '100%', padding: '10px', border: '1.5px solid #E0DAD4', borderRadius: 8, fontSize: 11, outline: 'none', boxSizing: 'border-box', color: DARK, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
            ) : (
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 11, lineHeight: 1.7, color: '#555', background: '#FAFAFA', padding: 12, borderRadius: 8 }}>
                {terms}
              </div>
            )}
          </div>

          {/* Signatures */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{t('contractTab.contractorSignature')}</div>
              {signature
                ? <img src={signature} style={{ width: '100%', maxWidth: 200, height: 80, objectFit: 'contain', border: '1px solid #ddd', borderRadius: 6 }} alt="signature" />
                : <div style={{ height: 80, border: '1.5px dashed #E0DAD4', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 11 }}>{t('contractTab.signInLeftPanel')}</div>
              }
              <div style={{ marginTop: 8, borderTop: '1px solid #333', paddingTop: 6, fontSize: 11, color: '#555' }}>
                {company.name || t('contractTab.contractor')} · {signedDate || '____/____/____'}
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{t('contractTab.clientSignature')}</div>
              <div style={{ height: 80, border: '1.5px dashed #E0DAD4', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 11 }}>{t('contractTab.clientSignsOnPrinted')}</div>
              <div style={{ marginTop: 8, borderTop: '1px solid #333', paddingTop: 6, fontSize: 11, color: '#555' }}>
                {customer.name || t('contractTab.client')} · ____/____/____
              </div>
            </div>
          </div>

          {/* Export */}
          <button onClick={exportPDF}
            style={{ width: '100%', padding: '13px', background: DARK, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, marginBottom: 24 }}>
            {t('contractTab.exportContractPdf')}
          </button>
        </div>
      </div>
    </div>
  )
}
