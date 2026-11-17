import React, { useState, useEffect } from 'react'
import Logo from '../components/Logo'
import { useNavigate } from 'react-router-dom'
import { hasPermission } from '../api/auth'
import {
  getPayrollSettings, updatePayrollSettings, formatErrors,
  listAllowanceTypes, createAllowanceType, updateAllowanceType,
} from '../api/hr'
import { useTranslation } from '../i18n/LanguageContext'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'
const CARD = { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }

// Fields the form edits, in the order they're sent. Anything else in the GET body is read-only.
const EDITABLE = [
  'pay_day', 'working_days_per_month', 'hours_per_day', 'overtime_rate_normal', 'overtime_rate_holiday',
  'ssc_employee_pct', 'ssc_employer_pct', 'ssc_ceiling', 'personal_exemptions', 'tax_brackets',
]
const EMPTY_ALLOWANCE = { name_en: '', name_ar: '', kind: 'fixed', default_amount: '', taxable: true, ssc_subject: true }

export default function PayrollSettings() {
  const { t, language } = useTranslation()
  const dir = language === 'ar' ? 'rtl' : 'ltr'
  const navigate = useNavigate()

  const canManage = hasPermission('hr.manage_settings')
  const canView = canManage || hasPermission('hr.view_salary')

  const [saved, setSaved] = useState(null)       // last settings returned by the server
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [allowanceTypes, setAllowanceTypes] = useState([])
  const [newType, setNewType] = useState(EMPTY_ALLOWANCE)
  const [typeError, setTypeError] = useState('')

  const fieldLabel = k => (t(`hrSettings.field.${k}`) !== `hrSettings.field.${k}` ? t(`hrSettings.field.${k}`) : k)

  const load = async () => {
    const { ok, data } = await getPayrollSettings()
    if (ok) { setSaved(data); setForm(data) }
  }
  const loadTypes = async () => setAllowanceTypes(await listAllowanceTypes())

  useEffect(() => { if (canView) { load(); loadTypes() } }, [])

  const save = async (extra = {}) => {
    setSaving(true)
    setError('')
    setNotice('')
    const body = { ...Object.fromEntries(EDITABLE.map(k => [k, form[k]])), ...extra }
    const { ok, data } = await updatePayrollSettings(body)
    if (ok) {
      setSaved(data)
      setForm(data)
      setNotice(saved?.rates_verified && !data.rates_verified ? t('hrSettings.verificationCleared') : t('hrSettings.saved'))
    } else {
      setError(formatErrors(data, fieldLabel))
    }
    setSaving(false)
  }

  const markVerified = () => {
    if (!window.confirm(t('hrSettings.verifyConfirm'))) return
    save({ rates_verified: true })
  }

  const setBracket = (i, key, value) => setForm(f => ({
    ...f, tax_brackets: f.tax_brackets.map((b, bi) => (bi === i ? { ...b, [key]: value } : b)),
  }))
  const addBracket = () => setForm(f => {
    // Insert before the open-ended top bracket.
    const rows = [...f.tax_brackets]
    rows.splice(Math.max(rows.length - 1, 0), 0, { up_to: '', rate: '' })
    return { ...f, tax_brackets: rows }
  })
  const removeBracket = i => setForm(f => ({ ...f, tax_brackets: f.tax_brackets.filter((_, bi) => bi !== i) }))

  const addType = async () => {
    if (!newType.name_en.trim()) return
    setTypeError('')
    const { ok, data } = await createAllowanceType({ ...newType, default_amount: newType.default_amount || '0' })
    if (!ok) { setTypeError(formatErrors(data)); return }
    setNewType(EMPTY_ALLOWANCE)
    loadTypes()
  }
  const patchType = async (row, changes) => {
    setTypeError('')
    const { ok, data } = await updateAllowanceType(row.id, changes)
    if (!ok) { setTypeError(formatErrors(data)); return }
    loadTypes()
  }
  const editTypeAmount = row => {
    const value = window.prompt(t('hrSettings.defaultAmountPrompt'), row.default_amount)
    if (value !== null && value.trim() !== '') patchType(row, { default_amount: value.trim() })
  }

  if (!canView) {
    return (
      <div dir={dir} style={{ minHeight: '100vh', background: '#F7F4F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", color: '#888' }}>
        {t('hrSettings.noAccess')}
      </div>
    )
  }

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      <div className="app-topbar" style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Logo forDarkBg onClick={() => navigate('/dashboard')} height={22} />
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{t('hrSettings.title')}</span>
        </div>
        <button onClick={() => navigate('/hr/employees')}
          style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          {t('hr.title')}
        </button>
      </div>

      <div className="app-content" style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
        {!form ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#bbb' }}>{t('hr.loading')}</div>
        ) : (
          <>
            <VerificationBanner saved={saved} t={t} canManage={canManage} onVerify={markVerified} saving={saving} />

            <div style={CARD}>
              <SectionTitle>{t('hrSettings.sectionGeneral')}</SectionTitle>
              <Grid>
                <ReadOnly label={t('hrSettings.field.country')} value={t('hrSettings.jordanJod')} />
                <Num label={fieldLabel('pay_day')} k="pay_day" form={form} setForm={setForm} disabled={!canManage} />
                <Num label={fieldLabel('working_days_per_month')} k="working_days_per_month" form={form} setForm={setForm} disabled={!canManage}
                  hint={t('hrSettings.hint.working_days_per_month')} />
                <Num label={fieldLabel('hours_per_day')} k="hours_per_day" form={form} setForm={setForm} disabled={!canManage}
                  hint={t('hrSettings.hint.hours_per_day')} />
              </Grid>
            </div>

            <div style={CARD}>
              <SectionTitle>{t('hrSettings.sectionOvertime')}</SectionTitle>
              <Grid>
                <Num label={fieldLabel('overtime_rate_normal')} k="overtime_rate_normal" form={form} setForm={setForm} disabled={!canManage}
                  hint={t('hrSettings.hint.multiplier')} />
                <Num label={fieldLabel('overtime_rate_holiday')} k="overtime_rate_holiday" form={form} setForm={setForm} disabled={!canManage}
                  hint={t('hrSettings.hint.multiplier')} />
              </Grid>
            </div>

            <div style={CARD}>
              <SectionTitle>{t('hrSettings.sectionSsc')}</SectionTitle>
              <Grid>
                <Num label={fieldLabel('ssc_employee_pct')} k="ssc_employee_pct" form={form} setForm={setForm} disabled={!canManage} />
                <Num label={fieldLabel('ssc_employer_pct')} k="ssc_employer_pct" form={form} setForm={setForm} disabled={!canManage} />
                <Num label={fieldLabel('ssc_ceiling')} k="ssc_ceiling" form={form} setForm={setForm} disabled={!canManage}
                  hint={t('hrSettings.hint.ssc_ceiling')} />
              </Grid>
            </div>

            <div style={CARD}>
              <SectionTitle>{t('hrSettings.sectionTax')}</SectionTitle>
              <Grid>
                <Num label={fieldLabel('personal_exemptions')} k="personal_exemptions" form={form} setForm={setForm} disabled={!canManage}
                  hint={t('hrSettings.hint.personal_exemptions')} />
              </Grid>
              <div style={{ fontSize: 11, color: '#666', fontWeight: 600, margin: '16px 0 6px' }}>{fieldLabel('tax_brackets')}</div>
              <div style={{ fontSize: 10, color: '#999', marginBottom: 8 }}>{t('hrSettings.hint.tax_brackets')}</div>
              <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 420, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAFAFA' }}>
                    {[t('hrSettings.bracketFrom'), t('hrSettings.bracketUpTo'), t('hrSettings.bracketRate'), ''].map((h, i) => (
                      <th key={i} style={{ padding: '6px 10px', textAlign: 'start', fontSize: 10, fontWeight: 600, color: '#888' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {form.tax_brackets.map((b, i) => {
                    const isTop = i === form.tax_brackets.length - 1
                    const from = i === 0 ? '0' : (form.tax_brackets[i - 1].up_to || '?')
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #F7F4F0' }}>
                        <td style={{ padding: '6px 10px', fontSize: 12, color: '#888' }}>{from}</td>
                        <td style={{ padding: '6px 10px' }}>
                          {isTop ? <span style={{ fontSize: 12, color: '#888' }}>{t('hrSettings.noLimit')}</span> : (
                            <input type="number" value={b.up_to ?? ''} disabled={!canManage} onChange={e => setBracket(i, 'up_to', e.target.value)} style={{ ...inputStyle(!canManage), minWidth: 110 }} />
                          )}
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <input type="number" value={b.rate} disabled={!canManage} onChange={e => setBracket(i, 'rate', e.target.value)} style={{ ...inputStyle(!canManage), minWidth: 80 }} />
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          {canManage && !isTop && (
                            <button onClick={() => removeBracket(i)} style={{ fontSize: 10, padding: '3px 8px', background: '#FEF2F2', color: '#E74C3C', border: '1px solid #E74C3C55', borderRadius: 4, cursor: 'pointer' }}>
                              {t('hrSettings.remove')}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
              {canManage && (
                <button onClick={addBracket} style={{ marginTop: 8, fontSize: 11, fontWeight: 600, padding: '5px 10px', background: '#F7F4F0', border: '1px solid #E0DAD4', borderRadius: 6, cursor: 'pointer', color: DARK }}>
                  {t('hrSettings.addBracket')}
                </button>
              )}
            </div>

            {error && <div style={{ whiteSpace: 'pre-line', fontSize: 12, color: '#B03A2E', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, padding: '8px 12px', marginBottom: 12 }}>{error}</div>}
            {notice && <div style={{ fontSize: 12, color: '#1E7D4F', background: '#EEF9F1', border: '1px solid #2AC87A55', borderRadius: 7, padding: '8px 12px', marginBottom: 12 }}>{notice}</div>}
            {canManage && (
              <button onClick={() => save()} disabled={saving}
                style={{ padding: '10px 20px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, marginBottom: 24 }}>
                {saving ? t('hr.saving') : t('hr.save')}
              </button>
            )}

            <div style={CARD}>
              <SectionTitle>{t('hrSettings.sectionAllowances')}</SectionTitle>
              {canManage && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <TextIn label={t('hrSettings.allowanceNameEn')} value={newType.name_en} onChange={v => setNewType(a => ({ ...a, name_en: v }))} />
                  <TextIn label={t('hrSettings.allowanceNameAr')} value={newType.name_ar} onChange={v => setNewType(a => ({ ...a, name_ar: v }))} />
                  <div>
                    <div style={labelStyle}>{t('hrSettings.allowanceKind')}</div>
                    <select value={newType.kind} onChange={e => setNewType(a => ({ ...a, kind: e.target.value }))} style={inputStyle(false)}>
                      <option value="fixed">{t('hrSettings.kindFixed')}</option>
                      <option value="percent">{t('hrSettings.kindPercent')}</option>
                    </select>
                  </div>
                  <TextIn label={newType.kind === 'percent' ? t('hrSettings.defaultPercent') : t('hrSettings.defaultAmount')} type="number"
                    value={newType.default_amount} onChange={v => setNewType(a => ({ ...a, default_amount: v }))} />
                  <label style={checkStyle}><input type="checkbox" checked={newType.taxable} onChange={e => setNewType(a => ({ ...a, taxable: e.target.checked }))} />{t('hrPay.taxable')}</label>
                  <label style={checkStyle}><input type="checkbox" checked={newType.ssc_subject} onChange={e => setNewType(a => ({ ...a, ssc_subject: e.target.checked }))} />{t('hrPay.sscSubject')}</label>
                  <button onClick={addType}
                    style={{ padding: '9px 16px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    {t('hrSettings.addAllowance')}
                  </button>
                </div>
              )}
              {typeError && <div style={{ whiteSpace: 'pre-line', fontSize: 12, color: '#B03A2E', marginBottom: 8 }}>{typeError}</div>}
              {allowanceTypes.length === 0 ? (
                <div style={{ color: '#bbb', fontSize: 12, textAlign: 'center', padding: 20 }}>{t('hrSettings.noAllowanceTypes')}</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#FAFAFA' }}>
                      {[t('hrSettings.allowanceNameEn'), t('hrSettings.allowanceNameAr'), t('hrSettings.defaultAmount'), t('hrPay.colFlags'), ''].map((h, i) => (
                        <th key={i} style={{ padding: '8px 12px', textAlign: 'start', fontSize: 10, fontWeight: 600, color: '#888' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allowanceTypes.map(row => (
                      <tr key={row.id} style={{ borderBottom: '1px solid #F7F4F0', opacity: row.is_active ? 1 : 0.5 }}>
                        <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600 }}>{row.name_en}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12 }}>{row.name_ar || '—'}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12 }}>{row.kind === 'percent' ? `${row.default_amount}%` : `${row.default_amount} JD`}</td>
                        <td style={{ padding: '8px 12px', fontSize: 10, color: '#888' }}>
                          {[row.taxable && t('hrPay.taxable'), row.ssc_subject && t('hrPay.sscSubject'), !row.is_active && t('hrPay.inactive')].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {canManage && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => editTypeAmount(row)} style={smallBtn}>{t('hrPay.editAmount')}</button>
                              <button onClick={() => patchType(row, { is_active: !row.is_active })} style={smallBtn}>
                                {row.is_active ? t('hrPay.deactivate') : t('hrPay.activate')}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function VerificationBanner({ saved, t, canManage, onVerify, saving }) {
  if (saved.rates_verified) {
    const when = saved.rates_verified_at ? new Date(saved.rates_verified_at).toLocaleDateString() : ''
    return (
      <div style={{ fontSize: 12, color: '#1E7D4F', background: '#EEF9F1', border: '1px solid #2AC87A55', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
        {t('hrSettings.verifiedBy', { name: saved.rates_verified_by_name || '—', date: when })}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', fontSize: 12, color: '#8A5A00', background: '#FFF6E5', border: '1px solid #F39C1255', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
      <span><b>{t('hrSettings.unverifiedTitle')}</b> {t('hrSettings.unverifiedBody')}</span>
      {canManage && (
        <button onClick={onVerify} disabled={saving}
          style={{ padding: '6px 12px', background: '#fff', border: '1px solid #F39C12', color: '#8A5A00', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
          {t('hrSettings.markVerified')}
        </button>
      )}
    </div>
  )
}

const labelStyle = { fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 600 }
const checkStyle = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#666', fontWeight: 600, paddingBottom: 8 }
const smallBtn = { fontSize: 10, fontWeight: 600, padding: '3px 8px', background: '#F7F4F0', border: '1px solid #E0DAD4', borderRadius: 4, cursor: 'pointer', color: DARK }

function inputStyle(disabled) {
  return { width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK, background: disabled ? '#F7F4F0' : '#fff' }
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: 14, fontWeight: 800, color: DARK, marginBottom: 14 }}>{children}</div>
}

function Grid({ children }) {
  return <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
}

function Num({ label, k, form, setForm, disabled, hint }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <input type="number" value={form[k] ?? ''} disabled={disabled} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={inputStyle(disabled)} />
      {hint && <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function ReadOnly({ label, value }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={{ ...inputStyle(true), color: '#666' }}>{value}</div>
    </div>
  )
}

function TextIn({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle(false), width: 140 }} />
    </div>
  )
}
