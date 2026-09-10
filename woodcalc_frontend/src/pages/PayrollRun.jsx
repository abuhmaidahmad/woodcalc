import React, { useState, useEffect } from 'react'
import Logo from '../components/Logo'
import { useNavigate } from 'react-router-dom'
import { hasPermission, getCompany } from '../api/auth'
import { listPayroll, updatePayroll, generatePayroll, listEmployees } from '../api/hr'
import { exportPayslipPDF } from '../utils/payslipPdf'
import { useTranslation } from '../i18n/LanguageContext'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'

function currentPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function PayrollRun() {
  const { t, language } = useTranslation()
  const dir = language === 'ar' ? 'rtl' : 'ltr'
  const locale = language === 'ar' ? 'ar' : 'en-GB'
  const navigate = useNavigate()

  const [period, setPeriod] = useState(currentPeriod())
  const [rows, setRows] = useState([])
  const [employees, setEmployees] = useState({})
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [summary, setSummary] = useState(null)

  const canView = hasPermission('hr.view_salary')
  const canEdit = hasPermission('hr.edit_salary')

  const fetchEmployees = async () => {
    try {
      const data = await listEmployees()
      const list = Array.isArray(data) ? data : (data.results || [])
      setEmployees(Object.fromEntries(list.map(e => [e.id, e])))
    } catch {}
  }

  const fetchPayroll = async (p) => {
    setLoading(true)
    try {
      const data = await listPayroll({ period: p })
      setRows(Array.isArray(data) ? data : (data.results || []))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { if (canView) { fetchEmployees(); fetchPayroll(period) } }, [])

  const doGenerate = async () => {
    if (!period.trim()) return
    setGenerating(true)
    setSummary(null)
    try {
      const res = await generatePayroll(period)
      if (res.results) {
        setSummary({ created: res.created, skipped: res.skipped })
        fetchPayroll(period)
      }
    } catch {}
    setGenerating(false)
  }

  const updateRow = (id, field, value) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const saveRow = async (row) => {
    await updatePayroll(row.id, { bonuses: row.bonuses, deductions: row.deductions, notes: row.notes })
    fetchPayroll(period)
  }

  const togglePaid = async (row) => {
    await updatePayroll(row.id, { paid: !row.paid })
    fetchPayroll(period)
  }

  if (!canView) {
    return (
      <div dir={dir} style={{ minHeight: '100vh', background: '#F7F4F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", color: '#888' }}>
        {t('hrPayroll.noAccess')}
      </div>
    )
  }

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Logo forDarkBg onClick={() => navigate('/dashboard')} height={22} />
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{t('hrPayroll.title')}</span>
        </div>
        <button onClick={() => navigate('/hr/employees')}
          style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          {t('hrEmployeeDetail.back')}
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <h1 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 800, color: DARK }}>{t('hrPayroll.title')}</h1>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 600 }}>{t('hrPayroll.periodLabel')}</div>
            <input value={period} onChange={e => setPeriod(e.target.value)} onBlur={() => fetchPayroll(period)}
              placeholder={t('hrPayroll.periodPlaceholder')}
              style={{ padding: '9px 12px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 13, outline: 'none', width: 140 }} />
          </div>
          {canEdit && (
            <button onClick={doGenerate} disabled={generating}
              style={{ padding: '10px 20px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              {generating ? t('hrPayroll.generating') : t('hrPayroll.generate')}
            </button>
          )}
          {summary && (
            <span style={{ fontSize: 12, color: '#888' }}>{t('hrPayroll.generatedSummary', { created: summary.created, skipped: summary.skipped })}</span>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>{t('hr.loading')}</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb', background: '#fff', borderRadius: 12 }}>
            {t('hrPayroll.noPayrollForPeriod')}
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  {[t('hrPayroll.colEmployee'), t('hrPayroll.colBase'), t('hrPayroll.colBonuses'), t('hrPayroll.colDeductions'), t('hrPayroll.colNet'), t('hrPayroll.colPaid'), ''].map((h, hi) => (
                    <th key={hi} style={{ padding: '8px 12px', textAlign: 'start', fontSize: 10, fontWeight: 600, color: '#888' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const emp = employees[row.employee]
                  const liveNet = Number(row.base_salary || 0) + Number(row.bonuses || 0) - Number(row.deductions || 0)
                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid #F7F4F0' }}>
                      <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: DARK }}>{emp ? `${emp.first_name} ${emp.last_name}` : row.employee}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12 }}>{row.base_salary} JD</td>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="number" value={row.bonuses} disabled={!canEdit}
                          onChange={e => updateRow(row.id, 'bonuses', e.target.value)}
                          onBlur={() => canEdit && saveRow(row)}
                          style={{ width: 80, padding: '5px 6px', border: '1.5px solid #E0DAD4', borderRadius: 5, fontSize: 12 }} />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="number" value={row.deductions} disabled={!canEdit}
                          onChange={e => updateRow(row.id, 'deductions', e.target.value)}
                          onBlur={() => canEdit && saveRow(row)}
                          style={{ width: 80, padding: '5px 6px', border: '1.5px solid #E0DAD4', borderRadius: 5, fontSize: 12 }} />
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: ACCENT }}>{liveNet.toFixed(2)} JD</td>
                      <td style={{ padding: '8px 12px' }}>
                        <button onClick={() => canEdit && togglePaid(row)} disabled={!canEdit}
                          style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, cursor: canEdit ? 'pointer' : 'default',
                            background: row.paid ? '#2AC87A18' : '#F0F0F0', color: row.paid ? '#2AC87A' : '#999', border: 'none' }}>
                          {row.paid ? t('hrPayroll.paid') : t('hrPayroll.markPaid')}
                        </button>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <button onClick={() => exportPayslipPDF({ employee: emp || { first_name: '', last_name: '' }, payroll: row, companyName: getCompany()?.name, t, dir, locale })}
                          style={{ fontSize: 10, fontWeight: 600, padding: '4px 8px', background: '#F7F4F0', border: '1px solid #E0DAD4', borderRadius: 4, cursor: 'pointer', color: DARK }}>
                          {t('hrPayroll.exportPayslip')}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
