import { describe, it, expect } from 'vitest'
import { DEFAULT_WARDROBE_STANDARD as STD, normalizeStandard } from './wardrobeStandard'
import { computeWardrobe, defaultDesign, drawerSystemSnapshot } from './wardrobeEngine'
import { defaultCloset, computeCloset } from './closetEngine'
import { priceWardrobe, pickMaterials } from './wardrobePricing'
import { materialSnapshot } from './wardrobeRoom'
import { materialFor } from './wardrobePieces'

const islandPart = (r, name) => r.parts.find((p) => p.name === name && p.sections.every((s) => s.startsWith('I')))

describe('drawer system runner clearance', () => {
  const closet = defaultCloset(STD)
  const isl = { ...closet.island, enabled: true }

  it('uses the standard when no drawer system is picked', () => {
    const r = computeCloset({ ...closet, island: isl }, STD)
    expect(islandPart(r, 'Drawer bottom').W).toBe(573 - 2 * STD.runnerClearance)
  })

  it('uses the picked drawer system clearance for the island boxes', () => {
    const sys = drawerSystemSnapshot({ id: 4, name: 'Local 45', runner_side_clearance: '20.0' })
    expect(sys).toEqual({ id: 4, name: 'Local 45', runnerSideClearance: 20 })
    const r = computeCloset({ ...closet, island: { ...isl, drawerSystem: sys } }, STD)
    expect(islandPart(r, 'Drawer bottom').W).toBe(573 - 40)
    expect(islandPart(r, 'Drawer front/back').L).toBe(573 - 40 - 2 * STD.drawerBoxT)
    const box = r.island.halves[0].result.geometry.find((g) => g.kind === 'drawerBox')
    expect(box.x).toBe(18 + 20)
  })

  it('uses it for wardrobe internal drawers too', () => {
    const d = { ...defaultDesign(STD), drawerSystem: { id: 1, name: 'X', runnerSideClearance: 15 } }
    const bottom = computeWardrobe(d, STD).parts.find((p) => p.name === 'Drawer bottom')
    expect(bottom.W).toBe(764 - 2 * STD.drawerSpacerT - 30)
  })
})

describe('spacer stock board', () => {
  const spacer = { sku: 'CHIP25', name: 'Chipboard 25', board_thickness: 25, price_per_board: '22', board_width: 2800, board_height: 2070 }
  const carcass = { sku: 'EG-W980', name: 'White', board_thickness: 18, price_per_board: '30' }

  it('is a text field in the standard', () => {
    expect(normalizeStandard({ spacerBoardSku: ' CHIP25 ' }).spacerBoardSku).toBe('CHIP25')
    expect(normalizeStandard({ spacerBoardSku: 5 }).spacerBoardSku).toBe('')
  })

  it('prices the 25 mm spacers on the spacer board', () => {
    const std = { ...STD, spacerBoardSku: 'CHIP25' }
    const picked = pickMaterials({ Carcass: 'EG-W980' }, [carcass, spacer], std)
    const res = computeWardrobe(defaultDesign(std), std)
    const row = priceWardrobe(res, std, { picked }).boards.find((b) => b.material === 'Carcass' && b.T === 25)
    expect(row).toEqual(expect.objectContaining({ sku: 'CHIP25', unit: 22, fromCatalog: true }))
  })

  it('puts the spacer pieces on that board instead of "no material set"', () => {
    const snap = materialSnapshot({ Carcass: carcass, spacer })
    expect(materialFor('Carcass', 25, snap)).toEqual({ sku: 'CHIP25', materialName: 'Chipboard 25' })
    expect(materialFor('Carcass', 18, snap)).toEqual({ sku: 'EG-W980', materialName: 'White' })
  })
})
