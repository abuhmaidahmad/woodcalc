import { useState } from 'react'
import InventoryModule from './features/inventory/InventoryModule'
import ManufacturingModule from './features/manufacturing/ManufacturingModule'
import SupplyChainModule from './features/supply_chain/SupplyChainModule'
import HRModule from './features/hr/HRModule'
import CRMModule from './features/crm/CRMModule'
import KitchenPlannerModule from './features/kitchen_planner/KitchenPlannerModule'

function LoginPage({ setToken }) {
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')
  const login = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login/`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:u,password:p}) })
      const data = await res.json()
      if (data.access) { localStorage.setItem('access_token', data.access); setToken(data.access) }
      else setErr('Invalid credentials')
    } catch { setErr('Cannot connect to server') }
  }
  return (
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',background:'#2c3e50'}}>
      <div style={{background:'white',padding:40,borderRadius:12,width:360}}>
        <h1 style={{textAlign:'center',marginBottom:8}}>🪵 WoodCalc ERP</h1>
        <p style={{textAlign:'center',color:'#666',marginBottom:24}}>Jordan Cabinet Manufacturing</p>
        <form onSubmit={login}>
          <input style={{width:'100%',padding:10,marginBottom:12,border:'1px solid #ddd',borderRadius:6,fontSize:14,boxSizing:'border-box'}} placeholder="Username" value={u} onChange={e=>setU(e.target.value)} />
          <input style={{width:'100%',padding:10,marginBottom:12,border:'1px solid #ddd',borderRadius:6,fontSize:14,boxSizing:'border-box'}} type="password" placeholder="Password" value={p} onChange={e=>setP(e.target.value)} />
          {err && <p style={{color:'red',marginBottom:8}}>{err}</p>}
          <button style={{width:'100%',padding:12,background:'#2c3e50',color:'white',border:'none',borderRadius:6,fontSize:16,cursor:'pointer'}} type="submit">Login</button>
        </form>
        <p style={{textAlign:'center',marginTop:16,color:'#999',fontSize:12}}>admin / admin123</p>
      </div>
    </div>
  )
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('access_token'))
  const [sel, setSel] = useState('planner')
  if (!token) return <LoginPage setToken={setToken} />
  const modules = [
    { id:'planner',       label:'🏠 Kitchen Planner', color:'#27ae60', component:KitchenPlannerModule },
    { id:'inventory',     label:'📦 Inventory',        color:'#3498db', component:InventoryModule },
    { id:'manufacturing', label:'🏭 Manufacturing',    color:'#e74c3c', component:ManufacturingModule },
    { id:'supply_chain',  label:'🚚 Supply Chain',     color:'#2ecc71', component:SupplyChainModule },
    { id:'hr',            label:'👥 HR',               color:'#f39c12', component:HRModule },
    { id:'crm',           label:'🤝 CRM',              color:'#9b59b6', component:CRMModule },
  ]
  const cur = modules.find(m => m.id === sel)
  const Component = cur.component
  return (
    <div style={{display:'flex',height:'100vh',fontFamily:'sans-serif'}}>
      <div style={{width:220,background:'#2c3e50',color:'white',padding:20,display:'flex',flexDirection:'column',flexShrink:0}}>
        <h2 style={{marginBottom:4,fontSize:18}}>🪵 WoodCalc</h2>
        <p style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginBottom:24}}>ERP + Kitchen Planner</p>
        {modules.map(m=>(
          <div key={m.id} onClick={()=>setSel(m.id)} style={{padding:'12px 16px',marginBottom:6,background:sel===m.id?m.color:'rgba(255,255,255,0.1)',borderRadius:8,cursor:'pointer',fontSize:13,borderLeft:sel===m.id?'3px solid white':'3px solid transparent',transition:'all 0.15s'}}>
            {m.label}
          </div>
        ))}
        <div style={{marginTop:'auto',padding:'12px 16px',background:'rgba(231,76,60,0.3)',borderRadius:8,cursor:'pointer',fontSize:13}} onClick={()=>{ localStorage.clear(); setToken(null) }}>
          🚪 Logout
        </div>
      </div>
      <div style={{flex:1,padding:24,background:'#f8f5f1',overflowY:'auto',display:'flex',flexDirection:'column'}}>
        <Component />
      </div>
    </div>
  )
}
export default App
