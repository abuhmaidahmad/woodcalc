import React, { useState, useEffect } from 'react'
import Logo from '../components/Logo'
import { useParams, useNavigate } from 'react-router-dom'
import { hasPermission, getCompany } from '../api/auth'
import {
  getEmployee, updateEmployee, deleteEmployee,
  listAttendance, createAttendance,
  listLeaveRequests, createLeaveRequest, approveLeaveRequest, rejectLeaveRequest,
  listPayroll, listDepartments,
} from '../api/hr'
import { exportPayslipPDF } from '../utils/payslipPdf'
import { useTranslation } from '../i18n/LanguageContext'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'

const ATT_STATUS_KEYS = { PRESENT: 'hrEmployeeDetail.attStatusPresent', ABSENT: 'hrEmployeeDetail.attStatusAbsent', LATE: 'hrEmployeeDetail.attStatusLate' }
const LEAVE_TYPE_KEYS = { ANNUAL: 'hrEmployeeDetail.leaveTypeAnnual', SICK: 'hrEmployeeDetail.leaveTypeSick', UNPAID: 'hrEmployeeDetail.leaveTypeUnpaid', OTHER: 'hrEmployeeDetail.leaveTypeOther' }
const LEAVE_STATUS_KEYS = { PENDING: 'hrEmployeeDetail.leaveStatusPending', APPROVED: 'hrEmployeeDetail.leaveStatusApproved', REJECTED: 'hrEmployeeDetail.leaveStatusRejected' }
const LEAVE_STATUS_COLORS = { PENDING: '#F39C12', APPROVED: '#2AC87A', REJECTED: '#E74C3C' }

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

  const canManage = hasPermission('hr.manage_employees')
  const canViewSalary = hasPermission('hr.view_salary')
  const canManageAttendance = hasPermission('hr.manage_attendance')
  const canManageLeave = hasPermission('hr.manage_leave')

  const fetchEmployee = async () => {
    setLoading(true)
    try {
      const data = await getEmployee(id)
      setEmployee(data)
      setForm(data)
    } catch {}
    setLoading(false)
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

  useEffect(() => { fetchEmployee(); fetchAttendance(); fetchLeave(); fetchPayroll(); fetchDepartments() }, [id])

  const saveProfile = async () => {
    setSaving(true)
    try {
      const body = { ...form }
      delete body.id; delete body.tenant; delete body.department_detail
      if (!canViewSalary) delete body.salary
      if (!body.hire_date) delete body.hire_date
      if (!body.department) body.department = null
      const updated = await updateEmployee(id, body)
      setEmployee(updated)
      setForm(updated)
    } catch {}
    setSaving(false)
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
    ...(canViewSalary ? [['payroll', t('hrEmployeeDetail.tabPayroll')]] : []),
  ]

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
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

      <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label={t('hr.firstName')} value={form.first_name} onChange={v => setForm(f => ({ ...f, first_name: v }))} disabled={!canManage} />
              <Field label={t('hr.lastName')} value={form.last_name} onChange={v => setForm(f => ({ ...f, last_name: v }))} disabled={!canManage} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label={t('hr.email')} type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} disabled={!canManage} />
              <Field label={t('hr.phone')} value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} disabled={!canManage} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <Field label={t('hr.hireDate')} type="date" value={form.hire_date || ''} onChange={v => setForm(f => ({ ...f, hire_date: v }))} disabled={!canManage} />
              {canViewSalary && (
                <Field label={t('hr.salary')} type="number" value={form.salary ?? ''} onChange={v => setForm(f => ({ ...f, salary: v }))} disabled={!hasPermission('hr.edit_salary')} />
              )}
            </div>
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

function Field({ label, value, onChange, type = 'text', disabled = false }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <input type={type} value={value} disabled={disabled} onChange={e => onChange(e.target.value)}
        style={{ padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK, background: disabled ? '#F7F4F0' : '#fff' }} />
    </div>
  )
}
