import React, { useState, useEffect } from 'react'
import { authFetch } from '../../api/auth'
import { MATERIAL_DB } from './materialData'

const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

function forceHttps(url) {
  if (!url) return url
  return url.replace(/^http:\/\//i, 'https://')
}

const ACCENT = '#C8902A'

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
              <div style={{ height: 48, background: mat.hex, borderBottom: '1px solid rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden',
                ...(mat.finish === 'wood' && !mat.textureUrl ? { backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px)` } : {}),
                ...(mat.finish === 'gloss' && !mat.textureUrl ? { backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%)` } : {}) }}>
                {mat.textureUrl && (
                  <img src={mat.textureUrl} alt={mat.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.target.style.display = 'none' }} />
                )}
              </div>
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
