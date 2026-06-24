import { useState, useEffect } from 'react'
function ManufacturingModule() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const token = localStorage.getItem('access_token')
  useEffect(() => {
    fetch('http://localhost:8000/api/manufacturing/work-orders/', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setOrders(d.results || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])
  const colors = { NEW:'#3498db', IN_PROGRESS:'#f39c12', COMPLETED:'#2ecc71', CANCELLED:'#e74c3c' }
  return (
    <div style={{maxWidth:1100,margin:'0 auto'}}>
      <h1 style={{color:'#2c3e50',marginBottom:20}}>Manufacturing</h1>
      {loading ? <p>Loading...</p> : orders.length === 0 ? <p style={{color:'#999'}}>No work orders yet. Add from Django Admin at localhost:8000/admin</p> : (
        <div style={{background:'white',borderRadius:8,overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{background:'#ecf0f1'}}>{['Order #','Product','Customer','Qty','Status','Due'].map(h=><th key={h} style={{padding:12,textAlign:'left'}}>{h}</th>)}</tr></thead>
            <tbody>{orders.map(w=><tr key={w.id} style={{borderBottom:'1px solid #ecf0f1'}}><td style={{padding:12}}>{w.order_number}</td><td style={{padding:12}}>{w.product_name}</td><td style={{padding:12}}>{w.customer_name}</td><td style={{padding:12}}>{w.quantity}</td><td style={{padding:12}}><span style={{padding:'3px 10px',borderRadius:20,fontSize:12,background:(colors[w.status]||'#999')+'22',color:colors[w.status]||'#999'}}>{w.status}</span></td><td style={{padding:12,color:'#999'}}>{w.due_date||'—'}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
export default ManufacturingModule
