import { useState, useEffect } from 'react'
function InventoryModule() {
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const token = localStorage.getItem('access_token')
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/inventory/materials/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setMaterials(d.results || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])
  return (
    <div style={{maxWidth:1100,margin:'0 auto'}}>
      <h1 style={{color:'#2c3e50',marginBottom:20}}>📦 Inventory Management</h1>
      {loading ? <p>Loading...</p> : (
        <div style={{background:'white',borderRadius:8,overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{background:'#ecf0f1'}}>
              {['SKU','Name','Unit','Qty On Hand','Reorder Level','Status'].map(h => <th key={h} style={{padding:12,textAlign:'left',fontWeight:600}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {materials.length === 0 ? <tr><td colSpan={6} style={{padding:20,textAlign:'center',color:'#999'}}>No materials yet. Add from Django Admin.</td></tr>
              : materials.map(m => <tr key={m.id} style={{borderBottom:'1px solid #ecf0f1'}}>
                <td style={{padding:12}}><code style={{background:'#f5f5f5',padding:'3px 7px',borderRadius:4}}>{m.sku}</code></td>
                <td style={{padding:12}}>{m.name}</td>
                <td style={{padding:12}}>{m.unit}</td>
                <td style={{padding:12,fontWeight:600}}>{m.quantity_on_hand}</td>
                <td style={{padding:12}}>{m.reorder_level}</td>
                <td style={{padding:12}}><span style={{padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:600,background:m.quantity_on_hand<=m.reorder_level?'#fee':'#efe',color:m.quantity_on_hand<=m.reorder_level?'#c33':'#3a3'}}>{m.quantity_on_hand<=m.reorder_level?'LOW STOCK':'OK'}</span></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
export default InventoryModule
