import React, { useState, useEffect } from 'react'
import { authFetch } from '../../api/auth'

const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

function forceHttps(url) {
  if (!url) return url
  return url.replace(/^http:\/\//i, 'https://')
}

const ACCENT = '#C8902A'

// ─── MATERIAL DATABASE ────────────────────────────────────────────────────────
export const MATERIAL_DB = {
  egger: {
    label: 'Egger',
    logo: '🇦🇹',
    materials: [
      // Solid Whites
      { code: 'W908 ST2',  name: 'Basic White',       hex: '#F8F6F2', finish: 'matt',  category: 'solid' },
      { code: 'W911 ST2',  name: 'Cream White',       hex: '#F5F1E8', finish: 'matt',  category: 'solid' },
      { code: 'W980 ST2',  name: 'Platinum White',    hex: '#F2F2F0', finish: 'matt',  category: 'solid' },
      { code: 'W980 SM',   name: 'Platinum White',    hex: '#F2F2F0', finish: 'gloss', category: 'solid' },
      { code: 'W1000 ST9', name: 'Premium White',     hex: '#EFEDE8', finish: 'matt',  category: 'solid' },
      { code: 'W1100 ST9', name: 'Alpine White',      hex: '#ECEAE5', finish: 'matt',  category: 'solid' },
      { code: 'W1200 ST9', name: 'Porcelain White',   hex: '#E8E6E2', finish: 'matt',  category: 'solid' },
      // Greys
      { code: 'U708 ST9',  name: 'Light Grey',        hex: '#C8C6C2', finish: 'matt',  category: 'solid' },
      { code: 'U732 ST9',  name: 'Dust Grey',         hex: '#A8A6A2', finish: 'matt',  category: 'solid' },
      { code: 'U750 ST9',  name: 'Taupe Grey',        hex: '#9A8E82', finish: 'matt',  category: 'solid' },
      { code: 'U763 ST9',  name: 'Pearl Grey',        hex: '#B8B4AE', finish: 'matt',  category: 'solid' },
      { code: 'U775 ST9',  name: 'White Grey',        hex: '#D8D6D2', finish: 'matt',  category: 'solid' },
      { code: 'U788 ST9',  name: 'Arctic Grey',       hex: '#D0CEC8', finish: 'matt',  category: 'solid' },
      { code: 'U960 ST9',  name: 'Onyx Grey',         hex: '#686664', finish: 'matt',  category: 'solid' },
      { code: 'U963 ST9',  name: 'Diamond Grey',      hex: '#787674', finish: 'matt',  category: 'solid' },
      { code: 'U961 ST7',  name: 'Graphite Grey',     hex: '#4A4846', finish: 'matt',  category: 'solid' },
      // Blacks
      { code: 'U999 ST2',  name: 'Black',             hex: '#1A1A1A', finish: 'matt',  category: 'solid' },
      { code: 'U999 SM',   name: 'Black',             hex: '#1A1A1A', finish: 'gloss', category: 'solid' },
      // Beiges & Browns
      { code: 'U104 ST9',  name: 'Alabaster White',   hex: '#E8E0D0', finish: 'matt',  category: 'solid' },
      { code: 'U156 ST9',  name: 'Sand Beige',        hex: '#D4C4A8', finish: 'matt',  category: 'solid' },
      { code: 'U222 ST15', name: 'Crema',             hex: '#E2D4B8', finish: 'matt',  category: 'solid' },
      { code: 'U702 ST9',  name: 'Cashmere Grey',     hex: '#B8AEA2', finish: 'matt',  category: 'solid' },
      // Blues & Greens
      { code: 'U540 ST9',  name: 'Denim Blue',        hex: '#5A7A9A', finish: 'matt',  category: 'solid' },
      { code: 'U599 ST9',  name: 'Indigo Blue',       hex: '#3A4A6A', finish: 'matt',  category: 'solid' },
      { code: 'U604 ST9',  name: 'Reed Green',        hex: '#6A8A6A', finish: 'matt',  category: 'solid' },
      { code: 'U699 ST9',  name: 'Fir Green',         hex: '#3A5A3A', finish: 'matt',  category: 'solid' },
      // Woodgrains
      { code: 'H1145 ST10', name: 'Natural Bardolino Oak',  hex: '#C4904A', finish: 'wood', category: 'wood' },
      { code: 'H1303 ST12', name: 'Brown Belmont Oak',      hex: '#8A6040', finish: 'wood', category: 'wood' },
      { code: 'H3157 ST12', name: 'Vicenza Oak',            hex: '#B8924E', finish: 'wood', category: 'wood' },
      { code: 'H1223 ST19', name: 'Sevilla Ash',            hex: '#A87848', finish: 'wood', category: 'wood' },
      { code: 'H3840 ST9',  name: 'Natural Sheffield Acacia',hex: '#C0904A', finish: 'wood', category: 'wood' },
      { code: 'H1242 ST10', name: 'Natural Mandal Maple',   hex: '#D4AA6A', finish: 'wood', category: 'wood' },
      { code: 'H3325 ST28', name: 'Tobacco Gladstone Oak',  hex: '#6A4830', finish: 'wood', category: 'wood' },
      { code: 'H1346 ST32', name: 'Anthracite Sherman Oak', hex: '#4A4440', finish: 'wood', category: 'wood' },
      { code: 'H3176 ST37', name: 'Pewter Halifax Oak',     hex: '#787068', finish: 'wood', category: 'wood' },
      { code: 'H1710 ST10', name: 'Sand Kentucky Chestnut', hex: '#C8A070', finish: 'wood', category: 'wood' },
      { code: 'H3195 ST19', name: 'White Fineline',         hex: '#E8E0D4', finish: 'wood', category: 'wood' },
      { code: 'H1732 ST9',  name: 'Sand Birch',             hex: '#D4C090', finish: 'wood', category: 'wood' },
    ]
  },

  kronospan: {
    label: 'Kronospan',
    logo: '🇨🇿',
    materials: [
      // Whites
      { code: '0101 SM',   name: 'Front White',       hex: '#F8F6F2', finish: 'gloss', category: 'solid' },
      { code: '0101 PE',   name: 'Front White',       hex: '#F8F6F2', finish: 'matt',  category: 'solid' },
      { code: 'K101',      name: 'Front White',       hex: '#F5F3EE', finish: 'matt',  category: 'solid' },
      { code: '0150',      name: 'Super White',       hex: '#FAFAFA', finish: 'gloss', category: 'solid' },
      { code: '8627 SM',   name: 'Anthracite',        hex: '#3A3A3A', finish: 'gloss', category: 'solid' },
      { code: '8823',      name: 'Agate Grey',        hex: '#8A8682', finish: 'matt',  category: 'solid' },
      { code: '8929',      name: 'Cream',             hex: '#F0E8D8', finish: 'matt',  category: 'solid' },
      { code: '8748',      name: 'Light Grey',        hex: '#C8C4BE', finish: 'matt',  category: 'solid' },
      { code: '8681',      name: 'Dust Grey',         hex: '#A4A09A', finish: 'matt',  category: 'solid' },
      { code: '0999',      name: 'Black',             hex: '#1C1C1C', finish: 'matt',  category: 'solid' },
      { code: '0999 SM',   name: 'Black Gloss',       hex: '#1C1C1C', finish: 'gloss', category: 'solid' },
      { code: '8673',      name: 'Cashmere',          hex: '#C0B4A4', finish: 'matt',  category: 'solid' },
      { code: '8578',      name: 'Sand Beige',        hex: '#D4C4A0', finish: 'matt',  category: 'solid' },
      // Woodgrains
      { code: '8420 SM',   name: 'White Artisan Oak', hex: '#E0D4C0', finish: 'wood', category: 'wood' },
      { code: '8929 SM',   name: 'Natural Artisan Oak',hex: '#C4A870', finish: 'wood', category: 'wood' },
      { code: '8697',      name: 'Tobacco Oak',       hex: '#7A5838', finish: 'wood', category: 'wood' },
      { code: '8517',      name: 'Dark Walnut',       hex: '#5A3A22', finish: 'wood', category: 'wood' },
      { code: '8866',      name: 'Light Bardolino Oak',hex: '#C89858', finish: 'wood', category: 'wood' },
      { code: '8214',      name: 'Sonoma Oak',        hex: '#C0944A', finish: 'wood', category: 'wood' },
      { code: '5981',      name: 'Vintage Oak',       hex: '#A87848', finish: 'wood', category: 'wood' },
    ]
  },

  sonae: {
    label: 'Sonae Arauco',
    logo: '🇵🇹',
    materials: [
      { code: 'W001 PM',   name: 'White',             hex: '#F8F6F2', finish: 'matt',  category: 'solid' },
      { code: 'W001 BRI',  name: 'White Gloss',       hex: '#F8F6F2', finish: 'gloss', category: 'solid' },
      { code: 'W002 PM',   name: 'Off White',         hex: '#F2EEE6', finish: 'matt',  category: 'solid' },
      { code: 'G002 PM',   name: 'Light Grey',        hex: '#C8C4BE', finish: 'matt',  category: 'solid' },
      { code: 'G006 PM',   name: 'Dust Grey',         hex: '#9A9692', finish: 'matt',  category: 'solid' },
      { code: 'G010 PM',   name: 'Anthracite',        hex: '#3C3A38', finish: 'matt',  category: 'solid' },
      { code: 'P001 PM',   name: 'Black',             hex: '#1A1A1A', finish: 'matt',  category: 'solid' },
      { code: 'B002 PM',   name: 'Cream',             hex: '#EEE4CC', finish: 'matt',  category: 'solid' },
      { code: 'P366 PM',   name: 'Cashmere',          hex: '#C0B0A0', finish: 'matt',  category: 'solid' },
      { code: 'H1487 PM',  name: 'Natural Oak',       hex: '#C49858', finish: 'wood', category: 'wood' },
      { code: 'H3490 PM',  name: 'White Oak',         hex: '#DDD0B8', finish: 'wood', category: 'wood' },
      { code: 'H3500 PM',  name: 'Nordic Oak',        hex: '#C8B890', finish: 'wood', category: 'wood' },
      { code: 'H3680 PM',  name: 'Dark Walnut',       hex: '#5C3C22', finish: 'wood', category: 'wood' },
      { code: 'H1680 PM',  name: 'Teak',              hex: '#9A7040', finish: 'wood', category: 'wood' },
    ]
  },

  finsa: {
    label: 'Finsa',
    logo: '🇪🇸',
    materials: [
      { code: 'F043',      name: 'White',             hex: '#F8F6F2', finish: 'matt',  category: 'solid' },
      { code: 'F043 GL',   name: 'White Gloss',       hex: '#F8F6F2', finish: 'gloss', category: 'solid' },
      { code: 'F218',      name: 'Cream',             hex: '#F0E8D8', finish: 'matt',  category: 'solid' },
      { code: 'F290',      name: 'Light Grey',        hex: '#C8C4BE', finish: 'matt',  category: 'solid' },
      { code: 'F295',      name: 'Silver Grey',       hex: '#B0ACA6', finish: 'matt',  category: 'solid' },
      { code: 'F300',      name: 'Anthracite',        hex: '#3C3A38', finish: 'matt',  category: 'solid' },
      { code: 'F099',      name: 'Black',             hex: '#1A1A1A', finish: 'matt',  category: 'solid' },
      { code: 'F099 GL',   name: 'Black Gloss',       hex: '#1A1A1A', finish: 'gloss', category: 'solid' },
      { code: 'F701',      name: 'Natural Oak',       hex: '#C49858', finish: 'wood', category: 'wood' },
      { code: 'F708',      name: 'White Oak',         hex: '#DDD0B8', finish: 'wood', category: 'wood' },
      { code: 'F720',      name: 'Dark Walnut',       hex: '#5C3C22', finish: 'wood', category: 'wood' },
      { code: 'F730',      name: 'Light Ash',         hex: '#D4C8B0', finish: 'wood', category: 'wood' },
      { code: 'F750',      name: 'Smoked Oak',        hex: '#7A6448', finish: 'wood', category: 'wood' },
    ]
  },

  cleaf: {
    label: 'Cleaf',
    logo: '🇮🇹',
    materials: [
      { code: 'S003 RM',   name: 'Ice White',         hex: '#F8F8F6', finish: 'matt',  category: 'solid' },
      { code: 'S007 RM',   name: 'Bianco Assoluto',   hex: '#F5F3EE', finish: 'matt',  category: 'solid' },
      { code: 'S007 GL',   name: 'Bianco Assoluto',   hex: '#F5F3EE', finish: 'gloss', category: 'solid' },
      { code: 'S009 RM',   name: 'Cotton White',      hex: '#F0EDE6', finish: 'matt',  category: 'solid' },
      { code: 'S168 RM',   name: 'Grigio Perla',      hex: '#C0BCB6', finish: 'matt',  category: 'solid' },
      { code: 'S170 RM',   name: 'Grigio Pietra',     hex: '#A09C96', finish: 'matt',  category: 'solid' },
      { code: 'S172 RM',   name: 'Grigio Lava',       hex: '#6A6664', finish: 'matt',  category: 'solid' },
      { code: 'S178 RM',   name: 'Antracite',         hex: '#3A3836', finish: 'matt',  category: 'solid' },
      { code: 'S250 RM',   name: 'Nero Assoluto',     hex: '#1A1A1A', finish: 'matt',  category: 'solid' },
      { code: 'S250 GL',   name: 'Nero Assoluto',     hex: '#1A1A1A', finish: 'gloss', category: 'solid' },
      { code: 'F028 RM',   name: 'Rovere Naturale',   hex: '#C49858', finish: 'wood', category: 'wood' },
      { code: 'F029 RM',   name: 'Rovere Bianco',     hex: '#DDD0B8', finish: 'wood', category: 'wood' },
      { code: 'F045 RM',   name: 'Noce Canaletto',    hex: '#6A4830', finish: 'wood', category: 'wood' },
      { code: 'F062 RM',   name: 'Frassino Grigio',   hex: '#A89880', finish: 'wood', category: 'wood' },
      { code: 'F080 RM',   name: 'Rovere Fumè',       hex: '#786858', finish: 'wood', category: 'wood' },
    ]
  },

  atg: {
    label: 'ATG',
    logo: '🇯🇴',
    materials: [
      { code: 'ATG-W01',   name: 'Super White Matt',  hex: '#F8F6F2', finish: 'matt',  category: 'solid' },
      { code: 'ATG-W01G',  name: 'Super White Gloss', hex: '#F8F6F2', finish: 'gloss', category: 'solid' },
      { code: 'ATG-W02',   name: 'Cream White',       hex: '#F2EAD8', finish: 'matt',  category: 'solid' },
      { code: 'ATG-G01',   name: 'Light Grey',        hex: '#C8C4BE', finish: 'matt',  category: 'solid' },
      { code: 'ATG-G02',   name: 'Silver Grey',       hex: '#A8A4A0', finish: 'matt',  category: 'solid' },
      { code: 'ATG-G03',   name: 'Anthracite',        hex: '#3C3A38', finish: 'matt',  category: 'solid' },
      { code: 'ATG-B01',   name: 'Black Matt',        hex: '#1A1A1A', finish: 'matt',  category: 'solid' },
      { code: 'ATG-B01G',  name: 'Black Gloss',       hex: '#1A1A1A', finish: 'gloss', category: 'solid' },
      { code: 'ATG-C01',   name: 'Cashmere',          hex: '#C8B8A8', finish: 'matt',  category: 'solid' },
      { code: 'ATG-C02',   name: 'Beige Sand',        hex: '#D4C4A0', finish: 'matt',  category: 'solid' },
      { code: 'ATG-OAK01', name: 'Natural Oak',       hex: '#C49858', finish: 'wood', category: 'wood' },
      { code: 'ATG-OAK02', name: 'White Oak',         hex: '#DDD0B8', finish: 'wood', category: 'wood' },
      { code: 'ATG-WAL01', name: 'Dark Walnut',       hex: '#5C3C22', finish: 'wood', category: 'wood' },
      { code: 'ATG-WAL02', name: 'Light Walnut',      hex: '#9A7040', finish: 'wood', category: 'wood' },
    ]
  },
}

const FINISH_BADGE = {
  matt:  { label: 'Matt',  bg: '#F0EDE8', color: '#666' },
  gloss: { label: 'Gloss', bg: '#E8F0F8', color: '#2A6ACC' },
  wood:  { label: 'Wood',  bg: '#F5ECD8', color: '#8A5C1A' },
  metal: { label: 'Metal', bg: '#E8EDF0', color: '#4A6A8A' },
  other: { label: 'Other', bg: '#F0E8F5', color: '#7A4A8A' },
}

export default function MaterialLibrary({ onSelect, selectedCode, target }) {
  const [brand, setBrand] = useState('my_library')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [catalogMaterials, setCatalogMaterials] = useState([])

  useEffect(() => {
    authFetch(API + '/api/inventory/textures/')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.results || [])
        setCatalogMaterials(list)
      })
      .catch(() => {})
  }, [])

  const myLibraryMaterials = catalogMaterials.map(t => ({
    code: t.code || `custom-${t.id}`,
    name: t.name,
    hex: t.fallback_hex || '#C8902A',
    finish: t.finish || 'matt',
    category: t.material_type === 'worktop' ? 'worktop' : 'solid',
    textureUrl: forceHttps(t.texture_image),
    supplierName: t.supplier_name || '',
  }))

  const isMyLibrary = brand === 'my_library'
  const activeMaterials = isMyLibrary ? myLibraryMaterials : (MATERIAL_DB[brand]?.materials || [])

  const filtered = activeMaterials.filter(m => {
    if (category !== 'all' && m.category !== category) return false
    if (search) {
      const q = search.toLowerCase()
      return (m.code || '').toLowerCase().includes(q) ||
             m.name.toLowerCase().includes(q) ||
             (m.supplierName || '').toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Target label */}
      <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {target === 'front' ? '🚪 Front Material' : '📦 Carcass Material'}
      </div>

      {/* Brand tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        <button onClick={() => { setBrand('my_library'); setSearch('') }}
          style={{ padding: '3px 7px', borderRadius: 5, border: '1.5px solid', fontSize: 10, fontWeight: 600, cursor: 'pointer',
            borderColor: brand === 'my_library' ? ACCENT : '#E0DAD4',
            background: brand === 'my_library' ? ACCENT + '18' : '#fff',
            color: brand === 'my_library' ? ACCENT : '#666' }}>
          📁 My Library {catalogMaterials.length > 0 ? `(${catalogMaterials.length})` : ''}
        </button>
        {Object.entries(MATERIAL_DB).map(([key, b]) => (
          <button key={key} onClick={() => { setBrand(key); setSearch('') }}
            style={{ padding: '3px 7px', borderRadius: 5, border: '1.5px solid', fontSize: 10, fontWeight: 600, cursor: 'pointer',
              borderColor: brand === key ? ACCENT : '#E0DAD4',
              background: brand === key ? ACCENT + '18' : '#fff',
              color: brand === key ? ACCENT : '#666' }}>
            {b.logo} {b.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        placeholder="Search code or name..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ padding: '5px 8px', border: '1.5px solid #E0DAD4', borderRadius: 6, fontSize: 11, outline: 'none', width: '100%', boxSizing: 'border-box' }}
      />

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 4 }}>
        {[['all', 'All'], ['solid', 'Solid'], ['wood', 'Wood']].map(([id, label]) => (
          <button key={id} onClick={() => setCategory(id)}
            style={{ flex: 1, padding: '4px 0', borderRadius: 5, border: '1.5px solid', fontSize: 10, fontWeight: 600, cursor: 'pointer',
              borderColor: category === id ? ACCENT : '#E0DAD4',
              background: category === id ? ACCENT + '18' : '#fff',
              color: category === id ? ACCENT : '#666' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Swatch grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, maxHeight: 280, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', fontSize: 11, color: '#bbb', padding: '16px 0', textAlign: 'center' }}>
            {isMyLibrary ? 'No materials in your catalog yet. Add them at /catalog.' : 'No results'}
          </div>
        )}
        {filtered.map(mat => {
          const isSelected = selectedCode === mat.code
          const badge = FINISH_BADGE[mat.finish] || FINISH_BADGE.matt
          return (
            <div key={mat.code} onClick={() => onSelect(mat)}
              style={{ borderRadius: 7, border: `2px solid ${isSelected ? ACCENT : '#E0DAD4'}`,
                background: isSelected ? ACCENT + '08' : '#FAFAFA',
                cursor: 'pointer', overflow: 'hidden', transition: 'border-color 0.15s' }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = '#C8A06A' }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = '#E0DAD4' }}>
              {/* Swatch — photo if available, else hex color */}
              <div style={{ height: 48, background: mat.hex, borderBottom: '1px solid rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden',
                ...(mat.finish === 'wood' && !mat.textureUrl ? { backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px)` } : {}),
                ...(mat.finish === 'gloss' && !mat.textureUrl ? { backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%)` } : {}) }}>
                {mat.textureUrl && (
                  <img src={mat.textureUrl} alt={mat.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.target.style.display = 'none' }} />
                )}
              </div>
              {/* Info */}
              <div style={{ padding: '4px 6px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#333', lineHeight: 1.3, marginBottom: 2 }}>{mat.name}</div>
                {mat.supplierName
                  ? <div style={{ fontSize: 8, color: '#aaa' }}>{mat.supplierName}</div>
                  : <div style={{ fontSize: 8, color: '#888', fontFamily: 'monospace' }}>{mat.code}</div>
                }
                <div style={{ marginTop: 3 }}>
                  <span style={{ fontSize: 8, fontWeight: 600, padding: '1px 4px', borderRadius: 3, background: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected display */}
      {selectedCode && (() => {
        const allBuiltin = Object.values(MATERIAL_DB).flatMap(b => b.materials)
        const found = [...myLibraryMaterials, ...allBuiltin].find(m => m.code === selectedCode)
        if (!found) return null
        return (
          <div style={{ padding: '6px 8px', background: '#F5F0E8', borderRadius: 7, border: `1.5px solid ${ACCENT}33` }}>
            <div style={{ fontSize: 9, color: '#888' }}>Selected</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <div style={{ width: 28, height: 28, borderRadius: 4, border: '1px solid #ddd', overflow: 'hidden', flexShrink: 0, background: found.hex }}>
                {found.textureUrl && (
                  <img src={found.textureUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.target.style.display = 'none' }} />
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1A1A1A' }}>{found.name}</div>
                <div style={{ fontSize: 9, color: '#888', fontFamily: 'monospace' }}>{found.code}</div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
