import React, { useState } from 'react'

const ACCENT = '#C8902A'
const DARK = '#1A1A1A'

export const LAMINATE_MATERIALS = [
  { id: 'gloss_white',      label: 'Gloss White',      color: '#FFFFFF', finish: 'gloss' },
  { id: 'gloss_cream',      label: 'Gloss Cream',      color: '#F5F0E8', finish: 'gloss' },
  { id: 'gloss_light_grey', label: 'Gloss Light Grey', color: '#D0D0D0', finish: 'gloss' },
  { id: 'gloss_anthracite', label: 'Gloss Anthracite', color: '#3A3A3A', finish: 'gloss' },
  { id: 'gloss_black',      label: 'Gloss Black',      color: '#1A1A1A', finish: 'gloss' },
  { id: 'gloss_navy',       label: 'Gloss Navy',       color: '#1B3A5C', finish: 'gloss' },
  { id: 'gloss_sage',       label: 'Gloss Sage',       color: '#7A9E7E', finish: 'gloss' },
  { id: 'matt_white',       label: 'Matt White',       color: '#F8F8F6', finish: 'matt' },
  { id: 'matt_cream',       label: 'Matt Cream',       color: '#EDE8DF', finish: 'matt' },
  { id: 'matt_light_grey',  label: 'Matt Light Grey',  color: '#C8C8C8', finish: 'matt' },
  { id: 'matt_anthracite',  label: 'Matt Anthracite',  color: '#404040', finish: 'matt' },
  { id: 'matt_black',       label: 'Matt Black',       color: '#1A1A1A', finish: 'matt' },
  { id: 'matt_navy',        label: 'Matt Navy',        color: '#1B3A5C', finish: 'matt' },
  { id: 'matt_sage',        label: 'Matt Sage',        color: '#7A9E7E', finish: 'matt' },
  { id: 'matt_terracotta',  label: 'Matt Terracotta',  color: '#C4703A', finish: 'matt' },
  { id: 'wood_light_oak',   label: 'Light Oak',        color: '#D4A96A', finish: 'wood' },
  { id: 'wood_natural_oak', label: 'Natural Oak',      color: '#C8902A', finish: 'wood' },
  { id: 'wood_dark_oak',    label: 'Dark Oak',         color: '#8B6330', finish: 'wood' },
  { id: 'wood_walnut',      label: 'Walnut',           color: '#7B5B3A', finish: 'wood' },
  { id: 'wood_wenge',       label: 'Wenge',            color: '#3D2B1A', finish: 'wood' },
  { id: 'wood_pine',        label: 'Pine',             color: '#E0C080', finish: 'wood' },
]

