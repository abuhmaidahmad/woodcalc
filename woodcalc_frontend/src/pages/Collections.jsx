import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authFetch } from '../api/auth'

const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'
const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('access')}`,
})

export default function Collections() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(API + '/api/crm/transactions/collections/', { headers: headers() })
        const d = await res.json()
        setRows(Array.isArray(d) ? d : [])
      } finally { setLoading(false) }
    })()
  }, [])

  const totOut = rows.reduce((s, r) => s + parseFloat(r.outstanding || 0), 0)
  const allCheques = rows.flatMap(r => r.pending_cheques.map(c => ({ ...c, project: r.project, project_id: r.project_id })))
    .sort((a, b) => (a.cheque_due_date || '').localeCompare(b.cheque_due_date || ''))
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div style={{ minHeight: '100vh', background: '#F7F4F0', padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: DARK }}>Collections</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            Total outstanding: <b style={{ color: '#C62828' }}>{totOut.toFixed(2)} JD</b> across {rows.filter(r => parseFloat(r.outstanding) > 0).length} projects
          </div>
        </div>
        <button onClick={() => navigate('/customers')}
          style={{ padding: '8px 14px', background: '#fff', border: '1.5px solid #E0DAD4', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#666' }}>
          ← Customers
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#bbb' }}>Loading…</div>
      ) : (
        <>
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 20 }}>
            <div style={{ padding: '12px 16px', fontWeight: 800, color: DARK, fontSize: 14, borderBottom: '1px solid #F7F4F0' }}>Outstanding by Project</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  {['Project', 'Contract Value', 'Collected', 'Outstanding', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#888' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.filter(r => parseFloat(r.total_value) > 0 || parseFloat(r.collected) > 0).map(r => (
                  <tr key={r.project_id} style={{ borderBottom: '1px solid #F7F4F0' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: DARK }}>{r.project}</td>
                    <td style={{ padding: '12px 16px', color: '#888' }}>{parseFloat(r.total_value).toFixed(2)} JD</td>
                    <td style={{ padding: '12px 16px', color: '#2E7D32', fontWeight: 700 }}>{parseFloat(r.collected).toFixed(2)} JD</td>
                    <td style={{ padding: '12px 16px', color: parseFloat(r.outstanding) > 0 ? '#C62828' : '#2E7D32', fontWeight: 700 }}>{parseFloat(r.outstanding).toFixed(2)} JD</td>
                    <td style={{ padding: '12px 16px' }}>
                      <button onClick={() => navigate(`/projects/${r.project_id}`)}
                        style={{ padding: '5px 10px', background: ACCENT + '15', color: ACCENT, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '12px 16px', fontWeight: 800, color: DARK, fontSize: 14, borderBottom: '1px solid #F7F4F0' }}>
              Pending Cheques <span style={{ color: '#888', fontWeight: 500, fontSize: 12 }}>({allCheques.length})</span>
            </div>
            {allCheques.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#bbb', fontSize: 12 }}>No pending cheques</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAFAFA' }}>
                    {['Due Date', 'Amount', 'Cheque No.', 'Bank', 'Project', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#888' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allCheques.map(c => {
                    const overdue = c.cheque_due_date && c.cheque_due_date < today
                    const dueSoon = c.cheque_due_date && !overdue && c.cheque_due_date <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid #F7F4F0', background: overdue ? '#C6282808' : 'transparent' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: overdue ? '#C62828' : dueSoon ? '#B8860B' : DARK }}>
                          {c.cheque_due_date || '—'}{overdue ? ' ⚠' : ''}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: DARK }}>{parseFloat(c.amount).toFixed(2)} {c.currency}</td>
                        <td style={{ padding: '12px 16px', color: '#888' }}>{c.cheque_number}</td>
                        <td style={{ padding: '12px 16px', color: '#888' }}>{c.cheque_bank || '—'}</td>
                        <td style={{ padding: '12px 16px', color: '#888', fontSize: 12 }}>{c.project}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#B8860B', background: '#B8860B18', padding: '3px 8px', borderRadius: 4 }}>{c.cheque_status}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
