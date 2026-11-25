import { describe, it, expect } from 'vitest'
import { DEFAULT_WARDROBE_STANDARD as STD } from './wardrobeStandard'
import { defaultDesign, cutListCsv } from './wardrobeEngine'
import { computeDesign, defaultCloset } from './closetEngine'
import { priceWardrobe, pickMaterials } from './wardrobePricing'
import { piecesFromParts } from './wardrobePieces'
import { contractRows, materialSnapshot } from './wardrobeRoom'
import { CARCASS_COLOR, materialSkus, withMaterials, pricingPicks, materialLook, shareLook, grainRepeat } from './wardrobeMaterials'
import { textureMapFrom } from '../kitchen_planner/textureMap'

const CATALOG = [
  { sku: 'WHT-18', name: 'White 18', material_type: 'carcass', board_thickness: 18, price_per_board: '22', fallback_hex: '#f3f1ec', finish: 'matt' },
  { sku: 'OAK-18', name: 'Natural Oak 18', material_type: 'front', board_thickness: 18, price_per_board: '48', fallback_hex: '#c49a6c', finish: 'wood', texture_image: 'http://cdn.test/oak.jpg', texture_physical_width_mm: 1300, texture_physical_height_mm: 2800 },
  { sku: 'HDF-8', name: 'HDF 8', material_type: 'back', board_thickness: 8, price_per_board: '9' },
]
const base = defaultDesign(STD)
const t = (k) => k

describe('design.materials', () => {
  it('leaves designs without materials on the Price tab picks', () => {
    const d = { ...base, pricing: { picks: { Carcass: 'WHT-18', Front: 'OAK-18', Back: 'HDF-8' } } }
    expect(materialSkus(d)).toBeNull()
    expect(pricingPicks(d)).toEqual({ Carcass: 'WHT-18', Front: 'OAK-18', Back: 'HDF-8' })
    expect(pricingPicks(base)).toEqual({})
  })

  it('makes the design the only source of carcass and front, keeping back and drawer picks', () => {
    const d = { ...base, materials: { carcass: 'WHT-18', front: 'OAK-18', frontMatchesCarcass: false }, pricing: { picks: { Carcass: 'X', Front: 'Y', Back: 'HDF-8', 'Drawer box': 'Z' } } }
    expect(pricingPicks(d)).toEqual({ Carcass: 'WHT-18', Front: 'OAK-18', Back: 'HDF-8', 'Drawer box': 'Z' })
    expect(pricingPicks({ ...d, materials: { carcass: null, front: null } })).toMatchObject({ Carcass: null, Front: null, Back: 'HDF-8' })
  })

  it('uses the carcass for every front when the fronts match', () => {
    const d = { ...base, materials: { carcass: 'WHT-18', front: 'OAK-18', frontMatchesCarcass: true } }
    expect(materialSkus(d)).toEqual({ carcass: 'WHT-18', front: 'WHT-18' })
    expect(pricingPicks(d)).toEqual({ Carcass: 'WHT-18', Front: 'WHT-18' })
  })

  it('starts from the old Price tab picks the first time a material is picked', () => {
    const d = withMaterials({ ...base, pricing: { picks: { Carcass: 'WHT-18', Front: 'OAK-18' } } }, { front: 'WHT-18' })
    expect(d.materials).toEqual({ carcass: 'WHT-18', front: 'WHT-18', frontMatchesCarcass: false })
    expect(withMaterials(d, { frontMatchesCarcass: true }).materials).toEqual({ carcass: 'WHT-18', front: 'WHT-18', frontMatchesCarcass: true })
  })

  it('prices, cuts and names pieces exactly like the same picks made on the Price tab', () => {
    ;[base, { ...base, mode: 'closet', closet: defaultCloset(STD) }].forEach((d0) => {
      const legacy = { ...d0, pricing: { picks: { Carcass: 'WHT-18', Front: 'OAK-18' } } }
      const fresh = { ...d0, materials: { carcass: 'WHT-18', front: 'OAK-18', frontMatchesCarcass: false } }
      const run = (d) => {
        const result = computeDesign(d, STD)
        const picked = pickMaterials(pricingPicks(d), CATALOG, STD)
        return { price: priceWardrobe(result, STD, { picked }), pieces: piecesFromParts(result.rawParts, { materials: materialSnapshot(picked) }) }
      }
      const a = run(legacy)
      const b = run(fresh)
      expect(b.price).toEqual(a.price)
      expect(b.pieces).toEqual(a.pieces)
      expect(b.pieces.filter((p) => p.kind === 'front').every((p) => p.materialName === 'Natural Oak 18')).toBe(true)
      expect(b.pieces.filter((p) => p.name === 'Side').every((p) => p.materialName === 'White 18')).toBe(true)
    })
  })

  it('shows the front material on contract rows of rooms that pick one', () => {
    const result = computeDesign(base, STD)
    const widths = base.sections.map((s) => s.w)
    const plain = contractRows(base, result, widths, t, 'White 18')
    const named = contractRows(base, result, widths, t, 'White 18', 'Natural Oak 18')
    expect(named.map((r) => r.material)).toEqual(plain.map((r) => r.material))
    expect(named[0].doorStyle).toBe(`${plain[0].doorStyle} · Natural Oak 18`)
  })

  it('puts material names in the cut list CSV only when asked', () => {
    const result = computeDesign(base, STD)
    expect(cutListCsv(result)).toContain(',Carcass,')
    expect(cutListCsv(result, undefined, (p) => (p.material === 'Carcass' ? 'White 18' : p.material))).toContain(',White 18,')
  })
})

