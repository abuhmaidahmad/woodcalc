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

describe('wood drawer boxes sized from the drawer box board and bottom', () => {
  const wood = () => ({ width: 600, height: 720, depth: 560, cabinetType: 'base', subtype: 'Drawers', doorStyle: 'Handle',
    drawerType: 'Wood Box', drawerSystem: 'Tandem', zonePreset: { zones: [{ type: 'drawer', h: 360 }, { type: 'drawer', h: 360 }] } })
  const parts = (r) => Object.fromEntries(r.drawerBox.parts_per_drawer.map(p => [p.role, p]))

  it('12mm board, 8mm bottom: the sizes used until now', () => {
    setCompanyDrawerMaterials({ boxMaterialCode: 'WB12', boxThickness: 12, bottomMaterialCode: 'HDF8', bottomThickness: 8 })
    const p = parts(calculateCabinet(wood()))
    // box 600 - 36 - 25 = 539 wide, 560 - 80 = 480 deep
    expect(p.side).toMatchObject({ name: 'Drawer side (12mm)', thickness: 12, width: 480, depth: 120, qty: 2 })
    expect(p.frontback).toMatchObject({ name: 'Drawer back/front (12mm)', thickness: 12, width: 539 - 24, depth: 120, qty: 2 })
    expect(p.bottom).toMatchObject({ name: 'Drawer base (8mm HDF)', thickness: 8, width: 539, depth: 480 })
  })

  it('16mm board: the back and front are cut two board thicknesses shorter', () => {
    setCompanyDrawerMaterials({ boxMaterialCode: 'WB16', boxThickness: 16, bottomMaterialCode: 'MDF6', bottomThickness: 6 })
    const r = calculateCabinet(wood())
    const p = parts(r)
    expect(p.side).toMatchObject({ name: 'Drawer side (16mm)', thickness: 16, width: 480 })
    expect(p.frontback).toMatchObject({ thickness: 16, width: 539 - 32 })
    expect(p.bottom).toMatchObject({ name: 'Drawer base (6mm HDF)', thickness: 6, width: 539, depth: 480 })
    expect([r.drawerBox.side_thickness, r.drawerBox.base_thickness]).toEqual([16, 6])
  })

  it('carries the board and its thickness onto the work order pieces, Arabic names included', () => {
    setCompanyDrawerMaterials({ boxMaterialCode: 'WB16', boxThickness: 16, bottomMaterialCode: 'HDF8', bottomThickness: 8 })
    const room = { room_number: 1, planner_data: { cabinets: [{ id: 1, category: 'base', ...wood() }] } }
    const db = workOrderPieces({ order_number: 'WO1' }, room).filter(p => p.kind === 'drawer')
    expect(db.filter(p => p.code.startsWith('DB1-')).map(p => [p.code, p.length, p.thickness, p.sku])).toEqual([
      ['DB1-SL', 480, 16, 'WB16'], ['DB1-SR', 480, 16, 'WB16'], ['DB1-FR', 507, 16, 'WB16'], ['DB1-BK', 507, 16, 'WB16'], ['DB1-BT', 539, 8, 'HDF8']])
    expect(db[0].label).toBe('Drawer side (16mm) / جانب درج (16مم)')
  })

  it("keeps a confirmed room's drawer boxes at the board it was confirmed with", async () => {
    const { withRoomBackPanel } = await import('../formulaEngine')
    setCompanyDrawerMaterials({ boxMaterialCode: 'WB16', boxThickness: 16 })
    const frozen = { back_construction: 'surface', back_panel_thickness_mm: 8, drawer_box_material_sku: 'WB12', drawer_box_thickness_mm: 12,
      drawer_bottom_material_sku: null, drawer_bottom_thickness_mm: 8 }
    expect(parts(withRoomBackPanel(frozen, () => calculateCabinet(wood()))).frontback.width).toBe(515)
    // Confirmed before drawer boards were saved: the 12mm its drawers were sized with,
    // and the company's 16mm board isn't used for it.
    const legacy = { back_construction: 'surface', back_panel_thickness_mm: 8, back_panel_material_sku: null }
    expect(parts(withRoomBackPanel(legacy, () => calculateCabinet(wood()))).frontback).toMatchObject({ width: 515, thickness: 12 })
    const room = { room_number: 1, construction_settings: legacy, planner_data: { cabinets: [{ id: 1, category: 'base', ...wood() }] } }
    expect(workOrderPieces({ order_number: 'WO1' }, room).find(p => p.code === 'DB1-SL')).toMatchObject({ thickness: 12, sku: null })
  })
})
