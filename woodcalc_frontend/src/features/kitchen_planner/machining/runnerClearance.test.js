import { describe, it, expect, afterEach } from 'vitest'
import { calculateCabinet, setDrawerSystemCatalog, setCompanyDrawerMaterials, drawerRunnerClearance } from '../formulaEngine'

const wood = (extra = {}) => ({ width: 600, height: 720, depth: 560, cabinetType: 'base', subtype: 'Drawers', doorStyle: 'Handle',
  drawerType: 'Wood Box', drawerSystem: 'Tandem', zonePreset: { zones: [{ type: 'drawer', h: 360 }, { type: 'drawer', h: 360 }] }, ...extra })
const bottomW = (r) => r.drawerBox.parts_per_drawer.find((p) => p.role === 'bottom').width

afterEach(() => { setDrawerSystemCatalog([]); setCompanyDrawerMaterials({}) })

describe('kitchen wood drawer boxes use the drawer system runner clearance', () => {
  it('keeps 12.5 per side without a catalog value', () => {
    expect(drawerRunnerClearance(wood())).toBe(12.5)
    expect(bottomW(calculateCabinet(wood()))).toBe(539)
  })

  it('takes the catalog clearance of the cabinet drawer system', () => {
    setDrawerSystemCatalog([{ name: 'Tandem', box_construction: 'wood_box', runner_side_clearance: '20.0' }])
    expect(bottomW(calculateCabinet(wood()))).toBe(600 - 36 - 40)
  })

  it('takes the spec handed to it, e.g. a work order drawer system', () => {
    const r = calculateCabinet(wood({ drawerSystemSpec: { name: 'Tandem', runner_side_clearance: 15 } }))
    expect(bottomW(r)).toBe(600 - 36 - 30)
  })
})
