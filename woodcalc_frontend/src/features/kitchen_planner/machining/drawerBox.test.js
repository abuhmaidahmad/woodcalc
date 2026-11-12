import { describe, it, expect, afterEach } from 'vitest'
import { calculateCabinet, setDrawerSystemCatalog, setCompanyDrawerMaterials } from '../formulaEngine'
import { workOrderPieces } from './pieces'

const metal = (extra = {}) => ({ width: 600, height: 720, depth: 560, cabinetType: 'base', subtype: 'Drawers', doorStyle: 'Handle',
  drawerSystem: 'LEGRABOX', drawerBoxConstruction: 'metal_sided',
  zonePreset: { zones: [{ type: 'drawer', h: 360 }, { type: 'drawer', h: 360 }] }, ...extra })
const bottom = (r) => r.drawerBox.parts_per_drawer.find(p => p.role === 'bottom')
const LEGRABOX = { name: 'LEGRABOX', box_construction: 'metal_sided', bottom_width_deduction: '30.0', bottom_depth_deduction: '90.0', bottom_thickness: 16 }

afterEach(() => { setDrawerSystemCatalog([]); setCompanyDrawerMaterials({}) })

describe('metal-sided drawer bottoms from the drawer system catalog', () => {
  it('keeps the old W - 2T - 25 x D - 80, 8mm with no catalog entry or the default fields', () => {
    expect(bottom(calculateCabinet(metal()))).toMatchObject({ width: 539, depth: 480, thickness: 8 })
    setDrawerSystemCatalog([{ name: 'LEGRABOX', bottom_width_deduction: '25.0', bottom_depth_deduction: '80.0', bottom_thickness: 8 }])
    expect(bottom(calculateCabinet(metal()))).toMatchObject({ width: 539, depth: 480, thickness: 8 })
  })

  it('uses the edited catalog values', () => {
    setDrawerSystemCatalog([LEGRABOX])
    const r = calculateCabinet(metal())
    expect(bottom(r)).toMatchObject({ width: 534, depth: 470, thickness: 16 })
    expect(r.drawerBox.base_thickness).toBe(16)
    // Only the cabinet's own system counts.
    expect(bottom(calculateCabinet(metal({ drawerSystem: 'Other' })))).toMatchObject({ width: 539, depth: 480, thickness: 8 })
  })

  it('reaches the work order pieces, cut from the company bottom material only at its thickness', () => {
    setCompanyDrawerMaterials({ bottomMaterialCode: 'HDF8', bottomThickness: 8 })
    const room = { room_number: 1, planner_data: { cabinets: [{ id: 1, category: 'base', ...metal() }] } }
    const bt = (systems) => workOrderPieces({ order_number: 'WO1' }, room, { drawerSystems: systems }).find(p => p.code === 'DB1-BT')
    expect(bt([])).toMatchObject({ length: 539, width: 480, thickness: 8, sku: 'HDF8' })
    expect(bt([LEGRABOX])).toMatchObject({ length: 534, width: 470, thickness: 16, sku: null })
  })
})
