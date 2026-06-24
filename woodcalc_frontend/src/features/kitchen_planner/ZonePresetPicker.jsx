import { useState } from 'react'

const PRESETS = {
  720: [
    { id:'4drawers', label:'4 Drawers', zones:[{type:'drawer',h:180},{type:'drawer',h:180},{type:'drawer',h:180},{type:'drawer',h:180}] },
    { id:'2drawers_1door', label:'2 Drawers + Door', zones:[{type:'drawer',h:180},{type:'drawer',h:180},{type:'door',h:300}] },
    { id:'2drawers', label:'2 Drawers', zones:[{type:'drawer',h:180},{type:'drawer',h:180}] },
    { id:'1door', label:'1 Full Door', zones:[{type:'door',h:360}] },
  ],
  800: [
    { id:'4drawers', label:'4 Drawers', zones:[{type:'drawer',h:200},{type:'drawer',h:200},{type:'drawer',h:200},{type:'drawer',h:200}] },
    { id:'2drawers_1door', label:'2 Drawers + Door', zones:[{type:'drawer',h:200},{type:'drawer',h:200},{type:'door',h:320}] },
    { id:'2drawers', label:'2 Drawers', zones:[{type:'drawer',h:200},{type:'drawer',h:200}] },
    { id:'1door', label:'1 Full Door', zones:[{type:'door',h:400}] },
  ]
}

function ZoneVisual({ zones, scale=0.35 }) {
  return (
    <div style={{display:'flex',flexDirection:'column-reverse',border:'2px solid #bdc3c7',borderRadius:4,overflow:'hidden',width:50}}>
      {zones.map((z,i) => (
        <div key={i} style={{
          height: z.h * scale,
          background: z.type==='drawer' ? '#3498db22' : '#2ecc7122',
          borderTop: i>0 ? '1px solid #bdc3c7' : 'none',
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:9,color: z.type==='drawer'?'#2980b9':'#27ae60',fontWeight:700
        }}>
          {z.type==='drawer'?'D':'🚪'}
        </div>
      ))}
    </div>
  )
}

export default function ZonePresetPicker({ height=720, selected, onChange }) {
  const h = height >= 780 ? 800 : 720
  const presets = PRESETS[h]

  return (
    <div>
      <div style={{fontSize:11,color:'#666',marginBottom:6}}>Interior Layout</div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {presets.map(p => (
          <div key={p.id} onClick={()=>onChange(p)}
            style={{
              display:'flex',flexDirection:'column',alignItems:'center',gap:4,
              padding:'8px 6px',borderRadius:8,cursor:'pointer',
              border: selected?.id===p.id ? '2px solid #3498db' : '2px solid #e0e0e0',
              background: selected?.id===p.id ? '#ebf5fb' : 'white',
              minWidth:60
            }}>
            <ZoneVisual zones={p.zones} />
            <div style={{fontSize:9,color:'#666',textAlign:'center',lineHeight:1.2}}>{p.label}</div>
          </div>
        ))}
      </div>
      {selected && (
        <div style={{marginTop:8,fontSize:11,color:'#666'}}>
          Selected: <strong>{selected.label}</strong>
          {' — '}{selected.zones.map(z=>`${z.type==='drawer'?'Drawer':'Door'} ${z.h}mm`).join(', ')}
        </div>
      )}
    </div>
  )
}
