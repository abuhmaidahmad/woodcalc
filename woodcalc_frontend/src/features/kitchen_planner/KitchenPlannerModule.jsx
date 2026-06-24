// KitchenPlannerModule.jsx
import React, { useState } from 'react'
import { calculateCabinet, getZonePresets, getDefaultDoorCount, getHingeCount } from './formulaEngine'

export default function KitchenPlannerModule() {
  const [width, setWidth] = useState(800)
  const [height, setHeight] = useState(720)
  const [depth, setDepth] = useState(560)
  const [material, setMaterial] = useState('particleboard')
  const [doorStyle, setDoorStyle] = useState('Handle')
  const [doorCount, setDoorCount] = useState(getDefaultDoorCount(width))
  const [shelves, setShelves] = useState(1)
  const [drawerCount, setDrawerCount] = useState(0)
  const [drawerType, setDrawerType] = useState('Wood Box')
  const [result, setResult] = useState(null)

  function runCalc(e) {
    e && e.preventDefault()
    const config = {
      width: Number(width),
      height: Number(height),
      depth: Number(depth),
      material,
      doorStyle,
      doorCount: Number(doorCount),
      shelves: Number(shelves),
      drawers: Number(drawerCount),
      drawerType,
      cabinetType: 'base',
    }
    const res = calculateCabinet(config)
    setResult(res)
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 20 }}>
      <h2>Kitchen Planner — Cabinet Formula</h2>

      <form onSubmit={runCalc} style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
        <label>
          Width (mm)
          <input value={width} onChange={(e)=>{ setWidth(e.target.value); setDoorCount(getDefaultDoorCount(Number(e.target.value)))}} />
        </label>
        <label>
          Height (mm)
          <input value={height} onChange={(e)=>setHeight(e.target.value)} />
        </label>
        <label>
          Depth (mm)
          <input value={depth} onChange={(e)=>setDepth(e.target.value)} />
        </label>

        <label>
          Material
          <select value={material} onChange={(e)=>setMaterial(e.target.value)}>
            <option value="particleboard">Particleboard</option>
            <option value="mdf">MDF</option>
            <option value="plywood">Plywood</option>
          </select>
        </label>

        <label>
          Door Style
          <select value={doorStyle} onChange={(e)=>setDoorStyle(e.target.value)}>
            <option>Handle</option>
            <option>Push</option>
            <option>Gola</option>
          </select>
        </label>

        <label>
          Door Count
          <input value={doorCount} onChange={(e)=>setDoorCount(e.target.value)} />
        </label>

        <label>
          Shelves
          <input value={shelves} onChange={(e)=>setShelves(e.target.value)} />
        </label>

        <label>
          Drawers
          <input value={drawerCount} onChange={(e)=>setDrawerCount(e.target.value)} />
        </label>

        <label>
          Drawer Type
          <select value={drawerType} onChange={(e)=>setDrawerType(e.target.value)}>
            <option>Wood Box</option>
            <option>Legrabox</option>
            <option>Tandembox</option>
          </select>
        </label>

        <div style={{ gridColumn: '1 / -1', marginTop: 6 }}>
          <button type="submit" style={{ padding: '8px 16px' }}>Calculate BOM</button>
        </div>
      </form>

      {result && (
        <div>
          <h3>Summary</h3>
          <pre style={{ background: '#f7f7f7', padding: 12 }}>{JSON.stringify(result.summary, null, 2)}</pre>

          <h3>Panels</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
            <thead>
              <tr style={{ background:'#eee' }}>
                <th style={{ padding:8 }}>Name</th>
                <th style={{ padding:8 }}>Qty</th>
                <th style={{ padding:8 }}>W (mm)</th>
                <th style={{ padding:8 }}>D/H (mm)</th>
                <th style={{ padding:8 }}>Th (mm)</th>
                <th style={{ padding:8 }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {result.panels.map((p,i)=>(
                <tr key={i} style={{ borderBottom:'1px solid #f0f0f0' }}>
                  <td style={{ padding:8 }}>{p.name}</td>
                  <td style={{ padding:8, textAlign:'center' }}>{p.qty}</td>
                  <td style={{ padding:8 }}>{p.width}</td>
                  <td style={{ padding:8 }}>{p.depth}</td>
                  <td style={{ padding:8 }}>{p.thickness}</td>
                  <td style={{ padding:8 }}>{p.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Doors</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
            <thead>
              <tr style={{ background:'#eee' }}>
                <th style={{ padding:8 }}>#</th>
                <th style={{ padding:8 }}>Width</th>
                <th style={{ padding:8 }}>Height</th>
                <th style={{ padding:8 }}>Hinges</th>
                <th style={{ padding:8 }}>Style</th>
              </tr>
            </thead>
            <tbody>
              {result.doors.map((d,i)=>(
                <tr key={i}>
                  <td style={{ padding:8 }}>{i+1}</td>
                  <td style={{ padding:8 }}>{d.width}</td>
                  <td style={{ padding:8 }}>{d.height}</td>
                  <td style={{ padding:8 }}>{d.hinges}</td>
                  <td style={{ padding:8 }}>{d.style}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Hardware</h3>
          <pre style={{ background: '#f7f7f7', padding: 12 }}>{JSON.stringify(result.hardware, null, 2)}</pre>

          <h3>Edge Banding</h3>
          <pre style={{ background: '#f7f7f7', padding: 12 }}>{JSON.stringify(result.edgeBanding, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
