import { useState, useRef, useCallback } from 'react'
import { calculateCabinet } from './formulaEngine'
import ZonePresetPicker from './ZonePresetPicker'
import KitchenPlanner3D from './KitchenPlanner3D'

const SCALE = 0.12
const COLORS = [
  { name:'White', hex:'#FFFFFF' },
  { name:'Cream', hex:'#F5F0E8' },
  { name:'Graphite', hex:'#4A4A4A' },
  { name:'Oak', hex:'#C8A96E' },
  { name:'Walnut', hex:'#7B5B3A' },
  { name:'Navy', hex:'#1B3A5C' },
]
const CATALOG = [
  { type:'base_600', label:'Base 600', width:600, height:720, depth:560, icon:'🗄' },
  { type:'base_900', label:'Base 900', width:900, height:720, depth:560, icon:'🗄' },
  { type:'base_1200', label:'Base 1200', width:1200, height:720, depth:560, icon:'🗄' },
  { type:'sink_800', label:'Sink 800', width:800, height:720, depth:560, icon:'🚿' },
  { type:'corner_900', label:'Corner 900', width:900, height:720, depth:900, icon:'📐' },
  { type:'drawers_450', label:'Drawers 450', width:450, height:720, depth:560, icon:'📦' },
  { type:'wall_600', label:'Wall 600', width:600, height:720, depth:350, icon:'🔲' },
  { type:'wall_900', label:'Wall 900', width:900, height:720, depth:350, icon:'🔲' },
]

function aggregateBOM(cabinets) {
  const totals = { sheet18:0, hdf8:0, edgeM:0, hinges:0, legs:0, confirmats:0, dowels:0, backScrews:0, handles:0 }
  cabinets.forEach(cab => {
    const cfg = { width:cab.width, height:cab.height, depth:cab.depth, material:cab.material, doorStyle:cab.doorStyle, shelves:0 }
    const r = calculateCabinet(cfg)
    const panelArea = r.panels.filter(p=>p.thickness===18).reduce((s,p)=>s+(p.width*p.depth*p.qty/1e6),0)
    const hdfArea = r.panels.filter(p=>p.thickness===8).reduce((s,p)=>s+(p.width*p.depth*p.qty/1e6),0)
    const edgeM = (2*cab.height + (cab.width-36) + r.doors.reduce((s,d)=>s+2*(d.width+d.height),0))/1000
    totals.sheet18 += panelArea
    totals.hdf8 += hdfArea
    totals.edgeM += edgeM
    totals.hinges += r.doors.reduce((s,d)=>s+d.hinges,0)
    totals.legs += r.hardware.legs
    totals.confirmats += r.hardware.confirmats
    totals.dowels += r.hardware.dowels
    totals.backScrews += r.hardware.back_screws
    totals.handles += r.hardware.handles
  })
  Object.keys(totals).forEach(k=>{ totals[k]=parseFloat(totals[k].toFixed(2)) })
  return totals
}

