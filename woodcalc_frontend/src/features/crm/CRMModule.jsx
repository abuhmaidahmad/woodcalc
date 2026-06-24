import { useState, useEffect } from 'react'
function CRMModule() {
  const [clients, setClients] = useState([])
  const [leads, setLeads] = useState([])
  const [tab, setTab] = useState('clients')
  const [loading, setLoading] = useState(true)
  const token = localStorage.getItem('access_token')
  useEffect(() => {
    Promise.all([
      fetch('http://localhost:8000/api/crm/clients/', { headers: { Authorization: `Bearer ${token}` } }).then(r=>r.json()),
      fetch('http://localhost:8000/api/crm/leads/', { headers: { Authorization: `Bearer ${token}` } }).then(r=>r.json())
    ]).then(([c,l])=>{ setClients(c.results||[]); setLeads(l.results||[]); setLoading(false) })
    .catch(()=>setLoading(false))
  }, [])
  return (
    <div style={{maxWidth:1100,margin:'0 auto'}}>
      <h1 style={{color:'#2c3e50',marginBottom:20}}>CRM</h1>
      <div style={{display:'flex',gap:10,marginBottom:20}}>
        <button onClick={()=>setTab('clients')} style={{padding:'10px 20px',background:tab==='clients'?'#9b59b6':'#bdc3c7',color:'white',border:'none',borderRadius:6,cursor:'pointer'}}>Clients ({clients.length})</button>
        <button onClick={()=>setTab('leads')} style={{padding:'10px 20px',background:tab==='leads'?'#9b59b6':'#bdc3c7',color:'white',border:'none',borderRadius:6,cursor:'pointer'}}>Leads ({leads.length})</button>
      </div>
      {loading ? <p>Loading...</p> : (
        <div style={{background:'white',borderRadius:8,overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{background:'#ecf0f1'}}>{(tab==='clients'?['Name','Company','Email','Phone','Status']:['Name','Email','Phone','Source','Status']).map(h=><th key={h} style={{padding:12,textAlign:'left'}}>{h}</th>)}</tr></thead>
            <tbody>
              {tab==='clients' && (clients.length===0?<tr><td colSpan={5} style={{padding:20,textAlign:'center',color:'#999'}}>No clients yet.</td></tr>:clients.map(c=><tr key={c.id} style={{borderBottom:'1px solid #ecf0f1'}}><td style={{padding:12,fontWeight:600}}>{c.name}</td><td style={{padding:12}}>{c.company||'—'}</td><td style={{padding:12,color:'#3498db'}}>{c.email||'—'}</td><td style={{padding:12}}>{c.phone||'—'}</td><td style={{padding:12}}><span style={{padding:'3px 10px',borderRadius:20,fontSize:12,background:c.active?'#efe':'#fee',color:c.active?'#3a3':'#c33'}}>{c.active?'ACTIVE':'INACTIVE'}</span></td></tr>))}
              {tab==='leads' && (leads.length===0?<tr><td colSpan={5} style={{padding:20,textAlign:'center',color:'#999'}}>No leads yet.</td></tr>:leads.map(l=><tr key={l.id} style={{borderBottom:'1px solid #ecf0f1'}}><td style={{padding:12,fontWeight:600}}>{l.name}</td><td style={{padding:12,color:'#3498db'}}>{l.email||'—'}</td><td style={{padding:12}}>{l.phone||'—'}</td><td style={{padding:12}}>{l.source||'—'}</td><td style={{padding:12}}><span style={{padding:'3px 10px',borderRadius:20,fontSize:12,background:'#9b59b622',color:'#9b59b6'}}>{l.status}</span></td></tr>))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
export default CRMModule
