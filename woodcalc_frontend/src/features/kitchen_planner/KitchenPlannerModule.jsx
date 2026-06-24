import { useState, useRef, useCallback } from 'react'

const T = 18
const SCALE = 0.12

const CABINET_CATALOG = [
  { type:'base_single', label:'Base 600', width:600, height:720, depth:560, doors:1, icon:'🗄' },
  { type:'base_double', label:'Base 900', width:900, height:720, depth:560, doors:2, icon:'🗄' },
  { type:'base_sink',   label:'Sink 800', width:800, height:720, depth:560, doors:2, icon:'🚿' },
  { type:'base_corner', label:'Corner 900', width:900, height:720, depth:900, doors:1, icon:'📐' },
  { type:'base_drawer', label:'Drawers 450', width:450, height:720, depth:560, doors:0, drawers:4, icon:'📦' },
  { type:'wall_single', label:'Wall 600', width:600, height:720, depth:350, doors:1, icon:'🔲' },
  { type:'wall_double', label:'Wall 900', width:900, height:720, depth:350, doors:2, icon:'🔲' },
]

const MATERIALS = ['Particleboard','Plywood','MDF']
const DOOR_STYLES = ['Handle','Gola','Push']
const COLORS = [
  { name:'White',   hex:'#FFFFFF' },
  { name:'Cream',   hex:'#F5F0E8' },
  { name:'Graphite',hex:'#4A4A4A' },
  { name:'Oak',     hex:'#C8A96E' },
  { name:'Walnut',  hex:'#7B5B3A' },
  { name:'Navy',    hex:'#1B3A5C' },
]

function computeBOM(cab) {
  const { width:W, height:H, depth:D, doors=1, drawers=0 } = cab
  const area18 = (
    2 * H * D +
    (W - 2*T) * (D - 30 - 8) +
    (W - 2*T) * 100 * 2 +
    W * (cab.toeKickH || 150) +
    (doors > 0 ? doors * ((W-3)/doors) * (H-T-100) : 0)
  ) / 1e6

  const area8 = ((W-2*T-3) * (H-T-3)) / 1e6

  const edgeM = (
    2*H + (W-2*T) +
    (doors > 0 ? doors * 2 * ((W-3)/doors + (H-T-100)) : 0)
  ) / 1000

  const hingesPerDoor = H <= 900 ? 2 : H <= 1400 ? 3 : 4
  const hinges = doors * hingesPerDoor
  const backScrews = Math.ceil((W-2*T)/100) * 2

  return {
    sheet18: parseFloat(area18.toFixed(4)),
    hdf8:    parseFloat(area8.toFixed(4)),
    edgeM:   parseFloat(edgeM.toFixed(2)),
    hinges,
    legs:    4,
    confirmats: 10,
    dowels: 10,
    backScrews,
    handles: doors + drawers,
  }
}

