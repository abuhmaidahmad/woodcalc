import { useState, useEffect } from 'react'
function SupplyChainModule() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const token = localStorage.getItem('access_token')
  useEffect(() => {
    fetch('http://localhost:8000/api/supply_chain/purchase-orders/', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setOrders(d.results || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])
  return (
    <div style={{maxWidth:1100,margin:'0 auto'}}>
      <h1 style={{color:'#2c3e50',marginBottom:20}}>Supply Chain</h1>
      {loading ? <p>Loading...</p> : orders.length === 0 ? <p style={{color:'#999'}}>No purchase orders yet.</p> : (
        <div style={{background:'white',borderRadius:8,overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{background:'#ecf0f1'}}>{['PO #','Supplier','Status','Amount','Date'].map(h=><th key={h} style={{padding:12,textAlign:'left'}}>{h}</th>)}</tr></thead>
            <tbody>{orders.map(p=><tr key={p.id} style={{borderBottom:'1px solid #ecf0f1'}}><td style={{padding:12}}>{p.order_number}</td><td style={{padding:12}}>{p.supplier}</td><td style={{padding:12}}>{p.status}</td><td style={{padding:12}}>{p.total_amount} JOD</td><td style={{padding:12,color:'#999'}}>{p.order_date}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
export default SupplyChainModule
