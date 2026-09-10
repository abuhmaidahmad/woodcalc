import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { hasPermission } from '../api/auth'
import { listEmployees, createEmployee } from '../api/hr'
import { useTranslation } from '../i18n/LanguageContext'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'

const EMPTY_FORM = { first_name: '', last_name: '', job_title: '', department: '', email: '', phone: '', hire_date: '', salary: '' }

export default function EmployeeList() {
  const { t, language } = useTranslation()
  const dir = language === 'ar' ? 'rtl' : 'ltr'
  const navigate = useNavigate()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const canView = hasPermission('hr.view_employees')
  const canManage = hasPermission('hr.manage_employees')
  const canViewSalary = hasPermission('hr.view_salary')

  const fetchEmployees = async () => {
    setLoading(true)
    try {
      const data = await listEmployees()
      setEmployees(Array.isArray(data) ? data : (data.results || []))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { if (canView) fetchEmployees() }, [])

  const filtered = employees.filter(e =>
    `${e.first_name} ${e.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    e.job_title?.toLowerCase().includes(search.toLowerCase()) ||
    e.department?.toLowerCase().includes(search.toLowerCase())
  )

  const saveEmployee = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) return
    setSaving(true)
    try {
      const body = { ...form }
      if (!canViewSalary || !body.salary) delete body.salary
      if (!body.hire_date) delete body.hire_date
      const res = await createEmployee(body)
      if (res.id) {
        setForm(EMPTY_FORM)
        setShowAdd(false)
        fetchEmployees()
      }
    } catch {}
    setSaving(false)
  }

  if (!canView) {
    return (
      <div dir={dir} style={{ minHeight: '100vh', background: '#F7F4F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", color: '#888' }}>
        {t('hr.noAccess')}
      </div>
    )
  }

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span onClick={() => navigate('/dashboard')} style={{ color: ACCENT, fontWeight: 800, fontSize: 18, cursor: 'pointer' }}>WoodCalc</span>
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{t('hr.title')}</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {canViewSalary && (
            <button onClick={() => navigate('/hr/payroll')}
              style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
              {t('hrPayroll.title')}
            </button>
          )}
          <button onClick={() => navigate('/dashboard')}
            style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            {t('common.navDashboard')}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: DARK }}>{t('hr.title')}</h1>
          {canManage && (
            <button onClick={() => setShowAdd(true)}
              style={{ padding: '10px 20px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              {t('hr.addEmployee')}
            </button>
          )}
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('hr.searchPlaceholder')}
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E0DAD4', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff', marginBottom: 16 }} />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>{t('hr.loading')}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <div style={{ fontWeight: 600 }}>{t('hr.emptyTitle')}</div>
            {canManage && <div style={{ fontSize: 12, marginTop: 4 }}>{t('hr.emptyDesc')}</div>}
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  {[t('hr.colName'), t('hr.colJobTitle'), t('hr.colDepartment'), t('hr.colStatus'), ...(canViewSalary ? [t('hr.colSalary')] : [])].map((h, hi) => (
                    <th key={hi} style={{ padding: '10px 14px', textAlign: 'start', fontSize: 11, fontWeight: 600, color: '#888' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => (
                  <tr key={emp.id} onClick={() => navigate(`/hr/employees/${emp.id}`)}
                    style={{ borderBottom: '1px solid #F7F4F0', cursor: 'pointer' }}>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: DARK }}>{emp.first_name} {emp.last_name}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>{emp.job_title || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>{emp.department || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: emp.active ? '#2AC87A' : '#999', background: emp.active ? '#2AC87A18' : '#99999918', padding: '3px 8px', borderRadius: 4 }}>
                        {emp.active ? t('hr.statusActive') : t('hr.statusInactive')}
                      </span>
                    </td>
                    {canViewSalary && (
                      <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600 }}>{emp.salary != null ? `${emp.salary} JD` : '—'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: DARK, marginBottom: 20 }}>{t('hr.addEmployee')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label={t('hr.firstName')} value={form.first_name} onChange={v => setForm(f => ({ ...f, first_name: v }))} />
              <Field label={t('hr.lastName')} value={form.last_name} onChange={v => setForm(f => ({ ...f, last_name: v }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label={t('hr.jobTitle')} value={form.job_title} onChange={v => setForm(f => ({ ...f, job_title: v }))} />
              <Field label={t('hr.department')} value={form.department} onChange={v => setForm(f => ({ ...f, department: v }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label={t('hr.email')} type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} />
              <Field label={t('hr.phone')} value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <Field label={t('hr.hireDate')} type="date" value={form.hire_date} onChange={v => setForm(f => ({ ...f, hire_date: v }))} />
              {canViewSalary && <Field label={t('hr.salary')} type="number" value={form.salary} onChange={v => setForm(f => ({ ...f, salary: v }))} />}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowAdd(false); setForm(EMPTY_FORM) }}
                style={{ flex: 1, padding: '11px', background: '#F7F4F0', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#666', fontWeight: 600 }}>
                {t('hr.cancel')}
              </button>
              <button onClick={saveEmployee} disabled={saving || !form.first_name.trim() || !form.last_name.trim()}
                style={{ flex: 2, padding: '11px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                {saving ? t('hr.saving') : t('hr.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', color: DARK }} />
    </div>
  )
}