function aggregateBOM(cabinets) {
  const totals = { sheet18:0, hdf8:0, edgeM:0, hinges:0, legs:0, confirmats:0, dowels:0, backScrews:0, handles:0 }
  cabinets.forEach(c => {
    const b = computeBOM(c)
    Object.keys(totals).forEach(k => { totals[k] = parseFloat((totals[k] + b[k]).toFixed(4)) })
  })
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
  const [sentWO, setSentWO] = useState(null)
  const canvasRef = useRef(null)

  const addCabinet = (template) => {
    const cab = {
      ...template,
      id: Date.now(),
      x: 50, y: 50,
      material: 'Particleboard',
      doorStyle: 'Handle',
      carcassColor: '#F5F0E8',
      frontColor: '#FFFFFF',
      qty: 1,
    }
    setCabinets(prev => [...prev, cab])
    setSelected(cab.id)
  }

  const updateSelected = (key, val) => {
    setCabinets(prev => prev.map(c => c.id === selected ? {...c, [key]: val} : c))
  }

  const deleteSelected = () => {
    setCabinets(prev => prev.filter(c => c.id !== selected))
    setSelected(null)
  }

  const onMouseDown = (e, id) => {
    e.stopPropagation()
    const rect = canvasRef.current.getBoundingClientRect()
    const cab = cabinets.find(c => c.id === id)
    setDragging(id)
    setOffset({ x: e.clientX - rect.left - cab.x * SCALE, y: e.clientY - rect.top - cab.y * SCALE })
    setSelected(id)
  }

  const onMouseMove = useCallback((e) => {
    if (!dragging) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = Math.max(0, (e.clientX - rect.left - offset.x) / SCALE)
    const y = Math.max(0, (e.clientY - rect.top - offset.y) / SCALE)
    setCabinets(prev => prev.map(c => c.id === dragging ? {...c, x, y} : c))
  }, [dragging, offset])

  const onMouseUp = () => setDragging(null)

  const selCab = cabinets.find(c => c.id === selected)
  const bom = aggregateBOM(cabinets)

  const sendToERP = async () => {
    if (cabinets.length === 0) return alert('Add cabinets first')
    setSending(true)
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch('/api/manufacturing/work-orders/', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
        body: JSON.stringify({
          order_number: `WO-KP-${Date.now()}`,
          product_name: `Kitchen Project (${cabinets.length} cabinets)`,
          customer_name: 'Kitchen Planner',
          quantity: cabinets.length,
          status: 'NEW',
        })
      })
      if (res.ok) {
        const wo = await res.json()
        setSentWO(wo.order_number)
        alert(`✅ Work Order ${wo.order_number} created in Manufacturing!`)
      } else {
        alert('Failed to create work order. Check Django is running.')
      }
    } catch { alert('Cannot connect to Django API') }
    finally { setSending(false) }
  }

  const canvasW = room.width * SCALE
  const canvasH = room.depth * SCALE

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',fontFamily:'sans-serif'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexShrink:0}}>
        <div>
          <h1 style={{color:'#2c3e50',margin:0,fontSize:22}}>🏠 Kitchen Planner</h1>
          <p style={{color:'#999',fontSize:12,margin:'2px 0 0'}}>Design kitchen → Send to ERP</p>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <span style={{fontSize:13,color:'#666'}}>{cabinets.length} cabinets</span>
          <button onClick={sendToERP} disabled={sending||cabinets.length===0} style={{padding:'10px 20px',background:cabinets.length===0?'#bdc3c7':'#2ecc71',color:'white',border:'none',borderRadius:8,cursor:cabinets.length===0?'not-allowed':'pointer',fontWeight:700,fontSize:14}}>
            {sending ? 'Sending...' : '📤 Send to ERP'}
          </button>
        </div>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:16,flexShrink:0}}>
        {[['planner','🏠 2D Planner'],['bom','📋 BOM Summary']].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:'8px 18px',background:tab===id?'#3498db':'#ecf0f1',color:tab===id?'white':'#666',border:'none',borderRadius:6,cursor:'pointer',fontWeight:tab===id?700:400}}>
            {label}
          </button>
        ))}
        {sentWO && <span style={{padding:'8px 14px',background:'#d5f5e3',color:'#27ae60',borderRadius:6,fontSize:13,fontWeight:600}}>✓ {sentWO} sent to Manufacturing</span>}
      </div>

      {tab === 'planner' && (
        <div style={{display:'flex',gap:16,flex:1,overflow:'hidden'}}>

          <div style={{width:160,flexShrink:0,overflowY:'auto'}}>
            <div style={{fontSize:11,fontWeight:700,color:'#999',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Cabinet Catalog</div>
            {CABINET_CATALOG.map(t => (
              <div key={t.type} onClick={() => addCabinet(t)} style={{background:'white',border:'1.5px solid #e0e0e0',borderRadius:8,padding:'10px 12px',marginBottom:8,cursor:'pointer'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor='#3498db'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='#e0e0e0'}>
                <div style={{fontSize:20,marginBottom:4}}>{t.icon}</div>
                <div style={{fontSize:12,fontWeight:700,color:'#2c3e50'}}>{t.label}</div>
                <div style={{fontSize:10,color:'#999',marginTop:2}}>{t.width}×{t.height}×{t.depth}</div>
              </div>
            ))}
            <div style={{fontSize:10,color:'#bbb',marginTop:4,textAlign:'center'}}>Click to add</div>
          </div>

          <div style={{flex:1,overflow:'auto',background:'#f0f0f0',borderRadius:8,padding:16}}>
            <div style={{marginBottom:8,display:'flex',gap:12,alignItems:'center'}}>
              <label style={{fontSize:12,color:'#666'}}>Room W (mm): <input type="number" value={room.width} onChange={e=>setRoom(r=>({...r,width:+e.target.value}))} style={{width:70,padding:'3px 6px',border:'1px solid #ddd',borderRadius:4,fontSize:12}} /></label>
              <label style={{fontSize:12,color:'#666'}}>Room D (mm): <input type="number" value={room.depth} onChange={e=>setRoom(r=>({...r,depth:+e.target.value}))} style={{width:70,padding:'3px 6px',border:'1px solid #ddd',borderRadius:4,fontSize:12}} /></label>
              <span style={{fontSize:11,color:'#999'}}>Scale: 1mm = {SCALE}px</span>
            </div>
            <div
              ref={canvasRef}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              onClick={e=>{ if(e.target===canvasRef.current) setSelected(null) }}
              style={{width:canvasW,height:canvasH,background:'white',border:'2px solid #2c3e50',borderRadius:4,position:'relative',cursor:'crosshair',boxShadow:'0 2px 8px rgba(0,0,0,0.15)'}}
            >
              {Array.from({length:Math.floor(room.width/500)}).map((_,i)=>(
                <div key={i} style={{position:'absolute',left:(i+1)*500*SCALE,top:0,bottom:0,borderLeft:'1px dashed #eee',pointerEvents:'none'}} />
              ))}
              {Array.from({length:Math.floor(room.depth/500)}).map((_,i)=>(
                <div key={i} style={{position:'absolute',top:(i+1)*500*SCALE,left:0,right:0,borderTop:'1px dashed #eee',pointerEvents:'none'}} />
              ))}

              {cabinets.map(cab => (
                <div
                  key={cab.id}
                  onMouseDown={e=>onMouseDown(e,cab.id)}
                  style={{
                    position:'absolute',
                    left:cab.x*SCALE, top:cab.y*SCALE,
                    width:cab.width*SCALE, height:cab.depth*SCALE,
                    background:cab.carcassColor,
                    border:`2px solid ${selected===cab.id?'#3498db':'#888'}`,
                    borderRadius:3,
                    cursor:'grab',
                    boxShadow:selected===cab.id?'0 0 0 2px #3498db44':'none',
                    display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                    userSelect:'none',
                    overflow:'hidden',
                  }}
                >
                  <div style={{fontSize:9,fontWeight:700,color:'#333',textAlign:'center',padding:'0 2px',lineHeight:1.3}}>
                    {cab.label}
                  </div>
                  <div style={{fontSize:8,color:'#666'}}>{cab.width}mm</div>
                  {selected===cab.id && (
                    <div style={{position:'absolute',top:2,right:2,width:8,height:8,background:'#3498db',borderRadius:'50%'}} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{width:200,flexShrink:0,overflowY:'auto'}}>
            {selCab ? (
              <div>
                <div style={{fontSize:11,fontWeight:700,color:'#999',textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>Properties</div>
                <div style={{background:'white',borderRadius:8,padding:14,border:'1.5px solid #e0e0e0'}}>
                  <div style={{fontWeight:700,fontSize:13,color:'#2c3e50',marginBottom:12}}>{selCab.label}</div>

                  {[['Width (mm)','width'],['Height (mm)','height'],['Depth (mm)','depth']].map(([label,key])=>(
                    <div key={key} style={{marginBottom:10}}>
                      <div style={{fontSize:11,color:'#666',marginBottom:3}}>{label}</div>
                      <input type="number" value={selCab[key]} onChange={e=>updateSelected(key,+e.target.value)}
                        style={{width:'100%',padding:'6px 8px',border:'1px solid #ddd',borderRadius:4,fontSize:12,boxSizing:'border-box'}} />
                    </div>
                  ))}

                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:11,color:'#666',marginBottom:3}}>Material</div>
                    <select value={selCab.material} onChange={e=>updateSelected('material',e.target.value)}
                      style={{width:'100%',padding:'6px 8px',border:'1px solid #ddd',borderRadius:4,fontSize:12}}>
                      {MATERIALS.map(m=><option key={m}>{m}</option>)}
                    </select>
                  </div>

                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:11,color:'#666',marginBottom:3}}>Door Style</div>
                    <select value={selCab.doorStyle} onChange={e=>updateSelected('doorStyle',e.target.value)}
                      style={{width:'100%',padding:'6px 8px',border:'1px solid #ddd',borderRadius:4,fontSize:12}}>
                      {DOOR_STYLES.map(d=><option key={d}>{d}</option>)}
                    </select>
                  </div>

                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:11,color:'#666',marginBottom:5}}>Carcass Color</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                      {COLORS.map(c=>(
                        <div key={c.hex} title={c.name} onClick={()=>updateSelected('carcassColor',c.hex)}
                          style={{width:24,height:24,borderRadius:4,background:c.hex,border:selCab.carcassColor===c.hex?'2.5px solid #3498db':'1.5px solid #ccc',cursor:'pointer'}} />
                      ))}
                    </div>
                  </div>

                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:11,color:'#666',marginBottom:5}}>Front Color</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                      {COLORS.map(c=>(
                        <div key={c.hex} title={c.name} onClick={()=>updateSelected('frontColor',c.hex)}
                          style={{width:24,height:24,borderRadius:4,background:c.hex,border:selCab.frontColor===c.hex?'2.5px solid #3498db':'1.5px solid #ccc',cursor:'pointer'}} />
                      ))}
                    </div>
                  </div>

                  <div style={{background:'#f8f8f8',borderRadius:6,padding:10,marginBottom:12}}>
                    <div style={{fontSize:10,fontWeight:700,color:'#666',marginBottom:6}}>THIS CABINET BOM</div>
                    {Object.entries(computeBOM(selCab)).map(([k,v])=>(
                      <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3}}>
                        <span style={{color:'#666'}}>{k}</span>
                        <span style={{fontWeight:600}}>{v}</span>
                      </div>
                    ))}
                  </div>

                  <button onClick={deleteSelected} style={{width:'100%',padding:'8px',background:'#e74c3c',color:'white',border:'none',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600}}>
                    🗑 Delete Cabinet
                  </button>
                </div>
              </div>
            ) : (
              <div style={{color:'#bbb',fontSize:12,textAlign:'center',paddingTop:40}}>
                <div style={{fontSize:28,marginBottom:8}}>👆</div>
                Click a cabinet<br/>to configure it
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'bom' && (
        <div style={{flex:1,overflow:'auto'}}>
          {cabinets.length === 0 ? (
            <div style={{textAlign:'center',paddingTop:60,color:'#bbb'}}>
              <div style={{fontSize:48,marginBottom:12}}>🏠</div>
              <div style={{fontSize:16}}>Add cabinets in the planner first</div>
            </div>
          ) : (
            <div style={{maxWidth:800}}>
              <div style={{background:'white',borderRadius:12,padding:24,boxShadow:'0 2px 8px rgba(0,0,0,0.08)',marginBottom:16}}>
                <h2 style={{color:'#2c3e50',marginBottom:16,fontSize:18}}>📋 Bill of Materials — {cabinets.length} Cabinets</h2>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
                  {[
                    ['18mm Sheet',`${bom.sheet18} m²`,'#3498db'],
                    ['8mm HDF',`${bom.hdf8} m²`,'#e67e22'],
                    ['Edge Banding',`${bom.edgeM} m`,'#9b59b6'],
                    ['Hinges (Blum)',`${bom.hinges} pcs`,'#2ecc71'],
                    ['Legs',`${bom.legs} pcs`,'#1abc9c'],
                    ['Confirmats',`${bom.confirmats} pcs`,'#e74c3c'],
                    ['Dowels',`${bom.dowels} pcs`,'#f39c12'],
                    ['Back Screws',`${bom.backScrews} pcs`,'#95a5a6'],
                    ['Handles',`${bom.handles} pcs`,'#34495e'],
                  ].map(([label,val,color])=>(
                    <div key={label} style={{background:'#f8f9fa',borderRadius:8,padding:'14px 16px',borderLeft:`4px solid ${color}`}}>
                      <div style={{fontSize:12,color:'#666',marginBottom:4}}>{label}</div>
                      <div style={{fontSize:18,fontWeight:800,color:'#2c3e50'}}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{background:'white',borderRadius:12,padding:24,boxShadow:'0 2px 8px rgba(0,0,0,0.08)'}}>
                <h3 style={{color:'#2c3e50',marginBottom:14,fontSize:16}}>Cabinet List</h3>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr style={{background:'#f8f9fa'}}>
                    {['#','Type','W×H×D','Material','Door Style','Carcass','Front'].map(h=><th key={h} style={{padding:'10px 12px',textAlign:'left',fontSize:12,fontWeight:600,color:'#666'}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {cabinets.map((c,i)=>(
                      <tr key={c.id} style={{borderBottom:'1px solid #f0f0f0'}}>
                        <td style={{padding:'10px 12px',fontSize:13,color:'#999'}}>{i+1}</td>
                        <td style={{padding:'10px 12px',fontSize:13,fontWeight:600}}>{c.label}</td>
                        <td style={{padding:'10px 12px',fontSize:12,color:'#666'}}>{c.width}×{c.height}×{c.depth}</td>
                        <td style={{padding:'10px 12px',fontSize:12}}>{c.material}</td>
                        <td style={{padding:'10px 12px',fontSize:12}}>{c.doorStyle}</td>
                        <td style={{padding:'10px 12px'}}><div style={{width:20,height:20,borderRadius:4,background:c.carcassColor,border:'1px solid #ddd'}} /></td>
                        <td style={{padding:'10px 12px'}}><div style={{width:20,height:20,borderRadius:4,background:c.frontColor,border:'1px solid #ddd'}} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{marginTop:20,textAlign:'right'}}>
                  <button onClick={sendToERP} disabled={sending} style={{padding:'12px 24px',background:'#2ecc71',color:'white',border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:15}}>
                    {sending?'Creating Work Order...':'📤 Send to Manufacturing'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