describe('3D look', () => {
  const map = textureMapFrom(CATALOG)

  it('keeps today\'s colours when nothing is picked', () => {
    expect(materialLook(base, map, '#6e4b33')).toEqual({ carcass: { hex: CARCASS_COLOR, imageUrl: null }, front: { hex: '#6e4b33', imageUrl: null } })
  })

  it('uses the photo and physical size, or the fallback colour when there is no photo', () => {
    const look = materialLook({ ...base, materials: { carcass: 'WHT-18', front: 'OAK-18' } }, map, '#6e4b33')
    expect(look.carcass).toMatchObject({ hex: '#f3f1ec', imageUrl: null, finish: 'matt' })
    expect(look.front).toMatchObject({ hex: '#c49a6c', imageUrl: 'https://cdn.test/oak.jpg', physW: 1300, physH: 2800, finish: 'wood' })
  })

  it('falls back to the old colours for a sku that is not in the catalog', () => {
    const look = materialLook({ ...base, materials: { carcass: 'GONE', front: 'GONE' } }, map, '#6e4b33')
    expect(look).toEqual({ carcass: { hex: CARCASS_COLOR, imageUrl: null }, front: { hex: '#6e4b33', imageUrl: null } })
  })

  it('builds the share view look from the finishes the link returns', () => {
    const look = shareLook({ front: { fallback_hex: '#c49a6c', texture_image: 'https://cdn.test/oak.jpg', texture_physical_width_mm: 1300 } }, '#6e4b33')
    expect(look.carcass).toEqual({ hex: CARCASS_COLOR, imageUrl: null })
    expect(look.front).toMatchObject({ imageUrl: 'https://cdn.test/oak.jpg', physW: 1300, physH: 600 })
  })

  it('runs the grain along each part\'s length', () => {
    expect(grainRepeat(18, 2000, 600, 1300, 2800)).toEqual({ repeatU: 600 / 1300, repeatV: 2000 / 2800, rotate90: false })
    expect(grainRepeat(500, 2000, 18, 1300, 2800)).toEqual({ repeatU: 500 / 1300, repeatV: 2000 / 2800, rotate90: false })
    expect(grainRepeat(800, 18, 560, 1300, 2800)).toEqual({ repeatU: 560 / 1300, repeatV: 800 / 2800, rotate90: true })
    expect(grainRepeat(2400, 100, 18, 1300, 2800)).toEqual({ repeatU: 100 / 1300, repeatV: 2400 / 2800, rotate90: true })
  })
})

describe('share view standard without prices', () => {
  it('builds the same geometry when the link leaves out prices, labour, margin and the spacer sku', async () => {
    const { normalizeStandard } = await import('./wardrobeStandard')
    const own = { ...STD, priceHinge: 9, priceBoardFront: 99, labourPct: 40, marginPct: 50, spacerBoardSku: 'PB-25' }
    const shared = Object.fromEntries(Object.entries(own).filter(([k]) => !k.startsWith('price') && !['labourPct', 'marginPct', 'spacerBoardSku'].includes(k)))
    ;[base, { ...base, mode: 'closet', closet: { ...defaultCloset(STD), island: { ...defaultCloset(STD).island, enabled: true } } }].forEach((d) => {
      const a = computeDesign(d, normalizeStandard(own))
      const b = computeDesign(d, normalizeStandard(shared))
      expect(JSON.stringify(b.geometry ?? b.runs.map((r) => r.result.geometry))).toBe(JSON.stringify(a.geometry ?? a.runs.map((r) => r.result.geometry)))
      expect(JSON.stringify(b.parts)).toBe(JSON.stringify(a.parts))
    })
  })
})
