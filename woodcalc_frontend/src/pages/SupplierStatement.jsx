import React, { useState, useEffect } from 'react'
import Logo from '../components/Logo'
import { authFetch } from '../api/auth'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from '../i18n/LanguageContext'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'
const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

const STATUS_KEYS = {
  draft: 'common.poStatusDraft', sent: 'common.poStatusSent', confirmed: 'common.poStatusConfirmed',
  partially_received: 'common.poStatusPartiallyReceived', received: 'common.poStatusReceived',
  closed: 'common.poStatusClosed', cancelled: 'common.poStatusCancelled',
}

export default function SupplierStatement() {
  const { id } = useParams()
  const { t, language } = useTranslation()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const fetchStatement = async () => {
    setLoading(true)
    try {
      const res = await authFetch(API + `/api/inventory/suppliers/${id}/statement/`)
      if (res.status === 401) { navigate('/login'); return }
      const json = await res.json()
      setData(json)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchStatement() }, [id])

  if (loading || !data) {
    return <div style={{ minHeight: '100vh', background: '#F7F4F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}>{t('common.loading')}</div>
  }

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Logo forDarkBg onClick={() => navigate('/dashboard')} height={22} />
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span onClick={() => navigate('/suppliers')} style={{ color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>{t('common.navSuppliers')}</span>
          <span style={{ color: '#666', fontSize: 12 }}>{language === 'ar' ? '‹' : '›'}</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{data.supplier_name}</span>
        </div>
        <button onClick={() => navigate('/suppliers')}
          style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          {t('supplierStatement.backToSuppliers')}
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: DARK, marginBottom: 20 }}>{data.supplier_name} — {t('supplierStatement.accountStatement')}</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{t('supplierStatement.totalOrdered')}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: DARK }}>{data.total_ordered}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{t('supplierStatement.totalPaid')}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#3a3' }}>{data.total_paid}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{t('supplierStatement.balanceDue')}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: data.total_balance > 0 ? DARK : '#3a3' }}>{data.total_balance}</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{t('supplierStatement.overduePOs')}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: data.overdue_count > 0 ? '#c33' : DARK }}>{data.overdue_count}</div>
          </div>
        </div>

        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: DARK }}>{t('supplierStatement.purchaseOrders')}</h2>

        {(!data.purchase_orders || data.purchase_orders.length === 0) ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb', background: '#fff', borderRadius: 12 }}>
            {t('supplierStatement.noOrders')}
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {data.purchase_orders.map((po, i) => (
              <div key={po.id} onClick={() => navigate(`/purchase-orders/${po.id}`)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: i < data.purchase_orders.length - 1 ? '1px solid #F7F4F0' : 'none', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#FDFAF6'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: DARK }}>{po.po_number}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    {STATUS_KEYS[po.status] ? t(STATUS_KEYS[po.status]) : po.status} · {t('supplierStatement.ordered')} {po.order_date}
                    {po.payment_due_date ? ` · ${t('supplierStatement.due')} ${po.payment_due_date}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'end' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: DARK }}>{po.total_amount}</div>
                  <div style={{ fontSize: 11, marginTop: 2 }}>
                    {po.balance_due > 0 ? (
                      <span style={{ color: po.is_payment_overdue ? '#c33' : '#888' }}>
                        {po.is_payment_overdue ? t('supplierStatement.overdue') + ' ' : ''}{t('supplierStatement.balance')} {po.balance_due}
                      </span>
                    ) : (
                      <span style={{ color: '#3a3' }}>{t('supplierStatement.paidInFull')}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
