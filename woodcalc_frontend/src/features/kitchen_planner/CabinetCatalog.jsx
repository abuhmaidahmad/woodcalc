import React, { useState, useEffect } from 'react'
import MaterialLibrary from './MaterialLibrary'
import { authFetch } from '../../api/auth'
import { COUNTERTOP_MATERIALS, COUNTERTOP_CATEGORIES, COUNTERTOP_BRANDS, MATERIAL_DB, lamToCt } from './materialData'
export { COUNTERTOP_MATERIALS }

const API_URL = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

function forceHttps(url) {
  if (!url) return url
  return url.replace(/^http:\/\//i, 'https://')
}

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
  base_drawer_door: (<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="8" width="40" height="30" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><rect x="4" y="34" width="40" height="4" rx="1" fill="#e0d5c5" stroke="#2c3e50" strokeWidth="1.5"/><line x1="4" y1="18" x2="44" y2="18" stroke="#2c3e50" strokeWidth="1"/><line x1="4" y1="24" x2="44" y2="24" stroke="#2c3e50" strokeWidth="1"/><rect x="6" y="10" width="36" height="6" rx="1" fill="#C8902A" opacity="0.3"/><rect x="6" y="16" width="36" height="6" rx="1" fill="#C8902A" opacity="0.3"/><line x1="24" y1="24" x2="24" y2="34" stroke="#2c3e50" strokeWidth="1"/><circle cx="21" cy="29" r="1.5" fill="#2c3e50"/><circle cx="27" cy="29" r="1.5" fill="#2c3e50"/><rect x="6" y="38" width="4" height="4" rx="1" fill="#888"/><rect x="38" y="38" width="4" height="4" rx="1" fill="#888"/></svg>),
  base_island: (<svg viewBox="0 0 48 48" fill="none"><rect x="2" y="10" width="44" height="28" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><rect x="2" y="34" width="44" height="4" rx="1" fill="#e0d5c5" stroke="#2c3e50" strokeWidth="1.5"/><line x1="24" y1="10" x2="24" y2="34" stroke="#2c3e50" strokeWidth="1"/><circle cx="21" cy="22" r="1.5" fill="#2c3e50"/><circle cx="27" cy="22" r="1.5" fill="#2c3e50"/><rect x="4" y="38" width="4" height="4" rx="1" fill="#888"/><rect x="20" y="38" width="4" height="4" rx="1" fill="#888"/><rect x="40" y="38" width="4" height="4" rx="1" fill="#888"/></svg>),
  wall_standard: (<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="6" width="40" height="32" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><line x1="24" y1="6" x2="24" y2="38" stroke="#2c3e50" strokeWidth="1"/><circle cx="21" cy="22" r="1.5" fill="#2c3e50"/><circle cx="27" cy="22" r="1.5" fill="#2c3e50"/></svg>),
  wall_open: (<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="6" width="40" height="32" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><line x1="4" y1="22" x2="44" y2="22" stroke="#2c3e50" strokeWidth="1"/></svg>),
  wall_glass: (<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="6" width="40" height="32" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#e8f4fd"/><line x1="24" y1="6" x2="24" y2="38" stroke="#2c3e50" strokeWidth="1"/><rect x="6" y="8" width="16" height="28" rx="1" fill="#87CEEB" opacity="0.3" stroke="#87CEEB" strokeWidth="1"/><rect x="26" y="8" width="16" height="28" rx="1" fill="#87CEEB" opacity="0.3" stroke="#87CEEB" strokeWidth="1"/></svg>),
  wall_appliance: (<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="6" width="40" height="32" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><rect x="8" y="10" width="32" height="24" rx="1" fill="#333" opacity="0.15" stroke="#555" strokeWidth="1"/><circle cx="38" cy="12" r="2" fill="#C8902A"/><line x1="24" y1="14" x2="24" y2="30" stroke="#888" strokeWidth="0.5" strokeDasharray="2,2"/></svg>),
  tall_pantry: (<svg viewBox="0 0 48 48" fill="none"><rect x="10" y="2" width="28" height="44" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><line x1="24" y1="2" x2="24" y2="46" stroke="#2c3e50" strokeWidth="1"/><circle cx="21" cy="16" r="1.5" fill="#2c3e50"/><circle cx="27" cy="16" r="1.5" fill="#2c3e50"/><circle cx="21" cy="30" r="1.5" fill="#2c3e50"/><circle cx="27" cy="30" r="1.5" fill="#2c3e50"/><line x1="10" y1="24" x2="38" y2="24" stroke="#2c3e50" strokeWidth="0.75"/></svg>),
  tall_oven: (<svg viewBox="0 0 48 48" fill="none"><rect x="10" y="2" width="28" height="44" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><rect x="13" y="18" width="22" height="18" rx="1" stroke="#888" strokeWidth="1" fill="#e0e0e0"/><rect x="15" y="20" width="18" height="14" rx="1" fill="#555" opacity="0.3"/><line x1="10" y1="16" x2="38" y2="16" stroke="#2c3e50" strokeWidth="1"/><line x1="10" y1="38" x2="38" y2="38" stroke="#2c3e50" strokeWidth="1"/></svg>),
  tall_fridge: (<svg viewBox="0 0 48 48" fill="none"><rect x="10" y="2" width="28" height="44" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#e8f0f8"/><line x1="10" y1="20" x2="38" y2="20" stroke="#2c3e50" strokeWidth="1.5"/><circle cx="34" cy="11" r="1.5" fill="#2c3e50"/><circle cx="34" cy="30" r="1.5" fill="#2c3e50"/></svg>),
  tall_broom: (<svg viewBox="0 0 48 48" fill="none"><rect x="10" y="2" width="28" height="44" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><circle cx="24" cy="24" r="2" fill="#2c3e50"/><line x1="24" y1="6" x2="24" y2="42" stroke="#2c3e50" strokeWidth="0.75" strokeDasharray="3,3"/></svg>),
  tall_double_oven: (<svg viewBox="0 0 48 48" fill="none"><rect x="10" y="2" width="28" height="44" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><rect x="13" y="6" width="22" height="14" rx="1" stroke="#888" strokeWidth="1" fill="#e0e0e0"/><rect x="15" y="8" width="18" height="10" rx="1" fill="#555" opacity="0.3"/><rect x="13" y="24" width="22" height="14" rx="1" stroke="#888" strokeWidth="1" fill="#e0e0e0"/><rect x="15" y="26" width="18" height="10" rx="1" fill="#555" opacity="0.3"/></svg>),
  vanity_sink: (<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="10" width="40" height="26" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><rect x="4" y="32" width="40" height="4" rx="1" fill="#e0d5c5" stroke="#2c3e50" strokeWidth="1.5"/><ellipse cx="24" cy="21" rx="10" ry="7" stroke="#4FC3F7" strokeWidth="1.5" fill="#e8f4fd"/><circle cx="24" cy="21" r="2" fill="#4FC3F7"/><rect x="6" y="36" width="4" height="6" rx="1" fill="#888"/><rect x="38" y="36" width="4" height="6" rx="1" fill="#888"/></svg>),
  vanity_drawers: (<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="10" width="40" height="26" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><rect x="4" y="32" width="40" height="4" rx="1" fill="#e0d5c5" stroke="#2c3e50" strokeWidth="1.5"/><line x1="4" y1="22" x2="44" y2="22" stroke="#2c3e50" strokeWidth="1"/><rect x="16" y="14" width="16" height="6" rx="1" fill="#C8902A" opacity="0.4"/><rect x="16" y="24" width="16" height="6" rx="1" fill="#C8902A" opacity="0.4"/><rect x="6" y="36" width="4" height="6" rx="1" fill="#888"/><rect x="38" y="36" width="4" height="6" rx="1" fill="#888"/></svg>),
  corner_blind: (<svg viewBox="0 0 48 48" fill="none"><path d="M4 8 L44 8 L44 38 L24 38 L24 44 L4 44 Z" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><line x1="24" y1="8" x2="24" y2="38" stroke="#2c3e50" strokeWidth="1"/><circle cx="33" cy="23" r="1.5" fill="#2c3e50"/><circle cx="14" cy="36" r="1.5" fill="#2c3e50"/></svg>),
  corner_l: (<svg viewBox="0 0 48 48" fill="none"><path d="M4 4 L44 4 L44 24 L24 24 L24 44 L4 44 Z" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><line x1="4" y1="24" x2="24" y2="24" stroke="#2c3e50" strokeWidth="1"/><line x1="24" y1="4" x2="24" y2="24" stroke="#2c3e50" strokeWidth="1"/></svg>),
  corner_diagonal: (<svg viewBox="0 0 48 48" fill="none"><path d="M14 4 L44 4 L44 34 Z" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><line x1="14" y1="4" x2="44" y2="34" stroke="#2c3e50" strokeWidth="1"/></svg>),
  specialty_tv: (<svg viewBox="0 0 48 48" fill="none"><rect x="2" y="8" width="44" height="26" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><rect x="2" y="30" width="44" height="8" rx="1" fill="#e0d5c5" stroke="#2c3e50" strokeWidth="1.5"/><rect x="6" y="11" width="36" height="16" rx="1" fill="#333" opacity="0.15"/><line x1="16" y1="30" x2="16" y2="38" stroke="#2c3e50" strokeWidth="1"/><line x1="32" y1="30" x2="32" y2="38" stroke="#2c3e50" strokeWidth="1"/></svg>),
  specialty_custom: (<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="8" width="40" height="32" rx="1" stroke="#C8902A" strokeWidth="1.5" fill="#C8902A" fillOpacity="0.08" strokeDasharray="4,3"/><text x="24" y="28" textAnchor="middle" fontSize="18" fill="#C8902A" fontFamily="Inter,sans-serif">?</text></svg>),
  accessory_filler: (<svg viewBox="0 0 48 48" fill="none"><rect x="18" y="4" width="12" height="40" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#e8e4df" strokeDasharray="3,2"/><line x1="18" y1="12" x2="30" y2="12" stroke="#888" strokeWidth="0.75"/><line x1="18" y1="20" x2="30" y2="20" stroke="#888" strokeWidth="0.75"/><line x1="18" y1="28" x2="30" y2="28" stroke="#888" strokeWidth="0.75"/><line x1="18" y1="36" x2="30" y2="36" stroke="#888" strokeWidth="0.75"/></svg>),
  accessory_shelf: (<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="20" width="40" height="6" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#f5f0e8"/><rect x="8" y="26" width="3" height="14" rx="1" fill="#888"/><rect x="37" y="26" width="3" height="14" rx="1" fill="#888"/></svg>),
  accessory_gap_oven: (<svg viewBox="0 0 48 48" fill="none"><rect x="6" y="18" width="36" height="24" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#2b2b2b" fillOpacity="0.85"/><rect x="10" y="24" width="28" height="14" rx="1" fill="#111"/><rect x="6" y="10" width="36" height="8" rx="1" fill="#ddd" stroke="#2c3e50" strokeWidth="1"/><circle cx="14" cy="14" r="2" fill="#333"/><circle cx="24" cy="14" r="2" fill="#333"/><circle cx="34" cy="14" r="2" fill="#333"/></svg>),
  accessory_gap_fridge: (<svg viewBox="0 0 48 48" fill="none"><rect x="10" y="2" width="28" height="44" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#e8f0f8"/><line x1="10" y1="26" x2="38" y2="26" stroke="#2c3e50" strokeWidth="1.5"/><circle cx="34" cy="14" r="1.5" fill="#2c3e50"/><circle cx="34" cy="34" r="1.5" fill="#2c3e50"/></svg>),
  accessory_gap_dish: (<svg viewBox="0 0 48 48" fill="none"><rect x="4" y="8" width="40" height="32" rx="1" stroke="#2c3e50" strokeWidth="1.5" fill="#eef0f1"/><rect x="8" y="12" width="32" height="6" rx="1" fill="#3d3d3d"/><circle cx="14" cy="15" r="1" fill="#111"/><circle cx="20" cy="15" r="1" fill="#111"/></svg>),
}

function buildLibrary(baseHeight) {
  const wallInc = baseHeight === 720 ? 180 : 200
  const wallHeights = []
  for (let h = wallInc; h <= wallInc * 6; h += wallInc) wallHeights.push(h)
  const wallElevation = baseHeight === 720 ? 1470 : 1480
  const baseWidths  = [200, 300, 400, 500, 600, 700, 800, 900, 1000, 1200]
  const wallWidths  = [200, 300, 400, 500, 600, 700, 800, 900]
  const tallWidths  = [300, 400, 500, 600, 700, 800, 900, 1000]
  const vanityWidths = [450, 600, 750, 900]
  const islandWidths = [600, 700, 800, 900, 1000, 1200]

  const base = [
    ...baseWidths.map(w => ({ id: `base_std_${w}`, label: `Base ${w}`, subtype: 'Standard', width: w, height: baseHeight, depth: 560, icon: 'base_standard', category: 'base' })),
    ...baseWidths.filter(w => w >= 400).map(w => ({ id: `base_sink_${w}`, label: `Sink ${w}`, subtype: 'Sink', width: w, height: baseHeight, depth: 560, icon: 'base_sink', category: 'base' })),
    ...[300, 400, 450, 500, 600].map(w => ({ id: `base_drw_${w}`, label: `Drawers ${w}`, subtype: 'Drawers', width: w, height: baseHeight, depth: 560, icon: 'base_drawers', category: 'base' })),
    ...[400, 500, 600, 700, 800].map(w => ({ id: `base_dd_${w}`, label: `2Drw+Door ${w}`, subtype: '2Drw+Door', width: w, height: baseHeight, depth: 560, icon: 'base_drawer_door', category: 'base' })),
    ...islandWidths.map(w => ({ id: `base_isl_${w}`, label: `Island ${w}`, subtype: 'Island', width: w, height: baseHeight, depth: 600, icon: 'base_island', category: 'base' })),
  ]

  const wall = wallWidths.flatMap(w => wallHeights.flatMap(h => [
    { id: `wall_std_${w}_${h}`,  label: `Wall ${w}`,      subtype: 'Standard',   width: w, height: h, depth: 300, icon: 'wall_standard',  category: 'wall', wallHeight: h, elevation: wallElevation },
    { id: `wall_open_${w}_${h}`, label: `Open ${w}`,      subtype: 'Open Shelf', width: w, height: h, depth: 300, icon: 'wall_open',       category: 'wall', wallHeight: h, elevation: wallElevation },
    { id: `wall_glass_${w}_${h}`,label: `Glass ${w}`,     subtype: 'Glass Door', width: w, height: h, depth: 300, icon: 'wall_glass',      category: 'wall', wallHeight: h, elevation: wallElevation },
    { id: `wall_app_${w}_${h}`,  label: `Appliance ${w}`, subtype: 'Appliance',  width: w, height: h, depth: 350, icon: 'wall_appliance',  category: 'wall', wallHeight: h, elevation: wallElevation },
  ]))

  const tall = [
    ...tallWidths.map(w => ({ id: `tall_pantry_${w}`,      label: `Pantry ${w}`,       subtype: 'Pantry',       width: w, height: 2220, depth: 560, icon: 'tall_pantry',      category: 'tall' })),
    ...tallWidths.filter(w => w >= 600).map(w => ({ id: `tall_oven_${w}`, label: `Oven Tower ${w}`, subtype: 'Oven Tower', width: w, height: 2220, depth: 560, icon: 'tall_oven', category: 'tall' })),
    ...tallWidths.filter(w => w >= 600).map(w => ({ id: `tall_doven_${w}`,label: `Dbl Oven ${w}`,   subtype: 'Double Oven',width: w, height: 2220, depth: 560, icon: 'tall_double_oven', category: 'tall' })),
    ...[600, 700, 800, 900].map(w => ({ id: `tall_fridge_${w}`, label: `Fridge ${w}`,  subtype: 'Fridge',       width: w, height: 2220, depth: 600, icon: 'tall_fridge',      category: 'tall' })),
    ...tallWidths.map(w => ({ id: `tall_broom_${w}`,        label: `Broom ${w}`,        subtype: 'Broom/Linen',  width: w, height: 2220, depth: 560, icon: 'tall_broom',       category: 'tall' })),
  ]

  const vanity = [
    ...vanityWidths.map(w => ({ id: `van_sink_${w}`,  label: `Vanity ${w}`,       subtype: 'Single Sink',  width: w, height: baseHeight, depth: 550, icon: 'vanity_sink',    category: 'vanity' })),
    ...[750, 900].map(w =>    ({ id: `van_dsink_${w}`, label: `Double Sink ${w}`,  subtype: 'Double Sink',  width: w, height: baseHeight, depth: 550, icon: 'vanity_sink',    category: 'vanity' })),
    ...vanityWidths.map(w => ({ id: `van_drw_${w}`,   label: `Vanity Drw ${w}`,   subtype: 'Drawers',      width: w, height: baseHeight, depth: 550, icon: 'vanity_drawers', category: 'vanity' })),
  ]

  const corner = [
    { id: 'corner_blind_1000', label: 'Blind 1000',    subtype: 'Blind',   width: 1000, height: baseHeight, depth: 560,  icon: 'corner_blind',    category: 'corner' },
    { id: 'corner_blind_1100', label: 'Blind 1100',    subtype: 'Blind',   width: 1100, height: baseHeight, depth: 560,  icon: 'corner_blind',    category: 'corner' },
    { id: 'corner_blind_1200', label: 'Blind 1200',    subtype: 'Blind',   width: 1200, height: baseHeight, depth: 560,  icon: 'corner_blind',    category: 'corner' },
    { id: 'corner_l_900',      label: 'L-Shape 900',   subtype: 'L-Shape', width: 900,  height: baseHeight, depth: 900,  icon: 'corner_l',        category: 'corner' },
    { id: 'corner_l_1000',     label: 'L-Shape 1000',  subtype: 'L-Shape', width: 1000, height: baseHeight, depth: 1000, icon: 'corner_l',        category: 'corner' },
    { id: 'corner_diag',       label: 'Diagonal Wall', subtype: 'Diagonal',width: 900,  height: wallHeights[1] || wallInc * 2, depth: 300, icon: 'corner_diagonal', category: 'corner' },
  ]

  const specialty = [
    { id: 'spec_tv',      label: 'TV Unit',      subtype: 'Custom', width: 1800, height: 600,        depth: 400, icon: 'specialty_tv',     category: 'specialty', isCustom: true },
    { id: 'spec_laundry', label: 'Laundry',      subtype: 'Custom', width: 600,  height: baseHeight, depth: 560, icon: 'specialty_custom', category: 'specialty', isCustom: true },
    { id: 'spec_linen',   label: 'Linen Tower',  subtype: 'Custom', width: 450,  height: 2220,       depth: 400, icon: 'tall_pantry',      category: 'specialty', isCustom: true },
    { id: 'spec_bar',     label: 'Bar Unit',     subtype: 'Custom', width: 900,  height: baseHeight, depth: 560, icon: 'base_standard',    category: 'specialty', isCustom: true },
    { id: 'spec_coffee',  label: 'Coffee Station',subtype: 'Custom', width: 600,  height: 2220,       depth: 400, icon: 'tall_oven',        category: 'specialty', isCustom: true },
  ]

  const accessories = [
    { id: 'acc_sidepanel_base', label: 'Side Panel Base', subtype: 'Side Panel', width: 18, height: baseHeight, depth: 581, icon: 'accessory_filler', category: 'accessories' },
    { id: 'acc_sidepanel_wall', label: 'Side Panel Wall', subtype: 'Side Panel', width: 18, height: wallHeights[0], depth: 321, icon: 'accessory_filler', category: 'accessories', wallHeight: wallHeights[0], elevation: wallElevation },
    { id: 'acc_sidepanel_tall', label: 'Side Panel Tall', subtype: 'Side Panel', width: 18, height: 2220, depth: 581, icon: 'accessory_filler', category: 'accessories' },
    { id: 'acc_filler_50',   label: 'Filler 50mm',   subtype: 'Filler',    width: 50,   height: baseHeight, depth: 560, icon: 'accessory_filler', category: 'accessories' },
    { id: 'acc_filler_100',  label: 'Filler 100mm',  subtype: 'Filler',    width: 100,  height: baseHeight, depth: 560, icon: 'accessory_filler', category: 'accessories' },
    { id: 'acc_filler_150',  label: 'Filler 150mm',  subtype: 'Filler',    width: 150,  height: baseHeight, depth: 560, icon: 'accessory_filler', category: 'accessories' },
    { id: 'acc_sidepanel',   label: 'Side Panel',    subtype: 'Panel',     width: 18,   height: baseHeight, depth: 560, icon: 'accessory_filler', category: 'accessories' },
    { id: 'acc_shelf_400',   label: 'Shelf 400',     subtype: 'Shelf',     width: 400,  height: 30,         depth: 250, icon: 'accessory_shelf',  category: 'accessories' },
    { id: 'acc_shelf_600',   label: 'Shelf 600',     subtype: 'Shelf',     width: 600,  height: 30,         depth: 250, icon: 'accessory_shelf',  category: 'accessories' },
    { id: 'acc_shelf_900',   label: 'Shelf 900',     subtype: 'Shelf',     width: 900,  height: 30,         depth: 250, icon: 'accessory_shelf',  category: 'accessories' },
    { id: 'acc_shelf_1200',  label: 'Shelf 1200',    subtype: 'Shelf',     width: 1200, height: 30,         depth: 250, icon: 'accessory_shelf',  category: 'accessories' },
    { id: 'acc_toekick_600', label: 'Toe Kick 600',  subtype: 'Toe Kick',  width: 600,  height: 100,        depth: 60,  icon: 'accessory_filler', category: 'accessories' },
    { id: 'acc_toekick_900', label: 'Toe Kick 900',  subtype: 'Toe Kick',  width: 900,  height: 100,        depth: 60,  icon: 'accessory_filler', category: 'accessories' },
    { id: 'acc_toekick_1200',label: 'Toe Kick 1200', subtype: 'Toe Kick',  width: 1200, height: 100,        depth: 60,  icon: 'accessory_filler', category: 'accessories' },
    { id: 'acc_free_oven',       label: 'Freestanding Oven',       subtype: 'Freestanding Oven',       width: 600, height: 850,  depth: 600, icon: 'accessory_gap_oven',   category: 'accessories' },
    { id: 'acc_free_fridge_700', label: 'Freestanding Fridge 700', subtype: 'Freestanding Fridge',     width: 700, height: 1800, depth: 700, icon: 'accessory_gap_fridge', category: 'accessories' },
    { id: 'acc_free_fridge_900', label: 'Freestanding Fridge 900', subtype: 'Freestanding Fridge',     width: 900, height: 1800, depth: 750, icon: 'accessory_gap_fridge', category: 'accessories' },
    { id: 'acc_free_dish',       label: 'Freestanding Dishwasher', subtype: 'Freestanding Dishwasher', width: 600, height: 820,  depth: 600, icon: 'accessory_gap_dish',   category: 'accessories' },
  ]

  return { base, wall, tall, vanity, corner, specialty, accessories, wallElevation }
}

export function CountertopPicker({ selected, onSelect }) {
  const [brand, setBrand] = useState('my_library')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [catalogWorktops, setCatalogWorktops] = useState([])

  useEffect(() => {
    authFetch(API_URL + '/api/inventory/textures/?material_type=worktop')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.results || [])
        setCatalogWorktops(list)
      })
      .catch(() => {})
  }, [])

  const myMaterials = catalogWorktops.map(t => ({
    id: `custom-${t.id}`,
    name: t.name,
    brand: t.supplier_name || 'My Library',
    code: t.code || '',
    color: t.fallback_hex || '#C0C0C0',
    category: 'custom',
    textureUrl: forceHttps(t.texture_image),
    roughness: t.roughness ?? 0.3,
    metalness: t.metalness ?? 0.0,
    physical_width_mm:  t.texture_physical_width_mm  || 600,
    physical_height_mm: t.texture_physical_height_mm || 600,
  }))

  const isMyLibrary = brand === 'my_library'
  const isLaminateBrand = Object.keys(MATERIAL_DB).includes(brand)

  const activeMaterials = isMyLibrary
    ? myMaterials
    : isLaminateBrand
      ? MATERIAL_DB[brand].materials.map(m => lamToCt(m, MATERIAL_DB[brand].label))
      : COUNTERTOP_MATERIALS.filter(m => brand === 'All' || m.brand === brand)

  const filtered = activeMaterials.filter(m => {
    if (!isMyLibrary && category !== 'all' && m.category !== category) return false
    if (search) {
      const q = search.toLowerCase()
      return m.name.toLowerCase().includes(q) || (m.code || '').toLowerCase().includes(q) || (m.brand || '').toLowerCase().includes(q)
    }
    return true
  })

  const allLamMaterials = Object.entries(MATERIAL_DB).flatMap(([, b]) => b.materials.map(m => lamToCt(m, b.label)))
  const allMaterials = [...myMaterials, ...COUNTERTOP_MATERIALS, ...allLamMaterials]
  const selectedMat = allMaterials.find(m => m.id === selected)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Brand tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        <button onClick={() => { setBrand('my_library'); setCategory('all') }}
          style={{ padding: '3px 7px', borderRadius: 5, border: '1.5px solid', fontSize: 10, fontWeight: 600, cursor: 'pointer',
            borderColor: brand === 'my_library' ? ACCENT : '#E0DAD4', background: brand === 'my_library' ? ACCENT+'18' : '#fff', color: brand === 'my_library' ? ACCENT : '#666' }}>
          📁 My Library {catalogWorktops.length > 0 ? `(${catalogWorktops.length})` : ''}
        </button>
        {COUNTERTOP_BRANDS.map(b => (
          <button key={b} onClick={() => { setBrand(b); setCategory('all') }}
            style={{ padding: '3px 7px', borderRadius: 5, border: '1.5px solid', fontSize: 10, fontWeight: 600, cursor: 'pointer',
              borderColor: brand === b ? ACCENT : '#E0DAD4', background: brand === b ? ACCENT+'18' : '#fff', color: brand === b ? ACCENT : '#666' }}>
            {b}
          </button>
        ))}
        <span style={{ width: '100%', borderTop: '1px solid #E0DAD4', margin: '2px 0', fontSize: 9, color: '#bbb', letterSpacing: '0.06em', paddingTop: 3 }}>
          LAMINATE BOARDS
        </span>
        {Object.entries(MATERIAL_DB).map(([key, b]) => (
          <button key={key} onClick={() => { setBrand(key); setCategory('all') }}
            style={{ padding: '3px 7px', borderRadius: 5, border: '1.5px solid', fontSize: 10, fontWeight: 600, cursor: 'pointer',
              borderColor: brand === key ? ACCENT : '#E0DAD4', background: brand === key ? ACCENT+'18' : '#fff', color: brand === key ? ACCENT : '#666' }}>
            {b.logo} {b.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <input placeholder="Search material..." value={search} onChange={e => setSearch(e.target.value)}
        style={{ padding: '5px 8px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 11, outline: 'none', width: '100%', boxSizing: 'border-box' }} />

      {/* Category filter */}
      {!isMyLibrary && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {(isLaminateBrand ? ['all', 'solid', 'wood'] : COUNTERTOP_CATEGORIES).map(c => (
            <button key={c} onClick={() => setCategory(c)}
              style={{ padding: '3px 6px', borderRadius: 5, border: '1.5px solid', fontSize: 9, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                borderColor: category === c ? ACCENT : '#E0DAD4', background: category === c ? ACCENT+'18' : '#fff', color: category === c ? ACCENT : '#666' }}>
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Swatch grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, maxHeight: 260, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', fontSize: 11, color: '#bbb', padding: '12px 0', textAlign: 'center' }}>
            {isMyLibrary ? 'No worktop materials in catalog yet. Add them at /catalog.' : 'No results'}
          </div>
        )}
        {filtered.map(mat => {
          const isSel = selected === mat.id
          return (
            <div key={mat.id} onClick={() => onSelect(mat)}
              style={{ borderRadius: 7, border: `2px solid ${isSel ? ACCENT : '#E0DAD4'}`, background: isSel ? ACCENT+'08' : '#FAFAFA', cursor: 'pointer', overflow: 'hidden' }}
              onMouseEnter={e => { if (!isSel) e.currentTarget.style.borderColor = '#C8A06A' }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.borderColor = '#E0DAD4' }}>
              {/* Swatch — photo if catalog, else color */}
              <div style={{ height: 40, background: mat.color, position: 'relative', overflow: 'hidden',
                backgroundImage: !mat.textureUrl ? (
                  mat.category === 'marble' ? `linear-gradient(125deg, rgba(255,255,255,0.15) 0%, transparent 40%, rgba(255,255,255,0.08) 60%, transparent 100%)` :
                  mat.category === 'wood'   ? `repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(0,0,0,0.04) 4px, rgba(0,0,0,0.04) 5px)` :
                  mat.category === 'concrete' ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Ccircle cx='1' cy='1' r='0.5' fill='rgba(0,0,0,0.08)'/%3E%3C/svg%3E")` : 'none'
                ) : 'none' }}>
                {mat.textureUrl && (
                  <img src={mat.textureUrl} alt={mat.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.target.style.display = 'none' }} />
                )}
              </div>
              <div style={{ padding: '4px 6px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#333', lineHeight: 1.2 }}>{mat.name}</div>
                <div style={{ fontSize: 8, color: '#888' }}>{mat.brand}{mat.code ? ` · ${mat.code}` : ''}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected display */}
      {selectedMat && (
        <div style={{ padding: '6px 8px', background: '#F5F0E8', borderRadius: 7, border: `1.5px solid ${ACCENT}33`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 4, background: selectedMat.color, border: '1px solid #ddd', flexShrink: 0, overflow: 'hidden' }}>
            {selectedMat.textureUrl && (
              <img src={selectedMat.textureUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.target.style.display = 'none' }} />
            )}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: DARK }}>{selectedMat.name}</div>
            <div style={{ fontSize: 9, color: '#888' }}>{selectedMat.brand}{selectedMat.code ? ` · ${selectedMat.code}` : ''}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectSetup({ onConfirm, initial }) {
  const [baseHeight, setBaseHeight]     = useState(initial?.baseHeight || null)
  const [doorStyle, setDoorStyle]       = useState(initial?.doorStyle || null)
  const [golaColor, setGolaColor]       = useState(initial?.golaColor || 'black')
  const [handlePos, setHandlePos]       = useState(initial?.handlePos || 'bottom')
  const [carcassColor, setCarcassColor] = useState(initial?.carcassColor || '#F5F0E8')
  const [frontColor, setFrontColor]     = useState(initial?.frontColor || '#FFFFFF')
  const [frontMaterialCode, setFrontMaterialCode] = useState(initial?.frontMaterialCode || null)
  const [drawerSystems, setDrawerSystems] = useState([])
  const [drawerSystem, setDrawerSystem] = useState(null)
  useEffect(() => {
    authFetch(API_URL + '/api/inventory/drawer-systems/')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.results || [])
        setDrawerSystems(list)
        const saved = initial?.drawerSystem ? list.find(s => s.name === initial.drawerSystem) : null
        if (saved) setDrawerSystem(saved)
        else if (list.length && !drawerSystem) setDrawerSystem(list[0])
      })
      .catch(() => {})
  }, [])
  const [frontMaterialThickness, setFrontMaterialThickness] = useState(initial?.frontMaterialThickness || 18)
  const [frontFinish, setFrontFinish]   = useState(initial?.frontFinish || 'matt')
  const [skirtingMaterial, setSkirtingMaterial] = useState(initial?.skirtingMaterial || 'match_countertop')
  const [carcassSearch, setCarcassSearch] = useState('')
  const ready = baseHeight && doorStyle

  const CARCASS_OPTIONS = [
    { color: '#F5F0E8', label: 'Cream White' }, { color: '#FFFFFF', label: 'White' },
    { color: '#E8E4DC', label: 'Off White' },   { color: '#C8C4BE', label: 'Light Grey' },
    { color: '#4A4846', label: 'Anthracite' },  { color: '#1A1A1A', label: 'Black' },
  ]
  const SKIRTING_OPTIONS = [
    { id: 'match_countertop', label: 'Match Countertop', swatch: null },
    { id: 'pvc_black', label: 'PVC Black', swatch: '#1a1a1a' },
    { id: 'pvc_champagne', label: 'PVC Champagne', swatch: '#c8a96e' },
    { id: 'pvc_silver', label: 'PVC Silver', swatch: '#c0c0c0' },
  ]

  const filteredCarcass = carcassSearch
    ? CARCASS_OPTIONS.filter(o => o.label.toLowerCase().includes(carcassSearch.toLowerCase()))
    : CARCASS_OPTIONS


  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: DARK, marginBottom: 4 }}>Project Setup</div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>Set your kitchen standards. You can change per cabinet later.</div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Base Cabinet Height</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          {[720, 800].map(h => (
            <div key={h} onClick={() => setBaseHeight(h)} style={{ flex: 1, padding: '12px 10px', border: `2px solid ${baseHeight === h ? ACCENT : '#E0DAD4'}`, borderRadius: 10, cursor: 'pointer', background: baseHeight === h ? ACCENT+'10' : '#FAFAFA', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: baseHeight === h ? ACCENT : DARK }}>{h}mm</div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{h === 720 ? '180mm wall increments' : '200mm wall increments'}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Default Door Style</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {[{ id: 'Handle', icon: '🔲', desc: 'Bar handle' }, { id: 'Push', icon: '👆', desc: 'Push-to-open' }, { id: 'Gola', icon: '▬', desc: 'Aluminum channel' }].map(s => (
            <div key={s.id} onClick={() => setDoorStyle(s.id)} style={{ flex: 1, padding: '10px 6px', border: `2px solid ${doorStyle === s.id ? ACCENT : '#E0DAD4'}`, borderRadius: 8, cursor: 'pointer', background: doorStyle === s.id ? ACCENT+'10' : '#FAFAFA', textAlign: 'center' }}>
              <div style={{ fontSize: 18, marginBottom: 2 }}>{s.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: doorStyle === s.id ? ACCENT : DARK }}>{s.id}</div>
              <div style={{ fontSize: 9, color: '#999' }}>{s.desc}</div>
            </div>
          ))}
        </div>

        {doorStyle === 'Handle' && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Handle Position</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              {[{ id: 'top', icon: '⬆' }, { id: 'bottom', icon: '⬇' }].map(p => (
                <div key={p.id} onClick={() => setHandlePos(p.id)} style={{ flex: 1, padding: '10px', border: `2px solid ${handlePos === p.id ? ACCENT : '#E0DAD4'}`, borderRadius: 8, cursor: 'pointer', background: handlePos === p.id ? ACCENT+'10' : '#FAFAFA', textAlign: 'center' }}>
                  <div style={{ fontSize: 16 }}>{p.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: handlePos === p.id ? ACCENT : DARK }}>{p.id}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {doorStyle === 'Gola' && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Gola Color</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              {[{ id: 'black', color: '#1a1a1a' }, { id: 'silver', color: '#c0c0c0' }, { id: 'champagne', color: '#c8a96e' }].map(g => (
                <div key={g.id} onClick={() => setGolaColor(g.id)} style={{ flex: 1, padding: '10px 6px', border: `2px solid ${golaColor === g.id ? ACCENT : '#E0DAD4'}`, borderRadius: 8, cursor: 'pointer', background: golaColor === g.id ? ACCENT+'10' : '#FAFAFA', textAlign: 'center' }}>
                  <div style={{ width: 28, height: 8, borderRadius: 4, background: g.color, margin: '0 auto 5px' }} />
                  <div style={{ fontSize: 10, fontWeight: 700, color: golaColor === g.id ? ACCENT : DARK, textTransform: 'capitalize' }}>{g.id}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Default Carcass Color</div>
        <input
          value={carcassSearch} onChange={e => setCarcassSearch(e.target.value)}
          placeholder="Search carcass color..."
          style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #E0DAD4', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 18 }}>
          {filteredCarcass.map(opt => {
            const active = carcassColor === opt.color
            return (
              <div key={opt.color} onClick={() => setCarcassColor(opt.color)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, cursor: 'pointer', border: `2px solid ${active ? ACCENT : '#E0DAD4'}`, background: active ? ACCENT + '10' : '#FAFAFA' }}>
                <div style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0, background: opt.color, border: '1.5px solid rgba(0,0,0,0.10)' }} />
                <div style={{ fontSize: 10, fontWeight: 700, color: active ? ACCENT : DARK, lineHeight: 1.2 }}>{opt.label}</div>
              </div>
            )
          })}
          {filteredCarcass.length === 0 && (
            <div style={{ gridColumn: '1/-1', fontSize: 11, color: '#bbb', padding: '8px 0' }}>No match</div>
          )}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Default Front Material</div>
        <MaterialLibrary
          target="front"
          selectedCode={frontMaterialCode}
          onSelect={mat => {
            setFrontColor(mat.hex)
            setFrontFinish(mat.finish)
            setFrontMaterialCode(mat.code)
            setFrontMaterialThickness(mat.thickness || (mat.finish === 'wood' ? 22 : 18))
          }}
        />
        {frontMaterialCode && (
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
            Selected: <strong style={{ color: DARK }}>{frontMaterialCode}</strong>
          </div>
        )}
        <div style={{ marginBottom: 16 }} />

        <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Drawer System</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {drawerSystems.map(sys => (
            <div key={sys.id} onClick={() => setDrawerSystem(sys)}
              style={{ flex: '1 1 30%', padding: '8px 6px', border: `2px solid ${drawerSystem?.id === sys.id ? ACCENT : '#E0DAD4'}`, borderRadius: 8, cursor: 'pointer',
                background: drawerSystem?.id === sys.id ? ACCENT + '10' : '#FAFAFA', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: drawerSystem?.id === sys.id ? ACCENT : DARK }}>{sys.name}</div>
              <div style={{ fontSize: 8, color: '#999', marginTop: 2 }}>{sys.brand}{sys.box_construction === 'wood_box' ? ' · wood box' : ''}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Skirting Board Material</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {SKIRTING_OPTIONS.map(opt => (
            <div key={opt.id} onClick={() => setSkirtingMaterial(opt.id)} style={{ flex: '1 1 45%', padding: '8px 6px', border: `2px solid ${skirtingMaterial === opt.id ? ACCENT : '#E0DAD4'}`, borderRadius: 8, cursor: 'pointer', background: skirtingMaterial === opt.id ? ACCENT+'10' : '#FAFAFA', textAlign: 'center', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              {opt.swatch ? (
                <div style={{ width: 16, height: 16, borderRadius: 3, background: opt.swatch, flexShrink: 0 }} />
              ) : (
                <span style={{ fontSize: 13 }}>🪨</span>
              )}
              <div style={{ fontSize: 10, fontWeight: 700, color: skirtingMaterial === opt.id ? ACCENT : DARK }}>{opt.label}</div>
            </div>
          ))}
        </div>

        <button onClick={() => ready && onConfirm({ baseHeight, doorStyle, golaColor, handlePos, carcassColor, frontColor, frontFinish, frontMaterialCode, frontMaterialThickness, skirtingMaterial, drawerSystem: drawerSystem?.name || 'Local Bearing', drawerBoxConstruction: drawerSystem?.box_construction || 'wood_box' })}
          disabled={!ready}
          style={{ width: '100%', padding: '13px', background: ready ? ACCENT : '#E0DAD4', color: '#fff', border: 'none', borderRadius: 8, cursor: ready ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 700 }}>
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
  { id: 'base',        icon: '🗄',  label: 'Base'    },
  { id: 'wall',        icon: '🪟',  label: 'Wall'    },
  { id: 'tall',        icon: '🏛',  label: 'Tall'    },
  { id: 'vanity',      icon: '🚿',  label: 'Vanity'  },
  { id: 'corner',      icon: '📐',  label: 'Corner'  },
  { id: 'specialty',   icon: '✨',  label: 'Special' },
  { id: 'accessories', icon: '🔧',  label: 'Acc.'    },
]

export default function CabinetCatalog({ baseHeight, projectDefaults, onSetupComplete, onAddCabinet }) {
  const [activeCategory, setActiveCategory] = useState('base')
  const [wallHeightFilter, setWallHeightFilter] = useState(null)
  const [subtypeFilter, setSubtypeFilter] = useState(null)
  const [search, setSearch] = useState('')

  if (!baseHeight || !projectDefaults) return <ProjectSetup onConfirm={onSetupComplete} initial={projectDefaults ? { ...projectDefaults, baseHeight: baseHeight || projectDefaults.baseHeight } : null} />

  const library = buildLibrary(baseHeight)
  const items = library[activeCategory] || []
  let filtered = items
  if (activeCategory === 'wall' && wallHeightFilter) filtered = filtered.filter(i => i.wallHeight === wallHeightFilter)
  if (subtypeFilter) filtered = filtered.filter(i => i.subtype === subtypeFilter)
  if (search.trim()) filtered = filtered.filter(i => i.label.toLowerCase().includes(search.toLowerCase()) || String(i.width).includes(search))
  const displayItems = activeCategory === 'wall' && !subtypeFilter
    ? filtered.filter((item, idx, arr) => arr.findIndex(x => x.label === item.label && x.wallHeight === item.wallHeight) === idx)
    : filtered

  const handleAdd = (item) => onAddCabinet({
    ...item,
    doorStyle:    projectDefaults.doorStyle,
    golaColor:    projectDefaults.golaColor,
    handlePosition: projectDefaults.handlePos,
    elevation:    item.elevation || 0,
    carcassColor: projectDefaults.carcassColor || '#F5F0E8',
    frontColor:   projectDefaults.frontColor   || '#FFFFFF',
    frontMaterial: projectDefaults.frontFinish || 'matt',
  })

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
        {activeCategory === 'wall'
          ? <WallHeightFilter baseHeight={baseHeight} selected={wallHeightFilter} onChange={setWallHeightFilter} />
          : <SubtypeFilter items={items} selected={subtypeFilter} onChange={setSubtypeFilter} />}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 12px' }}>
        <div style={{ fontSize: 9, color: '#aaa', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
          <span>{activeCategory === 'wall' && <span>Elev: <strong style={{ color: ACCENT }}>{library.wallElevation}mm</strong> · </span>}Default: <strong style={{ color: ACCENT }}>{projectDefaults.doorStyle}</strong></span>
          <span style={{ color: '#ccc' }}>{displayItems.length}</span>
        </div>
        {displayItems.length === 0
          ? <div style={{ textAlign: 'center', color: '#ccc', fontSize: 11, paddingTop: 20 }}>No items found</div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>{displayItems.map(item => <CabinetCard key={item.id} item={item} onAdd={handleAdd} />)}</div>}
      </div>
      <div style={{ padding: '8px', borderTop: '1px solid #E8E4DF', flexShrink: 0, background: '#FAFAFA' }}>
        <div style={{ fontSize: 9, color: '#999', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Project Defaults</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 9, background: ACCENT+'15', color: ACCENT, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>H{baseHeight}</span>
          <span style={{ fontSize: 9, background: '#f0f0f0', color: '#555', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{projectDefaults.doorStyle}</span>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: projectDefaults.carcassColor || '#F5F0E8', border: '1px solid #ddd' }} title="Carcass" />
          <div style={{ width: 14, height: 14, borderRadius: 3, background: projectDefaults.frontColor || '#FFFFFF', border: '1px solid #ddd' }} title="Front" />
        </div>
      </div>
    </div>
  )
}
