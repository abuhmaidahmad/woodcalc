import { useState } from 'react'

function buildPresets(h) {
  const small = h === 800 ? 200 : 180
  const big = h === 800 ? 400 : 360
  const huge = h
  const doorBig = h === 800 ? 600 : 540
  const doorSmall = big

  return [
    { id: '1_big_drawer', label: '1 Big Drawer', zones: [{ type: 'drawer', h: huge }] },
    { id: '2_drawers', label: '2 Drawers', zones: [{ type: 'drawer', h: big }, { type: 'drawer', h: big }] },
    { id: '4_drawers', label: '4 Drawers', zones: [{ type: 'drawer', h: small }, { type: 'drawer', h: small }, { type: 'drawer', h: small }, { type: 'drawer', h: small }] },
    { id: '2_small_1_big_drawer', label: '2 Small + 1 Big Drawer', zones: [{ type: 'drawer', h: small }, { type: 'drawer', h: small }, { type: 'drawer', h: big }] },
    { id: '1_small_drawer_1_door', label: '1 Drawer + Door', zones: [{ type: 'drawer', h: small }, { type: 'door', h: doorBig }], doorCount: 1 },
    { id: '1_small_drawer_2_doors', label: '1 Drawer + 2 Doors', zones: [{ type: 'drawer', h: small }, { type: 'door', h: doorBig }], doorCount: 2 },
    { id: '2_small_1_door', label: '2 Drawers + Door', zones: [{ type: 'drawer', h: small }, { type: 'drawer', h: small }, { type: 'door', h: doorSmall }], doorCount: 1 },
  ]
}

function ZoneVisual({ zones, scale = 0.16 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column-reverse', border: '1.5px solid #bdc3c7', borderRadius: 3, overflow: 'hidden', width: 34 }}>
      {zones.map((z, i) => (
        <div key={i} style={{
          height: z.h * scale,
          background: z.type === 'drawer' ? '#3498db22' : '#2ecc7122',
          borderTop: i > 0 ? '1px solid #bdc3c7' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 7, color: z.type === 'drawer' ? '#2980b9' : '#27ae60', fontWeight: 700, minHeight: 8
        }}>
          {z.type === 'drawer' ? 'D' : '🚪'}
        </div>
      ))}
    </div>
  )
}

export default function ZonePresetPicker({ height = 720, width = 600, selected, onChange }) {
  const h = height >= 780 ? 800 : 720
  let presets = buildPresets(h)

  // Only show 2-door variant for wide enough cabinets (>= 700mm), hide it otherwise
  presets = presets.filter(p => p.doorCount !== 2 || width >= 700)

  return (
    <div>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>Interior Layout</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {presets.map(p => (
          <div key={p.id} onClick={() => onChange(p)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '4px 2px', borderRadius: 6, cursor: 'pointer',
              border: selected?.id === p.id ? '1.5px solid #3498db' : '1.5px solid #e0e0e0',
              background: selected?.id === p.id ? '#ebf5fb' : 'white',
            }}>
            <ZoneVisual zones={p.zones} />
            <div style={{ fontSize: 7, color: '#666', textAlign: 'center', lineHeight: 1.1 }}>{p.label}</div>
          </div>
        ))}
      </div>
      {selected && (
        <div style={{ marginTop: 6, fontSize: 9, color: '#666' }}>
          Selected: <strong>{selected.label}</strong>
          {' — '}{selected.zones.map(z => `${z.type === 'drawer' ? 'Drawer' : 'Door'} ${z.h}mm`).join(', ')}
          {selected.doorCount === 2 ? ' (2 doors)' : ''}
        </div>
      )}
    </div>
  )
}
