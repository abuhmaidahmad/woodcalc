import { useState, useEffect } from 'react'
function HRModule() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const token = localStorage.getItem('access_token')
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/hr/employees/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setEmployees(d.results || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])
  return (
    <div style={{maxWidth:1100,margin:'0 auto'}}>
      <h1 style={{color:'#2c3e50',marginBottom:20}}>HR Management</h1>
      {loading ? <p>Loading...</p> : employees.length === 0 ? <p style={{color:'#999'}}>No employees yet. Add from Django Admin.</p> : (
        <div style={{background:'white',borderRadius:8,overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,0.1)'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{background:'#ecf0f1'}}>{['Name','Job Title','Department','Email','Status'].map(h=><th key={h} style={{padding:12,textAlign:'left'}}>{h}</th>)}</tr></thead>
            <tbody>{employees.map(e=><tr key={e.id} style={{borderBottom:'1px solid #ecf0f1'}}><td style={{padding:12,fontWeight:600}}>{e.first_name} {e.last_name}</td><td style={{padding:12}}>{e.job_title||'—'}</td><td style={{padding:12}}>{e.department||'—'}</td><td style={{padding:12,color:'#3498db'}}>{e.email||'—'}</td><td style={{padding:12}}><span style={{padding:'3px 10px',borderRadius:20,fontSize:12,background:e.active?'#efe':'#fee',color:e.active?'#3a3':'#c33'}}>{e.active?'ACTIVE':'INACTIVE'}</span></td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
export default HRModule