const Icons = {
  base_standard: (<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="8" width="40" height="30" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><rect x="4" y="34" width="40" height="4" rx="1" fill="#e0d5c5" stroke="#2c3e50" strokeWidth="1.5"/><line x1="24" y1="8" x2="24" y2="34" stroke="#2c3e50" strokeWidth="1"/><circle cx="21" cy="21" r="1.5" fill="#2c3e50"/><circle cx="27" cy="21" r="1.5" fill="#2c3e50"/><rect x="6" y="38" width="4" height="4" rx="1" fill="#888"/><rect x="38" y="38" width="4" height="4" rx="1" fill="#888"/></svg>),
  base_sink: (<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="8" width="40" height="30" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><rect x="4" y="34" width="40" height="4" rx="1" fill="#e0d5c5" stroke="#2c3e50" strokeWidth="1.5"/><rect x="12" y="13" width="24" height="16" rx="2" stroke="#4FC3F7" strokeWidth="1.5" fill="#e8f4fd"/><circle cx="24" cy="21" r="2" fill="#4FC3F7"/><rect x="6" y="38" width="4" height="4" rx="1" fill="#888"/><rect x="38" y="38" width="4" height="4" rx="1" fill="#888"/></svg>),
  base_drawers: (<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="8" width="40" height="30" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><rect x="4" y="34" width="40" height="4" rx="1" fill="#e0d5c5" stroke="#2c3e50" strokeWidth="1.5"/><line x1="4" y1="18" x2="44" y2="18" stroke="#2c3e50" strokeWidth="1"/><line x1="4" y1="26" x2="44" y2="26" stroke="#2c3e50" strokeWidth="1"/><rect x="18" y="12" width="12" height="4" rx="1" fill="#C8902A" opacity="0.4"/><rect x="18" y="20" width="12" height="4" rx="1" fill="#C8902A" opacity="0.4"/><rect x="18" y="28" width="12" height="4" rx="1" fill="#C8902A" opacity="0.4"/><rect x="6" y="38" width="4" height="4" rx="1" fill="#888"/><rect x="38" y="38" width="4" height="4" rx="1" fill="#888"/></svg>),
  wall_standard: (<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="6" width="40" height="32" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><line x1="24" y1="6" x2="24" y2="38" stroke="#2c3e50" strokeWidth="1"/><circle cx="21" cy="22" r="1.5" fill="#2c3e50"/><circle cx="27" cy="22" r="1.5" fill="#2c3e50"/></svg>),
  wall_open: (<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="6" width="40" height="32" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><line x1="4" y1="22" x2="44" y2="22" stroke="#2c3e50" strokeWidth="1"/></svg>),
  tall_pantry: (<svg viewBox="0 0 48 48" fill="none"><rect x="10" y="2" width="28" height="44" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><line x1="24" y1="2" x2="24" y2="46" stroke="#2c3e50" strokeWidth="1"/><circle cx="21" cy="16" r="1.5" fill="#2c3e50"/><circle cx="27" cy="16" r="1.5" fill="#2c3e50"/><circle cx="21" cy="30" r="1.5" fill="#2c3e50"/><circle cx="27" cy="30" r="1.5" fill="#2c3e50"/><line x1="10" y1="24" x2="38" y2="24" stroke="#2c3e50" strokeWidth="0.75"/></svg>),
  tall_oven: (<svg viewBox="0 0 48 48" fill="none"><rect x="10" y="2" width="28" height="44" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><rect x="13" y="18" width="22" height="18" rx="1" stroke="#888" strokeWidth="1" fill="#e0e0e0"/><rect x="15" y="20" width="18" height="14" rx="1" fill="#555" opacity="0.3"/><line x1="10" y1="16" x2="38" y2="16" stroke="#2c3e50" strokeWidth="1"/><line x1="10" y1="38" x2="38" y2="38" stroke="#2c3e50" strokeWidth="1"/></svg>),
  tall_fridge: (<svg viewBox="0 0 48 48" fill="none"><rect x="10" y="2" width="28" height="44" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#e8f0f8"/><line x1="10" y1="20" x2="38" y2="20" stroke="#2c3e50" strokeWidth="1.5"/><circle cx="34" cy="11" r="1.5" fill="#2c3e50"/><circle cx="34" cy="30" r="1.5" fill="#2c3e50"/></svg>),
  vanity_sink: (<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="10" width="40" height="26" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><rect x="4" y="32" width="40" height="4" rx="1" fill="#e0d5c5" stroke="#2c3e50" strokeWidth="1.5"/><ellipse cx="24" cy="21" rx="10" ry="7" stroke="#4FC3F7" strokeWidth="1.5" fill="#e8f4fd"/><circle cx="24" cy="21" r="2" fill="#4FC3F7"/><rect x="6" y="36" width="4" height="6" rx="1" fill="#888"/><rect x="38" y="36" width="4" height="6" rx="1" fill="#888"/></svg>),
  vanity_drawers: (<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="10" width="40" height="26" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><rect x="4" y="32" width="40" height="4" rx="1" fill="#e0d5c5" stroke="#2c3e50" strokeWidth="1.5"/><line x1="4" y1="22" x2="44" y2="22" stroke="#2c3e50" strokeWidth="1"/><rect x="16" y="14" width="16" height="6" rx="1" fill="#C8902A" opacity="0.4"/><rect x="16" y="24" width="16" height="6" rx="1" fill="#C8902A" opacity="0.4"/><rect x="6" y="36" width="4" height="6" rx="1" fill="#888"/><rect x="38" y="36" width="4" height="6" rx="1" fill="#888"/></svg>),
  corner_blind: (<svg viewBox="0 0 48 48" fill="none"><path d="M4 8 L44 8 L44 38 L24 38 L24 44 L4 44 Z" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><line x1="24" y1="8" x2="24" y2="38" stroke="#2c3e50" strokeWidth="1"/><circle cx="33" cy="23" r="1.5" fill="#2c3e50"/><circle cx="14" cy="36" r="1.5" fill="#2c3e50"/></svg>),
  corner_l: (<svg viewBox="0 0 48 48" fill="none"><path d="M4 4 L44 4 L44 24 L24 24 L24 44 L4 44 Z" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><line x1="4" y1="24" x2="24" y2="24" stroke="#2c3e50" strokeWidth="1"/><line x1="24" y1="4" x2="24" y2="24" stroke="#2c3e50" strokeWidth="1"/></svg>),
  corner_diagonal: (<svg viewBox="0 0 48 48" fill="none"><path d="M14 4 L44 4 L44 34 Z" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><line x1="14" y1="4" x2="44" y2="34" stroke="#2c3e50" strokeWidth="1"/></svg>),
  specialty_tv: (<svg viewBox="0 0 48 48" fill="none"><rect x="2" y="8" width="44" height="26" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><rect x="2" y="30" width="44" height="8" rx="1" fill="#e0d5c5" stroke="#2c3e50" strokeWidth="1.5"/><rect x="6" y="11" width="36" height="16" rx="1" fill="#333" opacity="0.15"/><line x1="16" y1="30" x2="16" y2="38" stroke="#2c3e50" strokeWidth="1"/><line x1="32" y1="30" x2="32" y2="38" stroke="#2c3e50" strokeWidth="1"/></svg>),
  specialty_custom: (<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="8" width="40" height="32" rx="1" stroke="#C8902A" strokeWidth="1.5" fill="#C8902A" fillOpacity="0.08" strokeDasharray="4,3"/><text x="24" y="28" textAnchor="middle" fontSize="18" fill="#C8902A" fontFamily="Inter,sans-serif">?</text></svg>),
  accessory_filler: (<svg viewBox="0 0 48 48" fill="none"><rect x="18" y="4" width="12" height="40" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#e8e4df" strokeDasharray="3,2"/><line x1="18" y1="12" x2="30" y2="12" stroke="#888" strokeWidth="0.75"/><line x1="18" y1="20" x2="30" y2="20" stroke="#888" strokeWidth="0.75"/><line x1="18" y1="28" x2="30" y2="28" stroke="#888" strokeWidth="0.75"/><line x1="18" y1="36" x2="30" y2="36" stroke="#888" strokeWidth="0.75"/></svg>),
  accessory_shelf: (<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="20" width="40" height="6" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><rect x="8" y="26" width="3" height="14" rx="1" fill="#888"/><rect x="37" y="26" width="3" height="14" rx="1" fill="#888"/></svg>),
}

function buildLibrary(baseHeight) {
  const wallInc = baseHeight === 720 ? 180 : 200
  const wallHeights = []
  for (let h = wallInc; h <= wallInc * 6; h += wallInc) wallHeights.push(h)
  const wallElevation = baseHeight === 720 ? 1470 : 1480
  const baseWidths = [200, 300, 400, 500, 600, 700, 800, 900, 1000, 1200]
  const wallWidths = [200, 300, 400, 500, 600, 700, 800, 900]
  const tallWidths = [300, 400, 500, 600, 700, 800, 900, 1000]
  const vanityWidths = [450, 600, 750, 900]
  const base = [
    ...baseWidths.map(w => ({ id: `base_std_${w}`, label: `Base ${w}`, subtype: 'Standard', width: w, height: baseHeight, depth: 560, icon: 'base_standard', category: 'base' })),
    ...baseWidths.filter(w => w >= 400).map(w => ({ id: `base_sink_${w}`, label: `Sink ${w}`, subtype: 'Sink', width: w, height: baseHeight, depth: 560, icon: 'base_sink', category: 'base' })),
    ...[300, 400, 450, 500, 600].map(w => ({ id: `base_drw_${w}`, label: `Drawers ${w}`, subtype: 'Drawers', width: w, height: baseHeight, depth: 560, icon: 'base_drawers', category: 'base' })),
  ]
  const wall = wallWidths.flatMap(w => wallHeights.flatMap(h => [
    { id: `wall_std_${w}_${h}`, label: `Wall ${w}`, subtype: 'Standard', width: w, height: h, depth: 300, icon: 'wall_standard', category: 'wall', wallHeight: h, elevation: wallElevation },
    { id: `wall_open_${w}_${h}`, label: `Open ${w}`, subtype: 'Open Shelf', width: w, height: h, depth: 300, icon: 'wall_open', category: 'wall', wallHeight: h, elevation: wallElevation },
  ]))
  const tall = [
    ...tallWidths.map(w => ({ id: `tall_pantry_${w}`, label: `Pantry ${w}`, subtype: 'Pantry', width: w, height: 2220, depth: 560, icon: 'tall_pantry', category: 'tall' })),
    ...tallWidths.filter(w => w >= 600).map(w => ({ id: `tall_oven_${w}`, label: `Oven Tower ${w}`, subtype: 'Oven Tower', width: w, height: 2220, depth: 560, icon: 'tall_oven', category: 'tall' })),
    ...[600, 700, 800, 900].map(w => ({ id: `tall_fridge_${w}`, label: `Fridge ${w}`, subtype: 'Fridge', width: w, height: 2220, depth: 600, icon: 'tall_fridge', category: 'tall' })),
  ]
  const vanity = [
    ...vanityWidths.map(w => ({ id: `van_sink_${w}`, label: `Vanity ${w}`, subtype: 'Single Sink', width: w, height: baseHeight, depth: 550, icon: 'vanity_sink', category: 'vanity' })),
    ...[750, 900].map(w => ({ id: `van_dsink_${w}`, label: `Double Sink ${w}`, subtype: 'Double Sink', width: w, height: baseHeight, depth: 550, icon: 'vanity_sink', category: 'vanity' })),
    ...vanityWidths.map(w => ({ id: `van_drw_${w}`, label: `Vanity Drawers ${w}`, subtype: 'Drawers', width: w, height: baseHeight, depth: 550, icon: 'vanity_drawers', category: 'vanity' })),
  ]
  const corner = [
    { id: 'corner_blind_1000', label: 'Blind 1000', subtype: 'Blind', width: 1000, height: baseHeight, depth: 560, icon: 'corner_blind', category: 'corner' },
    { id: 'corner_blind_1100', label: 'Blind 1100', subtype: 'Blind', width: 1100, height: baseHeight, depth: 560, icon: 'corner_blind', category: 'corner' },
    { id: 'corner_blind_1200', label: 'Blind 1200', subtype: 'Blind', width: 1200, height: baseHeight, depth: 560, icon: 'corner_blind', category: 'corner' },
    { id: 'corner_l_900', label: 'L-Shape 900', subtype: 'L-Shape', width: 900, height: baseHeight, depth: 900, icon: 'corner_l', category: 'corner' },
    { id: 'corner_l_1000', label: 'L-Shape 1000', subtype: 'L-Shape', width: 1000, height: baseHeight, depth: 1000, icon: 'corner_l', category: 'corner' },
    { id: 'corner_diag', label: 'Diagonal Wall', subtype: 'Diagonal', width: 900, height: wallHeights[1] || wallInc * 2, depth: 300, icon: 'corner_diagonal', category: 'corner' },
  ]
  const specialty = [
    { id: 'spec_tv', label: 'TV Unit', subtype: 'Custom', width: 1800, height: 600, depth: 400, icon: 'specialty_tv', category: 'specialty', isCustom: true },
    { id: 'spec_laundry', label: 'Laundry', subtype: 'Custom', width: 600, height: baseHeight, depth: 560, icon: 'specialty_custom', category: 'specialty', isCustom: true },
    { id: 'spec_linen', label: 'Linen Tower', subtype: 'Custom', width: 450, height: 2220, depth: 400, icon: 'tall_pantry', category: 'specialty', isCustom: true },
  ]
  const accessories = [
    { id: 'acc_filler_50', label: 'Filler 50mm', subtype: 'Filler', width: 50, height: baseHeight, depth: 560, icon: 'accessory_filler', category: 'accessories' },
    { id: 'acc_filler_100', label: 'Filler 100mm', subtype: 'Filler', width: 100, height: baseHeight, depth: 560, icon: 'accessory_filler', category: 'accessories' },
    { id: 'acc_sidepanel', label: 'Side Panel', subtype: 'Panel', width: 18, height: baseHeight, depth: 560, icon: 'accessory_filler', category: 'accessories' },
    { id: 'acc_shelf_600', label: 'Shelf 600', subtype: 'Shelf', width: 600, height: 30, depth: 250, icon: 'accessory_shelf', category: 'accessories' },
    { id: 'acc_shelf_900', label: 'Shelf 900', subtype: 'Shelf', width: 900, height: 30, depth: 250, icon: 'accessory_shelf', category: 'accessories' },
    { id: 'acc_shelf_1200', label: 'Shelf 1200', subtype: 'Shelf', width: 1200, height: 30, depth: 250, icon: 'accessory_shelf', category: 'accessories' },
    { id: 'acc_toekick', label: 'Toe Kick', subtype: 'Toe Kick', width: 600, height: 100, depth: 60, icon: 'accessory_filler', category: 'accessories' },
  ]
  return { base, wall, tall, vanity, corner, specialty, accessories, wallElevation }
}

function ProjectSetup({ onConfirm }) {
  const [baseHeight, setBaseHeight] = useState(null)
  const [doorStyle, setDoorStyle]   = useState(null)
  const [golaColor, setGolaColor]   = useState('black')
  const [handlePos, setHandlePos]   = useState('bottom')
  const ready = baseHeight && doorStyle
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: DARK, marginBottom: 4 }}>Project Setup</div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 24 }}>Set your kitchen standards. You can change per cabinet later.</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Base Cabinet Height</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {[720, 800].map(h => (
            <div key={h} onClick={() => setBaseHeight(h)} style={{ flex: 1, padding: '14px 10px', border: `2px solid ${baseHeight === h ? ACCENT : '#E0DAD4'}`, borderRadius: 10, cursor: 'pointer', background: baseHeight === h ? ACCENT+'10' : '#FAFAFA', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: baseHeight === h ? ACCENT : DARK }}>{h}mm</div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 3 }}>{h === 720 ? '180mm wall increments' : '200mm wall increments'}</div>
              <div style={{ fontSize: 10, color: '#aaa' }}>{h === 720 ? 'Wall elevation: 1470mm' : 'Wall elevation: 1480mm'}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Default Door Style</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[{ id: 'Handle', label: 'Handle', desc: 'Bar handle on door', icon: '🔲' }, { id: 'Push', label: 'Push', desc: 'Push-to-open, no handle', icon: '👆' }, { id: 'Gola', label: 'Gola', desc: 'Aluminum channel grip', icon: '▬' }].map(s => (
            <div key={s.id} onClick={() => setDoorStyle(s.id)} style={{ flex: 1, padding: '10px 6px', border: `2px solid ${doorStyle === s.id ? ACCENT : '#E0DAD4'}`, borderRadius: 8, cursor: 'pointer', background: doorStyle === s.id ? ACCENT+'10' : '#FAFAFA', textAlign: 'center' }}>
              <div style={{ fontSize: 18, marginBottom: 3 }}>{s.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: doorStyle === s.id ? ACCENT : DARK }}>{s.label}</div>
              <div style={{ fontSize: 9, color: '#999', marginTop: 2 }}>{s.desc}</div>
            </div>
          ))}
        </div>
        {doorStyle === 'Handle' && <>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Handle Position</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[{ id: 'top', label: 'Top', icon: '⬆' }, { id: 'bottom', label: 'Bottom', icon: '⬇' }].map(p => (
              <div key={p.id} onClick={() => setHandlePos(p.id)} style={{ flex: 1, padding: '10px', border: `2px solid ${handlePos === p.id ? ACCENT : '#E0DAD4'}`, borderRadius: 8, cursor: 'pointer', background: handlePos === p.id ? ACCENT+'10' : '#FAFAFA', textAlign: 'center' }}>
                <div style={{ fontSize: 16 }}>{p.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: handlePos === p.id ? ACCENT : DARK }}>{p.label}</div>
              </div>
            ))}
          </div>
        </>}
        {doorStyle === 'Gola' && <>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Gola Channel Color</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[{ id: 'black', label: 'Black', color: '#1a1a1a' }, { id: 'silver', label: 'Silver', color: '#c0c0c0' }, { id: 'champagne', label: 'Champagne', color: '#c8a96e' }].map(g => (
              <div key={g.id} onClick={() => setGolaColor(g.id)} style={{ flex: 1, padding: '10px 6px', border: `2px solid ${golaColor === g.id ? ACCENT : '#E0DAD4'}`, borderRadius: 8, cursor: 'pointer', background: golaColor === g.id ? ACCENT+'10' : '#FAFAFA', textAlign: 'center' }}>
                <div style={{ width: 28, height: 8, borderRadius: 4, background: g.color, margin: '0 auto 5px' }} />
                <div style={{ fontSize: 10, fontWeight: 700, color: golaColor === g.id ? ACCENT : DARK }}>{g.label}</div>
              </div>
            ))}
          </div>
        </>}
        <button onClick={() => ready && onConfirm({ baseHeight, doorStyle, golaColor, handlePos })} disabled={!ready} style={{ width: '100%', padding: '13px', background: ready ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8, cursor: ready ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 700 }}>
          Start Designing →
        </button>
      </div>
    </div>
  )
}