export default function KitchenPlannerModule() {
  const [cabinets, setCabinets] = useState([])
  const [selected, setSelected] = useState(null)
  const [room, setRoom] = useState({ width:4000, depth:3000 })
  const [dragging, setDragging] = useState(null)
  const [offset, setOffset] = useState({x:0,y:0})
  const [tab, setTab] = useState('planner')
  const [sending, setSending] = useState(false)
  const [sentMsg, setSentMsg] = useState('')
  const canvasRef = useRef(null)

  const addCabinet = (t) => {
    const cab = { ...t, id:Date.now(), x:50, y:50, material:'Particleboard', doorStyle:'Handle', carcassColor:'#F5F0E8', frontColor:'#FFFFFF', zonePreset:null }
    setCabinets(p=>[...p,cab])
    setSelected(cab.id)
  }

  const update = (key,val) => setCabinets(p=>p.map(c=>c.id===selected?{...c,[key]:val}:c))

  const onMouseDown = (e,id) => {
    e.stopPropagation()
    const rect = canvasRef.current.getBoundingClientRect()
    const cab = cabinets.find(c=>c.id===id)
    setDragging(id); setSelected(id)
    setOffset({ x:e.clientX-rect.left-cab.x*SCALE, y:e.clientY-rect.top-cab.y*SCALE })
  }

  const onMouseMove = useCallback((e) => {
    if (!dragging) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = Math.max(0,(e.clientX-rect.left-offset.x)/SCALE)
    const y = Math.max(0,(e.clientY-rect.top-offset.y)/SCALE)
    setCabinets(p=>p.map(c=>c.id===dragging?{...c,x,y}:c))
  },[dragging,offset])

  const selCab = cabinets.find(c=>c.id===selected)
  const bom = aggregateBOM(cabinets)

  const sendToERP = async () => {
    if (!cabinets.length) return
    setSending(true); setSentMsg('')
    const API_BASE = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'
    const orderNumber = 'WO-KP-' + Date.now()
    try {
      const res = await fetch(API_BASE + '/api/manufacturing/work-orders/', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+localStorage.getItem('access_token') },
        body:JSON.stringify({ order_number:orderNumber, product_name:'Kitchen Project ('+cabinets.length+' cabinets)', customer_name:'Kitchen Planner', quantity:cabinets.length, status:'NEW' })
      })
      if (res.ok) setSentMsg('✅ Work Order '+orderNumber+' created!')
      else setSentMsg('❌ Failed ('+res.status+')')
    } catch { setSentMsg('❌ Cannot connect') }
    setSending(false)
  }

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexShrink:0}}>
        <div>
          <h1 style={{margin:0,fontSize:20,color:'#2c3e50'}}>🏠 Kitchen Planner</h1>
          <p style={{margin:0,fontSize:12,color:'#999'}}>{cabinets.length} cabinets on canvas</p>
        </div>
      </div>
      <div style={{display:'flex',gap:8,marginBottom:12,flexShrink:0}}>
        {[['planner','🏠 2D Planner'],['3d','🎮 3D View'],['bom','📋 BOM Summary']].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:'8px 18px',background:tab===id?'#3498db':'#ecf0f1',color:tab===id?'white':'#666',border:'none',borderRadius:6,cursor:'pointer',fontWeight:tab===id?700:400}}>{label}</button>
        ))}
      </div>

      {tab==='planner' && (
        <div style={{display:'flex',gap:12,flex:1,overflow:'hidden'}}>
          <div style={{width:150,flexShrink:0,overflowY:'auto'}}>
            <div style={{fontSize:11,fontWeight:700,color:'#999',textTransform:'uppercase',marginBottom:8}}>Catalog</div>
            {CATALOG.map(t=>(
              <div key={t.type} onClick={()=>addCabinet(t)} style={{background:'white',border:'1.5px solid #e0e0e0',borderRadius:8,padding:'8px 10px',marginBottom:6,cursor:'pointer'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor='#3498db'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='#e0e0e0'}>
                <div style={{fontSize:18}}>{t.icon}</div>
                <div style={{fontSize:11,fontWeight:700,color:'#2c3e50'}}>{t.label}</div>
                <div style={{fontSize:10,color:'#999'}}>{t.width}mm</div>
              </div>
            ))}
          </div>

          <div style={{flex:1,overflow:'auto',background:'#f0f0f0',borderRadius:8,padding:12}}>
            <div style={{marginBottom:8,display:'flex',gap:12,alignItems:'center'}}>
              <label style={{fontSize:12}}>Room W: <input type="number" value={room.width} onChange={e=>setRoom(r=>({...r,width:+e.target.value}))} style={{width:65,padding:'2px 6px',border:'1px solid #ddd',borderRadius:4,fontSize:12}} /></label>
              <label style={{fontSize:12}}>Room D: <input type="number" value={room.depth} onChange={e=>setRoom(r=>({...r,depth:+e.target.value}))} style={{width:65,padding:'2px 6px',border:'1px solid #ddd',borderRadius:4,fontSize:12}} /></label>
            </div>
            <div ref={canvasRef} onMouseMove={onMouseMove} onMouseUp={()=>setDragging(null)} onMouseLeave={()=>setDragging(null)}
              onClick={e=>{if(e.target===canvasRef.current)setSelected(null)}}
              style={{width:room.width*SCALE,height:room.depth*SCALE,background:'white',border:'2px solid #2c3e50',borderRadius:4,position:'relative',cursor:'crosshair'}}>
              {cabinets.map(cab=>(
                <div key={cab.id} onMouseDown={e=>onMouseDown(e,cab.id)}
                  style={{position:'absolute',left:cab.x*SCALE,top:cab.y*SCALE,width:cab.width*SCALE,height:cab.depth*SCALE,
                    background:cab.carcassColor,border:`2px solid ${selected===cab.id?'#3498db':'#888'}`,borderRadius:3,cursor:'grab',
                    display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',userSelect:'none',overflow:'hidden'}}>
                  <div style={{fontSize:9,fontWeight:700,color:'#333',textAlign:'center'}}>{cab.label}</div>
                  <div style={{fontSize:8,color:'#666'}}>{cab.width}mm</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{width:190,flexShrink:0,overflowY:'auto'}}>
            {selCab ? (
              <div style={{background:'white',borderRadius:8,padding:12,border:'1.5px solid #e0e0e0'}}>
                <div style={{fontWeight:700,fontSize:13,color:'#2c3e50',marginBottom:10}}>{selCab.label}</div>
                {[['Width (mm)','width'],['Height (mm)','height'],['Depth (mm)','depth']].map(([label,key])=>(
                  <div key={key} style={{marginBottom:8}}>
                    <div style={{fontSize:11,color:'#666',marginBottom:2}}>{label}</div>
                    <input type="number" value={selCab[key]} onChange={e=>update(key,+e.target.value)}
                      style={{width:'100%',padding:'5px 7px',border:'1px solid #ddd',borderRadius:4,fontSize:12,boxSizing:'border-box'}} />
                  </div>
                ))}
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:11,color:'#666',marginBottom:2}}>Material</div>
                  <select value={selCab.material} onChange={e=>update('material',e.target.value)} style={{width:'100%',padding:'5px',border:'1px solid #ddd',borderRadius:4,fontSize:12}}>
                    {['Particleboard','Plywood','MDF'].map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:11,color:'#666',marginBottom:2}}>Door Style</div>
                  <select value={selCab.doorStyle} onChange={e=>update('doorStyle',e.target.value)} style={{width:'100%',padding:'5px',border:'1px solid #ddd',borderRadius:4,fontSize:12}}>
                    {['Handle','Gola','Push'].map(d=><option key={d}>{d}</option>)}
                  </select>
                </div>
                <div style={{marginBottom:8}}>
                  <ZonePresetPicker height={selCab.height} selected={selCab.zonePreset} onChange={p=>update('zonePreset',p)} />
                </div>
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:11,color:'#666',marginBottom:4}}>Carcass Color</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                    {COLORS.map(c=><div key={c.hex} title={c.name} onClick={()=>update('carcassColor',c.hex)}
                      style={{width:22,height:22,borderRadius:4,background:c.hex,border:selCab.carcassColor===c.hex?'2.5px solid #3498db':'1.5px solid #ccc',cursor:'pointer'}} />)}
                  </div>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:'#666',marginBottom:4}}>Front Color</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                    {COLORS.map(c=><div key={c.hex} title={c.name} onClick={()=>update('frontColor',c.hex)}
                      style={{width:22,height:22,borderRadius:4,background:c.hex,border:selCab.frontColor===c.hex?'2.5px solid #3498db':'1.5px solid #ccc',cursor:'pointer'}} />)}
                  </div>
                </div>
                <button onClick={()=>{setCabinets(p=>p.filter(c=>c.id!==selected));setSelected(null)}}
                  style={{width:'100%',padding:8,background:'#e74c3c',color:'white',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>
                  🗑 Delete
                </button>
              </div>
            ) : (
              <div style={{color:'#bbb',fontSize:12,textAlign:'center',paddingTop:40}}>
                <div style={{fontSize:28,marginBottom:8}}>👆</div>
                Click a cabinet to configure
              </div>
            )}
          </div>
        </div>
      )}

      {tab==='bom' && (
        <div style={{flex:1,overflow:'auto'}}>
          {!cabinets.length ? (
            <div style={{textAlign:'center',paddingTop:60,color:'#bbb'}}>
              <div style={{fontSize:48,marginBottom:12}}>🏠</div>
              <div>Add cabinets in the 2D Planner first</div>
            </div>
          ) : (
            <div style={{maxWidth:800}}>
              <div style={{background:'white',borderRadius:12,padding:20,boxShadow:'0 2px 8px rgba(0,0,0,0.08)',marginBottom:16}}>
                <h2 style={{color:'#2c3e50',marginBottom:16,fontSize:18}}>📋 BOM — {cabinets.length} Cabinets</h2>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
                  {[['18mm Sheet',bom.sheet18+' m²','#3498db'],['8mm HDF',bom.hdf8+' m²','#e67e22'],['Edge Banding',bom.edgeM+' m','#9b59b6'],
                    ['Hinges (Blum)',bom.hinges+' pcs','#2ecc71'],['Legs',bom.legs+' pcs','#1abc9c'],['Confirmats',bom.confirmats+' pcs','#e74c3c'],
                    ['Dowels',bom.dowels+' pcs','#f39c12'],['Back Screws',bom.backScrews+' pcs','#95a5a6'],['Handles',bom.handles+' pcs','#34495e']
                  ].map(([label,val,color])=>(
                    <div key={label} style={{background:'#f8f9fa',borderRadius:8,padding:'12px 14px',borderLeft:'4px solid '+color}}>
                      <div style={{fontSize:11,color:'#666',marginBottom:3}}>{label}</div>
                      <div style={{fontSize:17,fontWeight:800,color:'#2c3e50'}}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginBottom:16}}>
                  <button onClick={sendToERP} disabled={sending} style={{padding:'12px 24px',background:'#2ecc71',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:14}}>
                    {sending?'Sending...':'📤 Send to Manufacturing'}
                  </button>
                  {sentMsg && <span style={{marginLeft:12,fontSize:13}}>{sentMsg}</span>}
                </div>
              </div>
              <div style={{background:'white',borderRadius:12,padding:20,boxShadow:'0 2px 8px rgba(0,0,0,0.08)'}}>
                <h3 style={{marginBottom:12,fontSize:15,color:'#2c3e50'}}>Cabinet List</h3>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr style={{background:'#f8f9fa'}}>
                    {['#','Type','WxHxD','Material','Door Style','Carcass','Front'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',fontSize:11,fontWeight:600,color:'#666'}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {cabinets.map((c,i)=>(
                      <tr key={c.id} style={{borderBottom:'1px solid #f0f0f0'}}>
                        <td style={{padding:'8px 10px',fontSize:12,color:'#999'}}>{i+1}</td>
                        <td style={{padding:'8px 10px',fontSize:12,fontWeight:600}}>{c.label}</td>
                        <td style={{padding:'8px 10px',fontSize:11,color:'#666'}}>{c.width}×{c.height}×{c.depth}</td>
                        <td style={{padding:'8px 10px',fontSize:12}}>{c.material}</td>
                        <td style={{padding:'8px 10px',fontSize:12}}>{c.doorStyle}</td>
                        <td style={{padding:'8px 10px'}}><div style={{width:18,height:18,borderRadius:3,background:c.carcassColor,border:'1px solid #ddd'}} /></td>
                        <td style={{padding:'8px 10px'}}><div style={{width:18,height:18,borderRadius:3,background:c.frontColor,border:'1px solid #ddd'}} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab==='3d' && (
        <div style={{flex:1}}>
          <KitchenPlanner3D cabinets={cabinets} room={room} />
          {!cabinets.length && (
            <div style={{textAlign:'center',paddingTop:20,color:'#999',fontSize:13}}>
              Add cabinets in the 2D Planner to see them in 3D
            </div>
          )}
        </div>
      )}
    </div>
  )
}
