import { describe, it, expect } from 'vitest'
import { calculateCabinet, cabinetConfig, glassShelfSpec, hasGlassShelves, shelfLedMeters, panelEdgeBanding } from './formulaEngine'

const openBox = (extra = {}) => ({
  id: 'ob', category: 'wall', subtype: 'Open Shelf', width: 800, height: 1000, depth: 300,
  shelfCount: 2, material: 'particleboard', doorStyle: 'Handle', ...extra,
})
const shelfPanel = (c) => calculateCabinet(cabinetConfig(c)).panels.find(p => p.name === 'Shelf (18mm)')

describe('open box shelf material', () => {
  it('defaults to glass shelves, none cut from board', () => {
    const c = openBox()
    expect(hasGlassShelves(c)).toBe(true)
    expect(glassShelfSpec(c).qty).toBe(2)
    expect(shelfPanel(c)).toBeUndefined()
  })

  it('wood shelves are cut from the box board instead of glass', () => {
    const c = openBox({ shelfMaterial: 'wood' })
    expect(hasGlassShelves(c)).toBe(false)
    expect(glassShelfSpec(c)).toBeNull()
    expect(shelfPanel(c)).toMatchObject({ qty: 2, width: 800 - 36 - 1, depth: 300 - 18 - 18 - 10, thickness: 18, faceMaterial: 'carcass' })
    expect(calculateCabinet(cabinetConfig(c)).hardware.shelf_pins).toBe(8)
  })

  it('wood shelves follow a front Box Color and are banded all round in it', () => {
    const p = shelfPanel(openBox({ shelfMaterial: 'wood', openBoxMaterialSource: 'front' }))
    expect(p.faceMaterial).toBe('front')
    expect(panelEdgeBanding(p, 'White', 'Oak', 'White', 'Oak', 'Handle')).toEqual({ T: 'Oak', B: 'Oak', L: 'Oak', R: 'Oak' })
  })

  it('shelf LEDs add one shelf-wide strip per shelf', () => {
    expect(shelfLedMeters(openBox())).toBe(0)
    expect(shelfLedMeters(openBox({ ledStripShelves: true }))).toBeCloseTo(2 * 0.76)
    expect(shelfLedMeters({ ...openBox({ ledStripShelves: true }), subtype: 'Standard' })).toBe(0)
  })
})
