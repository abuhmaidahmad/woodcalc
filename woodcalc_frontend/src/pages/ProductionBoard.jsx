import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authFetch } from '../api/auth'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'
const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

const STATUS_COLORS = {
  NEW: '#888', IN_PROGRESS: '#2A7AC8', COMPLETED: '#2AC87A', CANCELLED: '#E74C3C',
}

export default function ProductionBoard() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [items, setItems] = useState([])
  const [logs, setLogs] = useState([])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await authFetch(API + '/api/manufacturing/work-orders/')
      const data = await res.json()
      setOrders(Array.isArray(data) ? data : (data.results || []))
    } catch {}
    setLoading(false)
  }

  const fetchStations = async () => {
    try {
      const res = await authFetch(API + '/api/manufacturing/stations/')
      const data = await res.json()
      const list = Array.isArray(data) ? data : (data.results || [])
      setStations(list.sort((a, b) => a.id - b.id))
    } catch {}
  }

  useEffect(() => { fetchOrders(); fetchStations() }, [])

  const openOrder = async (order) => {
    setSelected(order)
    try {
      const [itemsRes, logsRes] = await Promise.all([
        authFetch(API + `/api/manufacturing/work-order-items/?work_order=${order.id}`),
        authFetch(API + `/api/manufacturing/station-logs/?work_order=${order.id}`),
      ])
      const itemsData = await itemsRes.json()
      const logsData = await logsRes.json()
      setItems(Array.isArray(itemsData) ? itemsData : (itemsData.results || []))
      setLogs(Array.isArray(logsData) ? logsData : (logsData.results || []))
    } catch {}
  }

  const updateStatus = async (orderId, status) => {
    try {
      await authFetch(API + `/api/manufacturing/work-orders/${orderId}/`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      fetchOrders()
      if (selected?.id === orderId) setSelected(s => ({ ...s, status }))
    } catch {}
  }

  const startStation = async (stationId) => {
    if (!selected) return
    try {
      await authFetch(API + '/api/manufacturing/station-logs/', {
        method: 'POST',
        body: JSON.stringify({ work_order: selected.id, station: stationId, started_at: new Date().toISOString() }),
      })
      openOrder(selected)
      if (selected.status === 'NEW') updateStatus(selected.id, 'IN_PROGRESS')
    } catch {}
  }

  const endStation = async (logId) => {
    try {
      await authFetch(API + `/api/manufacturing/station-logs/${logId}/`, {
        method: 'PATCH',
        body: JSON.stringify({ ended_at: new Date().toISOString() }),
      })
      openOrder(selected)
    } catch {}
  }

  const getStationStatus = (stationId) => {
    const log = logs.find(l => l.station === stationId)
    if (!log) return 'pending'
    if (log.started_at && !log.ended_at) return 'active'
    if (log.ended_at) return 'done'
    return 'pending'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F4F0', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ height: 56, background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: ACCENT, fontWeight: 800, fontSize: 18 }}>WoodCalc</span>
          <span style={{ color: '#666', fontSize: 12 }}>|</span>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Production Board</span>
        </div>
        <button onClick={() => navigate('/dashboard')}
          style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          ← Dashboard
        </button>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 56px)' }}>
        {/* Orders list */}
        <div style={{ width: 360, borderRight: '1px solid #E0DAD4', overflow: 'auto', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 12 }}>{orders.length} Work Orders</div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>Loading...</div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>No work orders yet</div>
          ) : (
            orders.map(o => (
              <div key={o.id} onClick={() => openOrder(o)}
                style={{ background: '#fff', borderRadius: 10, padding: 14, marginBottom: 10, cursor: 'pointer', border: selected?.id === o.id ? `2px solid ${ACCENT}` : '1.5px solid #E0DAD4' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: DARK }}>{o.order_number}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLORS[o.status], background: STATUS_COLORS[o.status] + '18', padding: '2px 8px', borderRadius: 4 }}>
                    {o.status.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>{o.product_name}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{o.customer_name} · {o.quantity} cabinets</div>
              </div>
            ))
          )}
        </div>

        {/* Order detail */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {!selected ? (
            <div style={{ textAlign: 'center', padding: 80, color: '#bbb' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏭</div>
              <div>Select a work order to view details</div>
            </div>
          ) : (
            <div style={{ maxWidth: 900 }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: DARK }}>{selected.order_number}</div>
                    <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{selected.product_name}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Customer: <strong style={{ color: DARK }}>{selected.customer_name}</strong></div>
                  </div>
                  <select value={selected.status} onChange={e => updateStatus(selected.id, e.target.value)}
                    style={{ padding: '6px 12px', border: `2px solid ${STATUS_COLORS[selected.status]}`, borderRadius: 6, fontSize: 11, fontWeight: 700, color: STATUS_COLORS[selected.status], background: STATUS_COLORS[selected.status] + '15', outline: 'none', cursor: 'pointer' }}>
                    {['NEW', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>

              {/* Station tracker */}
              <div style={{ background: '#fff', borderRadius: 14, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: DARK, marginBottom: 16 }}>Station Progress</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stations.map(st => {
                    const status = getStationStatus(st.id)
                    const log = logs.find(l => l.station === st.id)
                    return (
                      <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: status === 'active' ? ACCENT + '12' : status === 'done' ? '#2AC87A12' : '#FAFAFA', border: `1.5px solid ${status === 'active' ? ACCENT : status === 'done' ? '#2AC87A' : '#E0DAD4'}` }}>
                        <span style={{ fontSize: 18 }}>{status === 'done' ? '✅' : status === 'active' ? '🔧' : '⬜'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: DARK }}>{st.name}</div>
                          {log?.started_at && <div style={{ fontSize: 10, color: '#888' }}>Started: {new Date(log.started_at).toLocaleString('en-GB')}{log.ended_at ? ` · Ended: ${new Date(log.ended_at).toLocaleString('en-GB')}` : ''}</div>}
                        </div>
                        {status === 'pending' && (
                          <button onClick={() => startStation(st.id)}
                            style={{ padding: '6px 14px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                            Start
                          </button>
                        )}
                        {status === 'active' && (
                          <button onClick={() => endStation(log.id)}
                            style={{ padding: '6px 14px', background: '#2AC87A', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                            Complete
                          </button>
                        )}
                        {status === 'done' && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#2AC87A' }}>Done</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Cut list items */}
              <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0EBE5', fontWeight: 700, fontSize: 13, color: DARK }}>Cut List ({items.length} items)</div>
                {items.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: '#bbb', fontSize: 12 }}>No items attached</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#FAFAFA' }}>
                      {['Description', 'Qty', 'Unit'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#888' }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {items.map(it => (
                        <tr key={it.id} style={{ borderBottom: '1px solid #F7F4F0' }}>
                          <td style={{ padding: '10px 16px', fontSize: 12, color: DARK }}>{it.description}</td>
                          <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: ACCENT }}>{it.quantity}</td>
                          <td style={{ padding: '10px 16px', fontSize: 12, color: '#888' }}>{it.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
