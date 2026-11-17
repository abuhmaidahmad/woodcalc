import React, { useState, useEffect } from 'react'
import Logo from '../components/Logo'
import { useParams, useNavigate } from 'react-router-dom'
import { hasPermission, getCompany } from '../api/auth'
import {
  getEmployee, deleteEmployee,
  listAttendance, createAttendance,
  listLeaveRequests, createLeaveRequest, approveLeaveRequest, rejectLeaveRequest,
  listPayroll, listDepartments,
  listLinkableUsers, listStations, updateEmployeeChecked, formatErrors,
  listAllowanceTypes, listEmployeeAllowances, createEmployeeAllowance, updateEmployeeAllowance, deleteEmployeeAllowance,
} from '../api/hr'
import { exportPayslipPDF } from '../utils/payslipPdf'
import { useTranslation } from '../i18n/LanguageContext'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'

const ATT_STATUS_KEYS = { PRESENT: 'hrEmployeeDetail.attStatusPresent', ABSENT: 'hrEmployeeDetail.attStatusAbsent', LATE: 'hrEmployeeDetail.attStatusLate' }
const LEAVE_TYPE_KEYS = { ANNUAL: 'hrEmployeeDetail.leaveTypeAnnual', SICK: 'hrEmployeeDetail.leaveTypeSick', UNPAID: 'hrEmployeeDetail.leaveTypeUnpaid', OTHER: 'hrEmployeeDetail.leaveTypeOther' }
const LEAVE_STATUS_KEYS = { PENDING: 'hrEmployeeDetail.leaveStatusPending', APPROVED: 'hrEmployeeDetail.leaveStatusApproved', REJECTED: 'hrEmployeeDetail.leaveStatusRejected' }
const LEAVE_STATUS_COLORS = { PENDING: '#F39C12', APPROVED: '#2AC87A', REJECTED: '#E74C3C' }
const CONTRACT_TYPES = ['full_time', 'part_time', 'fixed_term', 'temporary']
const PAY_TYPES = ['monthly', 'daily', 'piece_rate']
const PROFILE_FIELDS = ['first_name', 'last_name', 'job_title', 'department', 'email', 'phone', 'hire_date', 'contract_type', 'station', 'user']
const PAY_FIELDS = ['pay_type', 'base_salary', 'daily_rate', 'commission_pct', 'ssc_enrolled', 'ssc_number', 'payment_method', 'iban']
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => k in obj).map(k => [k, obj[k]]))

