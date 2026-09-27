import React, { useState, useEffect } from 'react'
import Logo from '../components/Logo'
import { useNavigate, useParams } from 'react-router-dom'
import { getCompany, updateCompany, extendTrial } from '../api/platformAdmin'
import { useTranslation } from '../i18n/LanguageContext'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'

const STATUS_OPTIONS = ['trialing', 'active', 'past_due', 'canceled', 'suspended']
const STATUS_COLORS = {
  trialing: '#C8902A', active: '#2AC87A', past_due: '#e07b00', canceled: '#999', suspended: '#c33',
}
const STATUS_KEYS = {
  trialing: 'adminCompanies.statusTrialing', active: 'adminCompanies.statusActive', past_due: 'adminCompanies.statusPastDue',
  canceled: 'adminCompanies.statusCanceled', suspended: 'adminCompanies.statusSuspended',
}
const ROLE_KEYS = {
  owner: 'adminCompanyDetail.roleOwner', admin: 'adminCompanyDetail.roleAdmin', staff: 'adminCompanyDetail.roleStaff',
}
const INVOICE_STATUS_COLORS = { pending: '#e07b00', paid: '#2AC87A', failed: '#c33' }
const INVOICE_STATUS_KEYS = {
  pending: 'adminCompanyDetail.invoicePending', paid: 'adminCompanyDetail.invoicePaid', failed: 'adminCompanyDetail.invoiceFailed',
}

function fmtDate(d, locale) {
  return d ? new Date(d).toLocaleDateString(locale) : '—'
}