function CabinetCard({ item, onAdd }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div onClick={() => onAdd(item)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ border: `1.5px solid ${hovered ? ACCENT : '#E8E4DF'}`, borderRadius: 10, padding: '10px 8px', cursor: 'pointer', background: hovered ? ACCENT+'08' : '#FAFAFA', transition: 'all 0.15s', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 44, height: 44 }}>{Icons[item.icon] || Icons.specialty_custom}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: DARK, lineHeight: 1.2 }}>{item.label}</div>
      <div style={{ fontSize: 9, color: '#999', fontFamily: 'monospace' }}>{item.width}×{item.depth}mm</div>
      {item.subtype && item.subtype !== 'Standard' && <div style={{ fontSize: 8, color: ACCENT, fontWeight: 600, background: ACCENT+'15', padding: '1px 5px', borderRadius: 4 }}>{item.subtype}</div>}
    </div>
  )
}

function WallHeightFilter({ baseHeight, selected, onChange }) {
  const inc = baseHeight === 720 ? 180 : 200
  const heights = []
  for (let h = inc; h <= inc * 6; h += inc) heights.push(h)
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
      <button onClick={() => onChange(null)} style={{ padding: '3px 7px', borderRadius: 10, border: `1px solid ${!selected ? ACCENT : '#E0DAD4'}`, background: !selected ? ACCENT : '#fff', color: !selected ? '#fff' : '#666', fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>All</button>
      {heights.map(h => <button key={h} onClick={() => onChange(h)} style={{ padding: '3px 7px', borderRadius: 10, border: `1px solid ${selected === h ? ACCENT : '#E0DAD4'}`, background: selected === h ? ACCENT : '#fff', color: selected === h ? '#fff' : '#666', fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>{h}</button>)}
    </div>
  )
}

function SubtypeFilter({ items, selected, onChange }) {
  const subtypes = ['All', ...new Set(items.map(i => i.subtype).filter(Boolean))]
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
      {subtypes.map(s => <button key={s} onClick={() => onChange(s === 'All' ? null : s)} style={{ padding: '3px 7px', borderRadius: 10, border: `1px solid ${(selected === s || (!selected && s === 'All')) ? ACCENT : '#E0DAD4'}`, background: (selected === s || (!selected && s === 'All')) ? ACCENT : '#fff', color: (selected === s || (!selected && s === 'All')) ? '#fff' : '#666', fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>{s}</button>)}
    </div>
  )
}

const CATEGORIES = [
  { id: 'base', icon: '🗄', label: 'Base' }, { id: 'wall', icon: '🪟', label: 'Wall' },
  { id: 'tall', icon: '🏛', label: 'Tall' }, { id: 'vanity', icon: '🚿', label: 'Vanity' },
  { id: 'corner', icon: '📐', label: 'Corner' }, { id: 'specialty', icon: '✨', label: 'Special' },
  { id: 'accessories', icon: '🔧', label: 'Acc.' },
]

export default function CabinetCatalog({ baseHeight, projectDefaults, onSetupComplete, onAddCabinet }) {
  const [activeCategory, setActiveCategory] = useState('base')
  const [wallHeightFilter, setWallHeightFilter] = useState(null)
  const [subtypeFilter, setSubtypeFilter] = useState(null)
  const [search, setSearch] = useState('')
  if (!baseHeight || !projectDefaults) return <ProjectSetup onConfirm={onSetupComplete} />
  const library = buildLibrary(baseHeight)
  const items = library[activeCategory] || []
  let filtered = items
  if (activeCategory === 'wall' && wallHeightFilter) filtered = filtered.filter(i => i.wallHeight === wallHeightFilter)
  if (subtypeFilter) filtered = filtered.filter(i => i.subtype === subtypeFilter)
  if (search.trim()) filtered = filtered.filter(i => i.label.toLowerCase().includes(search.toLowerCase()) || String(i.width).includes(search))
  const displayItems = activeCategory === 'wall' && !subtypeFilter
    ? filtered.filter((item, idx, arr) => arr.findIndex(x => x.label === item.label && x.wallHeight === item.wallHeight) === idx)
    : filtered
  const handleAdd = (item) => onAddCabinet({ ...item, doorStyle: projectDefaults.doorStyle, golaColor: projectDefaults.golaColor, handlePosition: projectDefaults.handlePos, elevation: item.elevation || 0 })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #E8E4DF', flexShrink: 0 }}>
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => { setActiveCategory(cat.id); setSubtypeFilter(null); setWallHeightFilter(null); setSearch('') }}
            style={{ padding: '7px 2px', border: 'none', borderBottom: `2px solid ${activeCategory === cat.id ? ACCENT : 'transparent'}`, background: activeCategory === cat.id ? ACCENT+'10' : 'transparent', color: activeCategory === cat.id ? ACCENT : '#888', fontSize: 8, fontWeight: 700, cursor: 'pointer', textAlign: 'center', lineHeight: 1.4 }}>
            {cat.icon}<br/>{cat.label}
          </button>
        ))}
      </div>
      <div style={{ padding: '8px 8px 4px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ width: '100%', padding: '5px 8px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 11, outline: 'none', boxSizing: 'border-box', color: DARK }} />
      </div>
      <div style={{ padding: '0 8px', flexShrink: 0 }}>
        {activeCategory === 'wall' ? <WallHeightFilter baseHeight={baseHeight} selected={wallHeightFilter} onChange={setWallHeightFilter} /> : <SubtypeFilter items={items} selected={subtypeFilter} onChange={setSubtypeFilter} />}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 12px' }}>
        <div style={{ fontSize: 9, color: '#aaa', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
          <span>{activeCategory === 'wall' && <span>Elev: <strong style={{ color: ACCENT }}>{library.wallElevation}mm</strong> · </span>}Default: <strong style={{ color: ACCENT }}>{projectDefaults.doorStyle}</strong></span>
          <span style={{ color: '#ccc' }}>{displayItems.length}</span>
        </div>
        {displayItems.length === 0 ? <div style={{ textAlign: 'center', color: '#ccc', fontSize: 11, paddingTop: 20 }}>No items found</div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>{displayItems.map(item => <CabinetCard key={item.id} item={item} onAdd={handleAdd} />)}</div>}
      </div>
      <div style={{ padding: '8px', borderTop: '1px solid #E8E4DF', flexShrink: 0, background: '#FAFAFA' }}>
        <div style={{ fontSize: 9, color: '#999', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Project Defaults</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, background: ACCENT+'15', color: ACCENT, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>H{baseHeight}</span>
          <span style={{ fontSize: 9, background: '#f0f0f0', color: '#555', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{projectDefaults.doorStyle}</span>
          {projectDefaults.doorStyle === 'Gola' && <span style={{ fontSize: 9, background: '#f0f0f0', color: '#555', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{projectDefaults.golaColor}</span>}
          {projectDefaults.doorStyle === 'Handle' && <span style={{ fontSize: 9, background: '#f0f0f0', color: '#555', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Handle {projectDefaults.handlePos}</span>}
        </div>
      </div>
    </div>
  )
}