export default function EmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, language } = useTranslation()
  const dir = language === 'ar' ? 'rtl' : 'ltr'
  const locale = language === 'ar' ? 'ar' : 'en-GB'

  const [employee, setEmployee] = useState(null)
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('profile')
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const deptLabel = d => language === 'ar' ? d.name_ar : d.name_en

  const [attendance, setAttendance] = useState([])
  const [attForm, setAttForm] = useState({ date: '', check_in: '', check_out: '', status: 'PRESENT' })

  const [leaveRequests, setLeaveRequests] = useState([])
  const [leaveForm, setLeaveForm] = useState({ leave_type: 'ANNUAL', start_date: '', end_date: '', reason: '' })

  const [payroll, setPayroll] = useState([])

  const [stations, setStations] = useState([])
  const [linkableUsers, setLinkableUsers] = useState([])
  const [profileError, setProfileError] = useState('')
  const [payForm, setPayForm] = useState(null)
  const [payError, setPayError] = useState('')
  const [paySaved, setPaySaved] = useState(false)
  const [allowances, setAllowances] = useState([])
  const [allowanceTypes, setAllowanceTypes] = useState([])
  const [newAllowance, setNewAllowance] = useState({ allowance_type: '', amount: '' })
  const [allowanceError, setAllowanceError] = useState('')

  const canManage = hasPermission('hr.manage_employees')
  const canViewSalary = hasPermission('hr.view_salary')
  const canManageAttendance = hasPermission('hr.manage_attendance')
  const canManageLeave = hasPermission('hr.manage_leave')
  const canEditSalary = hasPermission('hr.edit_salary')

  const fetchEmployee = async () => {
    setLoading(true)
    try {
      const data = await getEmployee(id)
      setEmployee(data)
      setForm(data)
      setPayForm(pick(data, PAY_FIELDS))
    } catch {}
    setLoading(false)
  }

  const fetchLinkOptions = async () => {
    if (!canManage) return
    try { setStations((await listStations()).filter(st => st.active)) } catch {}
    try { setLinkableUsers(await listLinkableUsers()) } catch {}
  }

  const fetchAllowances = async () => {
    if (!canViewSalary) return
    try { setAllowances(await listEmployeeAllowances(id)) } catch {}
    try { setAllowanceTypes(await listAllowanceTypes()) } catch {}
  }

  const fetchAttendance = async () => {
    try {
      const data = await listAttendance(id)
      setAttendance(Array.isArray(data) ? data : (data.results || []))
    } catch {}
  }

  const fetchLeave = async () => {
    try {
      const data = await listLeaveRequests(id)
      setLeaveRequests(Array.isArray(data) ? data : (data.results || []))
    } catch {}
  }

  const fetchPayroll = async () => {
    if (!canViewSalary) return
    try {
      const data = await listPayroll({ employee: id })
      setPayroll(Array.isArray(data) ? data : (data.results || []))
    } catch {}
  }

  const fetchDepartments = async () => {
    try {
      const data = await listDepartments()
      const list = Array.isArray(data) ? data : (data.results || [])
      setDepartments(list.filter(d => d.is_active))
    } catch {}
  }

  useEffect(() => { fetchEmployee(); fetchAttendance(); fetchLeave(); fetchPayroll(); fetchDepartments(); fetchLinkOptions(); fetchAllowances() }, [id])

  const fieldLabel = k => (t(`hrPay.field.${k}`) !== `hrPay.field.${k}` ? t(`hrPay.field.${k}`) : k)

  const saveProfile = async () => {
    setSaving(true)
    setProfileError('')
    try {
      // Only profile fields: pay details are saved from the Pay tab.
      const body = pick(form, PROFILE_FIELDS)
      if (!body.hire_date) body.hire_date = null
      for (const k of ['department', 'station', 'user']) if (!body[k]) body[k] = null
      const { ok, data } = await updateEmployeeChecked(id, body)
      if (ok) { setEmployee(data); setForm(data); setPayForm(pick(data, PAY_FIELDS)) }
      else setProfileError(formatErrors(data, fieldLabel))
    } catch {}
    setSaving(false)
  }

  const savePay = async () => {
    setSaving(true)
    setPayError('')
    setPaySaved(false)
    try {
      const { ok, data } = await updateEmployeeChecked(id, payForm)
      if (ok) { setEmployee(data); setForm(data); setPayForm(pick(data, PAY_FIELDS)); setPaySaved(true) }
      else setPayError(formatErrors(data, fieldLabel))
    } catch {}
    setSaving(false)
  }

  const addAllowance = async () => {
    if (!newAllowance.allowance_type) return
    setAllowanceError('')
    const body = { employee: Number(id), allowance_type: Number(newAllowance.allowance_type) }
    if (newAllowance.amount !== '') body.amount = newAllowance.amount
    const { ok, data } = await createEmployeeAllowance(body)
    if (!ok) { setAllowanceError(formatErrors(data, fieldLabel)); return }
    setNewAllowance({ allowance_type: '', amount: '' })
    fetchAllowances()
  }

  const editAllowanceAmount = async (row) => {
    const value = window.prompt(t('hrPay.allowanceAmountPrompt'), row.amount ?? '')
    if (value === null) return
    const { ok, data } = await updateEmployeeAllowance(row.id, { amount: value.trim() === '' ? null : value.trim() })
    if (!ok) { setAllowanceError(formatErrors(data, fieldLabel)); return }
    fetchAllowances()
  }

  const toggleAllowance = async (row) => {
    await updateEmployeeAllowance(row.id, { is_active: !row.is_active })
    fetchAllowances()
  }

  const removeAllowance = async (row) => {
    if (!window.confirm(t('hrPay.allowanceRemoveConfirm'))) return
    await deleteEmployeeAllowance(row.id)
    fetchAllowances()
  }

  const removeEmployee = async () => {
    if (!window.confirm(t('hrEmployeeDetail.confirmDelete'))) return
    await deleteEmployee(id)
    navigate('/hr/employees')
  }

  const addAttendance = async () => {
    if (!attForm.date) return
    const body = { ...attForm, employee: id }
    if (!body.check_in) delete body.check_in
    if (!body.check_out) delete body.check_out
    await createAttendance(body)
    setAttForm({ date: '', check_in: '', check_out: '', status: 'PRESENT' })
    fetchAttendance()
  }

  const addLeave = async () => {
    if (!leaveForm.start_date || !leaveForm.end_date) return
    await createLeaveRequest({ ...leaveForm, employee: id })
    setLeaveForm({ leave_type: 'ANNUAL', start_date: '', end_date: '', reason: '' })
    fetchLeave()
  }

  const decideLeave = async (leaveId, approve) => {
    const note = window.prompt(t('hrEmployeeDetail.decisionNotePlaceholder')) || ''
    if (approve) await approveLeaveRequest(leaveId, note)
    else await rejectLeaveRequest(leaveId, note)
    fetchLeave()
  }

  if (loading || !employee) {
    return <div dir={dir} style={{ padding: 40, textAlign: 'center', color: '#bbb', fontFamily: 'Inter, sans-serif' }}>{t('hr.loading')}</div>
  }

  const TABS = [
    ['profile', t('hrEmployeeDetail.tabProfile')],
    ['attendance', t('hrEmployeeDetail.tabAttendance')],
    ['leave', t('hrEmployeeDetail.tabLeave')],
    ...(canViewSalary ? [
      ['pay', t('hrPay.tabPay')],
      ['allowances', t('hrPay.tabAllowances')],
      ['payroll', t('hrEmployeeDetail.tabPayroll')],
    ] : []),
  ]

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      <div className="app-topbar" style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Logo forDarkBg onClick={() => navigate('/dashboard')} height={22} />
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{employee.first_name} {employee.last_name}</span>
        </div>
        <button onClick={() => navigate('/hr/employees')}
          style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          {t('hrEmployeeDetail.back')}
        </button>
      </div>

      <div className="app-content" style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
          {TABS.map(([id2, label]) => (
            <button key={id2} onClick={() => setTab(id2)}
              style={{ padding: '8px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: tab === id2 ? ACCENT : '#fff', color: tab === id2 ? '#fff' : '#666', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label={t('hr.firstName')} value={form.first_name} onChange={v => setForm(f => ({ ...f, first_name: v }))} disabled={!canManage} />
              <Field label={t('hr.lastName')} value={form.last_name} onChange={v => setForm(f => ({ ...f, last_name: v }))} disabled={!canManage} />
            </div>
            <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label={t('hr.jobTitle')} value={form.job_title} onChange={v => setForm(f => ({ ...f, job_title: v }))} disabled={!canManage} />
              <div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 600 }}>{t('hr.department')}</div>
                <select value={form.department ?? ''} disabled={!canManage}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  style={{ padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK, background: canManage ? '#fff' : '#F7F4F0' }}>
                  <option value="">{t('hr.selectDepartment')}</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{deptLabel(d)}</option>)}
                </select>
              </div>
            </div>
            <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label={t('hr.email')} type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} disabled={!canManage} />
              <Field label={t('hr.phone')} value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} disabled={!canManage} />
            </div>
            <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label={t('hr.hireDate')} type="date" value={form.hire_date || ''} onChange={v => setForm(f => ({ ...f, hire_date: v }))} disabled={!canManage} />
              <Select label={t('hrPay.field.contract_type')} value={form.contract_type} disabled={!canManage}
                onChange={v => setForm(f => ({ ...f, contract_type: v }))}
                options={CONTRACT_TYPES.map(c => [c, t(`hrPay.contractType.${c}`)])} />
            </div>
            <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <Select label={t('hrPay.field.station')} value={form.station ?? ''} disabled={!canManage}
                onChange={v => setForm(f => ({ ...f, station: v }))}
                options={[['', t('hrPay.noStation')], ...stations.map(st => [st.id, st.name]),
                  ...(form.station && !stations.some(st => st.id === Number(form.station)) ? [[form.station, form.station_name || form.station]] : [])]} />
              <div>
                <Select label={t('hrPay.field.user')} value={form.user ?? ''} disabled={!canManage}
                  onChange={v => setForm(f => ({ ...f, user: v }))}
                  options={[['', t('hrPay.noUser')],
                    ...linkableUsers.filter(u => !u.employee || u.employee === employee.id).map(u => [u.id, `${u.name} (${u.email})`]),
                    ...(form.user && !linkableUsers.some(u => u.id === Number(form.user)) && form.user_detail ? [[form.user, `${form.user_detail.name} (${form.user_detail.email})`]] : [])]} />
                <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>{t('hrPay.userHint')}</div>
              </div>
            </div>
            {profileError && <ErrorBox text={profileError} />}
            {canManage && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={saveProfile} disabled={saving}
                  style={{ padding: '10px 20px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                  {saving ? t('hr.saving') : t('hr.save')}
                </button>
                <button onClick={removeEmployee}
                  style={{ padding: '10px 20px', background: '#FEF2F2', color: '#E74C3C', border: '1.5px solid #FECACA', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                  {t('hrEmployeeDetail.delete')}
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'pay' && canViewSalary && payForm && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Select label={t('hrPay.field.pay_type')} value={payForm.pay_type} disabled={!canEditSalary}
                onChange={v => setPayForm(f => ({ ...f, pay_type: v }))}
                options={PAY_TYPES.map(p => [p, t(`hrPay.payType.${p}`)])} />
              {payForm.pay_type === 'monthly' ? (
                <Field wide label={t('hrPay.field.base_salary')} type="number" value={payForm.base_salary ?? ''} disabled={!canEditSalary}
                  onChange={v => setPayForm(f => ({ ...f, base_salary: v }))} />
              ) : (
                <Field wide label={t('hrPay.field.daily_rate')} type="number" value={payForm.daily_rate ?? ''} disabled={!canEditSalary}
                  onChange={v => setPayForm(f => ({ ...f, daily_rate: v }))} />
              )}
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: '#666', background: '#F7F4F0', borderRadius: 7, padding: '8px 12px', marginBottom: 12 }}>
              <span>{t('hrPay.effectiveDaily')}: <b style={{ color: DARK }}>{employee.effective_daily_rate ?? '—'} JD</b></span>
              <span>{t('hrPay.effectiveHourly')}: <b style={{ color: DARK }}>{employee.effective_hourly_rate ?? '—'} JD</b></span>
              <span style={{ color: '#999' }}>{t('hrPay.ratesHint')}</span>
            </div>
            <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field wide label={t('hrPay.field.commission_pct')} type="number" value={payForm.commission_pct ?? ''} disabled={!canEditSalary}
                onChange={v => setPayForm(f => ({ ...f, commission_pct: v }))} />
              <div style={{ fontSize: 10, color: '#999', alignSelf: 'end', paddingBottom: 8 }}>{t('hrPay.commissionHint')}</div>
            </div>
            <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#666', alignSelf: 'end', paddingBottom: 8 }}>
                <input type="checkbox" checked={!!payForm.ssc_enrolled} disabled={!canEditSalary}
                  onChange={e => setPayForm(f => ({ ...f, ssc_enrolled: e.target.checked }))} />
                {t('hrPay.field.ssc_enrolled')}
              </label>
              <Field wide label={t('hrPay.field.ssc_number')} value={payForm.ssc_number ?? ''} disabled={!canEditSalary || !payForm.ssc_enrolled}
                onChange={v => setPayForm(f => ({ ...f, ssc_number: v }))} />
            </div>
            <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <Select label={t('hrPay.field.payment_method')} value={payForm.payment_method} disabled={!canEditSalary}
                onChange={v => setPayForm(f => ({ ...f, payment_method: v }))}
                options={[['cash', t('hrPay.paymentMethod.cash')], ['bank', t('hrPay.paymentMethod.bank')]]} />
              {payForm.payment_method === 'bank' && (
                <Field wide label={t('hrPay.field.iban')} value={payForm.iban ?? ''} disabled={!canEditSalary}
                  onChange={v => setPayForm(f => ({ ...f, iban: v }))} />
              )}
            </div>
            {payError && <ErrorBox text={payError} />}
            {canEditSalary && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={savePay} disabled={saving}
                  style={{ padding: '10px 20px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                  {saving ? t('hr.saving') : t('hr.save')}
                </button>
                {paySaved && <span style={{ fontSize: 12, color: '#2AC87A', fontWeight: 600 }}>{t('hrPay.saved')}</span>}
              </div>
            )}
          </div>
        )}

        {tab === 'allowances' && canViewSalary && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {canEditSalary && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Select label={t('hrPay.allowanceType')} value={newAllowance.allowance_type}
                  onChange={v => setNewAllowance(a => ({ ...a, allowance_type: v }))}
                  options={[['', t('hrPay.selectAllowance')],
                    ...allowanceTypes.filter(at => at.is_active && !allowances.some(a => a.allowance_type === at.id))
                      .map(at => [at.id, `${allowanceName(at, language)} (${at.kind === 'percent' ? `${at.default_amount}%` : `${at.default_amount} JD`})`])]} />
                <Field label={t('hrPay.amountOverride')} type="number" value={newAllowance.amount}
                  onChange={v => setNewAllowance(a => ({ ...a, amount: v }))} />
                <button onClick={addAllowance}
                  style={{ padding: '9px 16px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                  {t('hrPay.addAllowance')}
                </button>
              </div>
            )}
            {canEditSalary && allowanceTypes.length === 0 && (
              <div style={{ fontSize: 11, color: '#999', marginBottom: 12 }}>{t('hrPay.noAllowanceTypes')}</div>
            )}
            {allowanceError && <ErrorBox text={allowanceError} />}
            {allowances.length === 0 ? (
              <div style={{ color: '#bbb', fontSize: 12, textAlign: 'center', padding: 20 }}>{t('hrPay.noAllowances')}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAFAFA' }}>
                    {[t('hrPay.allowanceType'), t('hrPay.colAmount'), t('hrPay.colFlags'), ''].map((h, hi) => (
                      <th key={hi} style={{ padding: '8px 12px', textAlign: 'start', fontSize: 10, fontWeight: 600, color: '#888' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allowances.map(a => {
                    const at = a.allowance_type_detail
                    const unit = at.kind === 'percent' ? '%' : ' JD'
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid #F7F4F0', opacity: a.is_active ? 1 : 0.5 }}>
                        <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600 }}>{allowanceName(at, language)}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12 }}>
                          {a.effective_amount}{unit}
                          {a.amount == null && <span style={{ fontSize: 10, color: '#999' }}> · {t('hrPay.usesDefault')}</span>}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 10, color: '#888' }}>
                          {[at.taxable && t('hrPay.taxable'), at.ssc_subject && t('hrPay.sscSubject'), !a.is_active && t('hrPay.inactive')].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {canEditSalary && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <SmallButton onClick={() => editAllowanceAmount(a)}>{t('hrPay.editAmount')}</SmallButton>
                              <SmallButton onClick={() => toggleAllowance(a)}>{a.is_active ? t('hrPay.deactivate') : t('hrPay.activate')}</SmallButton>
                              <SmallButton danger onClick={() => removeAllowance(a)}>{t('hrPay.remove')}</SmallButton>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {tab === 'attendance' && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {canManageAttendance && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label={t('hrEmployeeDetail.colDate')} type="date" value={attForm.date} onChange={v => setAttForm(f => ({ ...f, date: v }))} />
                <Field label={t('hrEmployeeDetail.colCheckIn')} type="time" value={attForm.check_in} onChange={v => setAttForm(f => ({ ...f, check_in: v }))} />
                <Field label={t('hrEmployeeDetail.colCheckOut')} type="time" value={attForm.check_out} onChange={v => setAttForm(f => ({ ...f, check_out: v }))} />
                <div>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 600 }}>{t('hrEmployeeDetail.colAttStatus')}</div>
                  <select value={attForm.status} onChange={e => setAttForm(f => ({ ...f, status: e.target.value }))}
                    style={{ padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12 }}>
                    <option value="PRESENT">{t('hrEmployeeDetail.attStatusPresent')}</option>
                    <option value="ABSENT">{t('hrEmployeeDetail.attStatusAbsent')}</option>
                    <option value="LATE">{t('hrEmployeeDetail.attStatusLate')}</option>
                  </select>
                </div>
                <button onClick={addAttendance}
                  style={{ padding: '9px 16px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                  {t('hrEmployeeDetail.attendanceAdd')}
                </button>
              </div>
            )}
            {attendance.length === 0 ? (
              <div style={{ color: '#bbb', fontSize: 12, textAlign: 'center', padding: 20 }}>{t('hrEmployeeDetail.noAttendance')}</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAFAFA' }}>
                    {[t('hrEmployeeDetail.colDate'), t('hrEmployeeDetail.colCheckIn'), t('hrEmployeeDetail.colCheckOut'), t('hrEmployeeDetail.colAttStatus')].map((h, hi) => (
                      <th key={hi} style={{ padding: '8px 12px', textAlign: 'start', fontSize: 10, fontWeight: 600, color: '#888' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendance.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #F7F4F0' }}>
                      <td style={{ padding: '8px 12px', fontSize: 12 }}>{a.date}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12 }}>{a.check_in || '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12 }}>{a.check_out || '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: a.status === 'PRESENT' ? '#2AC87A' : a.status === 'LATE' ? '#F39C12' : '#E74C3C' }}>
                        {t(ATT_STATUS_KEYS[a.status])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'leave' && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {canManageLeave && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 600 }}>{t('hrEmployeeDetail.leaveType')}</div>
                  <select value={leaveForm.leave_type} onChange={e => setLeaveForm(f => ({ ...f, leave_type: e.target.value }))}
                    style={{ padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12 }}>
                    <option value="ANNUAL">{t('hrEmployeeDetail.leaveTypeAnnual')}</option>
                    <option value="SICK">{t('hrEmployeeDetail.leaveTypeSick')}</option>
                    <option value="UNPAID">{t('hrEmployeeDetail.leaveTypeUnpaid')}</option>
                    <option value="OTHER">{t('hrEmployeeDetail.leaveTypeOther')}</option>
                  </select>
                </div>
                <Field label={t('hrEmployeeDetail.startDate')} type="date" value={leaveForm.start_date} onChange={v => setLeaveForm(f => ({ ...f, start_date: v }))} />
                <Field label={t('hrEmployeeDetail.endDate')} type="date" value={leaveForm.end_date} onChange={v => setLeaveForm(f => ({ ...f, end_date: v }))} />
                <Field label={t('hrEmployeeDetail.reason')} value={leaveForm.reason} onChange={v => setLeaveForm(f => ({ ...f, reason: v }))} />
                <button onClick={addLeave}
                  style={{ padding: '9px 16px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                  {t('hrEmployeeDetail.leaveAdd')}
                </button>
              </div>
            )}
            {leaveRequests.length === 0 ? (
              <div style={{ color: '#bbb', fontSize: 12, textAlign: 'center', padding: 20 }}>{t('hrEmployeeDetail.noLeave')}</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAFAFA' }}>
                    {[t('hrEmployeeDetail.colType'), t('hrEmployeeDetail.colDates'), t('hrEmployeeDetail.colReason'), t('hrEmployeeDetail.colLeaveStatus'), ''].map((h, hi) => (
                      <th key={hi} style={{ padding: '8px 12px', textAlign: 'start', fontSize: 10, fontWeight: 600, color: '#888' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.map(lv => (
                    <tr key={lv.id} style={{ borderBottom: '1px solid #F7F4F0' }}>
                      <td style={{ padding: '8px 12px', fontSize: 12 }}>{t(LEAVE_TYPE_KEYS[lv.leave_type])}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, fontFamily: 'monospace' }}>{lv.start_date} → {lv.end_date}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12 }}>{lv.reason || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: LEAVE_STATUS_COLORS[lv.status], background: LEAVE_STATUS_COLORS[lv.status] + '18', padding: '2px 7px', borderRadius: 4 }}>
                          {t(LEAVE_STATUS_KEYS[lv.status])}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {canManageLeave && lv.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => decideLeave(lv.id, true)}
                              style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', background: '#EEF9F1', color: '#2AC87A', border: '1px solid #2AC87A55', borderRadius: 4, cursor: 'pointer' }}>
                              {t('hrEmployeeDetail.approve')}
                            </button>
                            <button onClick={() => decideLeave(lv.id, false)}
                              style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', background: '#FEF2F2', color: '#E74C3C', border: '1px solid #E74C3C55', borderRadius: 4, cursor: 'pointer' }}>
                              {t('hrEmployeeDetail.reject')}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'payroll' && canViewSalary && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {payroll.length === 0 ? (
              <div style={{ color: '#bbb', fontSize: 12, textAlign: 'center', padding: 20 }}>{t('hrEmployeeDetail.noPayroll')}</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAFAFA' }}>
                    {[t('hrEmployeeDetail.colPeriod'), t('hrEmployeeDetail.colBase'), t('hrEmployeeDetail.colBonuses'), t('hrEmployeeDetail.colDeductions'), t('hrEmployeeDetail.colNet'), t('hrEmployeeDetail.colPaid'), ''].map((h, hi) => (
                      <th key={hi} style={{ padding: '8px 12px', textAlign: 'start', fontSize: 10, fontWeight: 600, color: '#888' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payroll.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F7F4F0' }}>
                      <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: DARK }}>{p.period}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12 }}>{p.base_salary} JD</td>
                      <td style={{ padding: '8px 12px', fontSize: 12 }}>{p.bonuses} JD</td>
                      <td style={{ padding: '8px 12px', fontSize: 12 }}>{p.deductions} JD</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: ACCENT }}>{p.net_pay} JD</td>
                      <td style={{ padding: '8px 12px' }}>
                        {p.paid && <span style={{ fontSize: 10, fontWeight: 700, color: '#2AC87A', background: '#2AC87A18', padding: '2px 7px', borderRadius: 4 }}>✓</span>}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <button onClick={() => exportPayslipPDF({ employee, payroll: p, companyName: getCompany()?.name, t, dir, locale })}
                          style={{ fontSize: 10, fontWeight: 600, padding: '4px 8px', background: '#F7F4F0', border: '1px solid #E0DAD4', borderRadius: 4, cursor: 'pointer', color: DARK }}>
                          {t('hrEmployeeDetail.exportPayslip')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function allowanceName(at, language) {
  return language === 'ar' && at.name_ar ? at.name_ar : at.name_en
}

function Select({ label, value, onChange, options, disabled = false }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <select value={value ?? ''} disabled={disabled} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK, background: disabled ? '#F7F4F0' : '#fff' }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}

function ErrorBox({ text }) {
  return (
    <div style={{ whiteSpace: 'pre-line', fontSize: 12, color: '#B03A2E', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, padding: '8px 12px', marginBottom: 12 }}>
      {text}
    </div>
  )
}

function SmallButton({ onClick, children, danger = false }) {
  return (
    <button onClick={onClick}
      style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', background: danger ? '#FEF2F2' : '#F7F4F0', color: danger ? '#E74C3C' : DARK,
        border: `1px solid ${danger ? '#E74C3C55' : '#E0DAD4'}`, borderRadius: 4, cursor: 'pointer' }}>
      {children}
    </button>
  )
}

function Field({ label, value, onChange, type = 'text', disabled = false, wide = false }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <input type={type} value={value} disabled={disabled} onChange={e => onChange(e.target.value)}
        style={{ ...(wide ? { width: '100%' } : {}), padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK, background: disabled ? '#F7F4F0' : '#fff' }} />
    </div>
  )
}