export default function AdminCompanyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, language } = useTranslation()
  const dir = language === 'ar' ? 'rtl' : 'ltr'
  const locale = language === 'ar' ? 'ar' : 'en-US'
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [extending, setExtending] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const data = await getCompany(id)
      setCompany(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const updateStatus = async (status) => {
    setCompany(prev => ({ ...prev, status }))
    await updateCompany(id, { status })
  }

  const doExtendTrial = async () => {
    setExtending(true)
    try {
      const updated = await extendTrial(id)
      setCompany(prev => ({ ...prev, ...updated }))
    } catch {}
    setExtending(false)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#bbb', fontFamily: 'Inter, sans-serif' }}>{t('adminCompanies.loading')}</div>
  if (!company) return <div style={{ padding: 40, textAlign: 'center', color: '#bbb', fontFamily: 'Inter, sans-serif' }}>{t('adminCompanyDetail.notFound')}</div>

  const members = company.members || []
  const invoices = company.invoices || []
  const paymentMethods = company.payment_methods || []

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Logo forDarkBg onClick={() => navigate('/dashboard')} height={22} />
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span onClick={() => navigate('/admin/companies')} style={{ color: '#888', fontSize: 13, cursor: 'pointer' }}>{t('adminCompanies.title')}</span>
          <span style={{ color: '#666', fontSize: 12 }}>{language === 'ar' ? '‹' : '›'}</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{company.name}</span>
        </div>
        <button onClick={() => navigate('/admin/companies')}
          style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          {language === 'ar' ? '→' : '←'} {t('common.back')}
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>

        {/* Company card */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: ACCENT + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: ACCENT }}>
              {company.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: DARK }}>{company.name}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                {company.member_count === 1
                  ? t('adminCompanies.planLine', { plan: company.plan })
                  : t('adminCompanies.planLinePlural', { plan: company.plan, count: company.member_count })}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: '#555' }}>{t('adminCompanies.trialEnds', { date: fmtDate(company.trial_ends_at, locale) })}</span>
                <span style={{ fontSize: 12, color: '#555' }}>{t('adminCompanies.subEnds', { date: fmtDate(company.subscription_ends_at, locale) })}</span>
                <span style={{ fontSize: 12, color: '#555' }}>{t('adminCompanyDetail.maxUsers', { count: company.max_users })}</span>
                <span style={{ fontSize: 12, color: '#555' }}>{t('adminCompanyDetail.createdAt', { date: fmtDate(company.created_at, locale) })}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={doExtendTrial} disabled={extending}
              style={{ padding: '6px 12px', background: '#F7F4F0', border: '1px solid #E0DAD4', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: DARK }}>
              {extending ? t('adminCompanies.extending') : t('adminCompanies.extendTrial')}
            </button>
            <select value={company.status} onChange={e => updateStatus(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: `1.5px solid ${STATUS_COLORS[company.status]}`, color: STATUS_COLORS[company.status], fontSize: 11, fontWeight: 700, background: '#fff', cursor: 'pointer' }}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{t(STATUS_KEYS[s])}</option>)}
            </select>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140, background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 11, color: '#888' }}>{t('adminCompanyDetail.employees')}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: DARK, marginTop: 4 }}>{company.employee_count ?? 0}</div>
          </div>
          <div style={{ flex: 1, minWidth: 140, background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 11, color: '#888' }}>{t('adminCompanyDetail.clients')}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: DARK, marginTop: 4 }}>{company.client_count ?? 0}</div>
          </div>
          <div style={{ flex: 1, minWidth: 140, background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 11, color: '#888' }}>{t('adminCompanyDetail.members')}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: DARK, marginTop: 4 }}>{company.member_count ?? 0}</div>
          </div>
        </div>

        {/* Members */}
        <div style={{ fontSize: 16, fontWeight: 700, color: DARK, marginBottom: 12 }}>{t('adminCompanyDetail.membersTitle')}</div>
        {members.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, textAlign: 'center', color: '#bbb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 20 }}>
            {t('adminCompanyDetail.noMembers')}
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 20 }}>
            {members.map((m, i) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < members.length - 1 ? '1px solid #F7F4F0' : 'none', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: DARK }}>
                    {(m.first_name || m.last_name) ? `${m.first_name} ${m.last_name}`.trim() : m.email}
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{m.email}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: ACCENT + '18', padding: '3px 8px', borderRadius: 4 }}>
                  {t(ROLE_KEYS[m.role] || m.role)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Invoices */}
        <div style={{ fontSize: 16, fontWeight: 700, color: DARK, marginBottom: 12 }}>{t('adminCompanyDetail.invoicesTitle')}</div>
        {invoices.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, textAlign: 'center', color: '#bbb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 20 }}>
            {t('adminCompanyDetail.noInvoices')}
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 20 }}>
            {invoices.map((inv, i) => (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < invoices.length - 1 ? '1px solid #F7F4F0' : 'none', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: DARK }}>{inv.plan} · {parseFloat(inv.amount).toFixed(2)} {inv.currency}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{fmtDate(inv.created_at, locale)}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: INVOICE_STATUS_COLORS[inv.status] || '#888', background: (INVOICE_STATUS_COLORS[inv.status] || '#888') + '18', padding: '3px 8px', borderRadius: 4 }}>
                  {t(INVOICE_STATUS_KEYS[inv.status] || inv.status)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Payment methods */}
        <div style={{ fontSize: 16, fontWeight: 700, color: DARK, marginBottom: 12 }}>{t('adminCompanyDetail.paymentMethodsTitle')}</div>
        {paymentMethods.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, textAlign: 'center', color: '#bbb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {t('adminCompanyDetail.noPaymentMethods')}
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {paymentMethods.map((pm, i) => (
              <div key={pm.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < paymentMethods.length - 1 ? '1px solid #F7F4F0' : 'none' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: DARK }}>{pm.card_brand} ···{pm.card_last4}</div>
                <span style={{ fontSize: 10, fontWeight: 700, color: pm.is_active ? '#2AC87A' : '#999', background: (pm.is_active ? '#2AC87A' : '#999') + '18', padding: '3px 8px', borderRadius: 4 }}>
                  {pm.is_active ? t('adminCompanyDetail.paymentActive') : t('adminCompanyDetail.paymentInactive')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
