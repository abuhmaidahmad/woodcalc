import { describe, it, expect, afterEach } from 'vitest'
import { calculateCabinet, setCompanyBackPanel, setRoomBackPanel, withRoomBackPanel, glassShelfSpec } from '../formulaEngine'
import { bomPanelsToGroups } from '../../manufacturing/CuttingOptimizerModule'
import { buildMachining } from './index'
import { SURFACE_CABINETS, cutSizes } from './surfaceCabinets'
import surfaceCutSizes from './__fixtures__/surfaceCutSizes.json'

// What the backend saves on a room confirmed under today's defaults.
const FROZEN_TODAY = { back_construction: 'surface', back_panel_thickness_mm: 8, back_panel_material_sku: null }

afterEach(() => { setCompanyBackPanel({}); setRoomBackPanel(null) })

describe('a confirmed room keeps its construction settings', () => {
  it('keeps identical cut sizes after the company switches to groove', () => {
    setCompanyBackPanel({ construction: 'groove', thickness: 3 })
    Object.entries(SURFACE_CABINETS).forEach(([name, cab]) => {
      const sizes = withRoomBackPanel(FROZEN_TODAY, () => cutSizes(calculateCabinet(cab)))
      expect(sizes, name).toEqual(surfaceCutSizes[name])
    })
    // ...while an unconfirmed room follows the company.
    expect(cutSizes(calculateCabinet(SURFACE_CABINETS.base600_1shelf))).not.toEqual(surfaceCutSizes.base600_1shelf)
  })

  it('applies to the planner view (setRoomBackPanel) until it closes', () => {
    setCompanyBackPanel({ construction: 'groove' })
    setRoomBackPanel(FROZEN_TODAY)
    expect(calculateCabinet(SURFACE_CABINETS.wall600).backConstruction).toBe('surface')
    setRoomBackPanel(null)
    expect(calculateCabinet(SURFACE_CABINETS.wall600).backConstruction).toBe('groove')
  })

  it('restores the previous settings after withRoomBackPanel, even on a throw', () => {
    setCompanyBackPanel({ construction: 'groove' })
    expect(() => withRoomBackPanel(FROZEN_TODAY, () => { throw new Error('x') })).toThrow('x')
    expect(calculateCabinet(SURFACE_CABINETS.wall600).backConstruction).toBe('groove')
  })

  it('freezes a grooved room too, with its own back thickness', () => {
    const frozen = { back_construction: 'groove', back_panel_thickness_mm: 3, back_panel_material_sku: 'HDF3' }
    const r = withRoomBackPanel(frozen, () => calculateCabinet(SURFACE_CABINETS.base600_1shelf))
    expect(r.backGroove.width).toBe(4)
    expect(r.panels.find(p => p.name === 'Back panel (HDF)')).toMatchObject({ thickness: 3, materialCode: 'HDF3' })
  })

  it('reaches the cutting optimizer, the CNC export and glass shelves', () => {
    setCompanyBackPanel({ construction: 'groove' })
    const cab = { id: 1, category: 'base', subtype: 'Single Door', width: 600, height: 720, depth: 560, doorStyle: 'Handle', shelfCount: 1, carcassMaterialCode: 'C18' }
    const depths = (groups) => groups.flatMap(g => g.parts.filter(p => /Bottom/.test(p.label)).map(p => p.height))
    expect(depths(withRoomBackPanel(FROZEN_TODAY, () => bomPanelsToGroups([cab], 'carcass')))).toEqual(['522'])
    expect(depths(bomPanelsToGroups([cab], 'carcass'))).toEqual(['560'])

    const cfg = SURFACE_CABINETS.base600_1shelf
    expect(buildMachining({ ...cfg, constructionSettings: FROZEN_TODAY }).result.backGroove).toBeNull()
    expect(buildMachining(cfg).result.backGroove).not.toBeNull()

    const glass = { category: 'base', subtype: 'Glass Door', width: 600, height: 720, depth: 560, shelfCount: 1 }
    expect(withRoomBackPanel(FROZEN_TODAY, () => glassShelfSpec(glass)).depth).toBe(560 - 30 - 8 - 10)
    expect(glassShelfSpec(glass).depth).toBe(560 - 18 - 9 - 10)
  })
})
