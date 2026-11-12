import { describe, it, expect } from 'vitest'
import { workOrderPieces, groupPieces, partCode, pieceId } from './pieces'
import legacy from './__fixtures__/legacyOptimizerLoad.json'

const base = (id, extra = {}) => ({ id, label: `Base ${extra.width || 600}`, category: 'base', subtype: 'Single Door', width: 600, height: 720, depth: 560,
  doorStyle: 'Handle', shelfCount: 1, carcassMaterialCode: 'C18', carcassMaterialName: 'White', frontMaterialCode: 'OAK', frontMaterialName: 'Oak', ...extra })
const room = (cabinets, extra = {}) => ({ room_number: 2, planner_data: { cabinets }, construction_settings: null, ...extra })
const wo = (extra = {}) => ({ order_number: 'WO125', sent_cabinet_ids: [], ...extra })

describe('work order pieces', () => {
  it('gives every physical piece of a 600 base its own ID', () => {
    const pieces = workOrderPieces(wo(), room([base(7)]))
    expect(pieces.map(p => p.id)).toEqual([
      'WO125-R2-01-SL', 'WO125-R2-01-SR', 'WO125-R2-01-BOT', 'WO125-R2-01-RF', 'WO125-R2-01-RB',
      'WO125-R2-01-BK', 'WO125-R2-01-SH1', 'WO125-R2-01-D1',
    ])
    expect(new Set(pieces.map(p => p.id)).size).toBe(pieces.length)
    const sl = pieces[0]
    expect(sl).toMatchObject({ cabinetId: 7, badge: 1, cabinet: 'Base 600', name: 'Side panel', length: 720, width: 560, thickness: 18,
      kind: 'carcass', sku: 'C18', materialName: 'White', grainLocked: false })
    expect(sl.label).toMatch(/^Side panel \/ /)
    expect(sl.part.id).toBe('side-left')
    expect(pieces.find(p => p.code === 'D1')).toMatchObject({ kind: 'front', sku: 'OAK', grainLocked: true, edgeBanding: { T: 'Oak', B: 'Oak', L: 'Oak', R: 'Oak' } })
    expect(pieces.find(p => p.code === 'BK')).toMatchObject({ kind: 'back', thickness: 8 })
  })

  it('numbers cabinets by their frozen badge, not their place in the list', () => {
    const pieces = workOrderPieces(wo(), room([base(11, { badge: 2 }), base(13), base(12, { badge: 3 })]))
    expect([...new Set(pieces.map(p => p.id.split('-').slice(0, 3).join('-')))]).toEqual(['WO125-R2-02', 'WO125-R2-04', 'WO125-R2-03'])
  })

  it('only includes the cabinets the work order was sent with', () => {
    const pieces = workOrderPieces(wo({ sent_cabinet_ids: [12] }), room([base(11), base(12)]))
    expect(new Set(pieces.map(p => p.badge))).toEqual(new Set([2]))
  })

  it('names drawer fronts, drawer box parts and flat pieces', () => {
    const drawers = base(1, { subtype: 'Drawers', zonePreset: { zones: [{ type: 'drawer', h: 360 }, { type: 'drawer', h: 360 }] }, drawerType: 'Wood Box', drawerSystem: 'Tandem' })
    const filler = { id: 2, label: 'Filler 50', category: 'accessories', subtype: 'Filler', width: 50, height: 720, frontMaterialCode: 'OAK', frontMaterialName: 'Oak' }
    const codes = workOrderPieces(wo(), room([drawers, filler])).map(p => p.id.replace('WO125-R2-', ''))
    expect(codes).toEqual(expect.arrayContaining(['01-DF1', '01-DF2',
      '01-DB1-SL', '01-DB1-SR', '01-DB1-FR', '01-DB1-BK', '01-DB1-BT', '01-DB2-SL', '01-DB2-BT', '02-FIL', '02-CL']))
    expect(codes.filter(c => c.startsWith('01-D') && !c.startsWith('01-DB') && !c.startsWith('01-DF'))).toEqual([])
  })

  it('uses the room\'s frozen construction settings', () => {
    const frozen = { back_construction: 'groove', back_panel_thickness_mm: 3, back_panel_material_sku: 'HDF3' }
    const bk = workOrderPieces(wo(), room([base(1)], { construction_settings: frozen })).find(p => p.code === 'BK')
    expect(bk).toMatchObject({ length: 578, thickness: 3, sku: 'HDF3' })
  })

  it('adds up to exactly what the optimizer used to load, per board', () => {
    // __fixtures__/legacyOptimizerLoad.json: these cabinets as the optimizer's
    // BOM import grouped them (merged, with quantities) before pieces existed.
    const pieces = workOrderPieces(wo(), room(legacy.cabinets)).filter(p => p.kind !== 'drawer')
    const bySku = (sku) => groupPieces(pieces.filter(p => (p.sku || null) === sku))
      .map(g => `${g.label}|${g.length}|${g.width}|${g.quantity}`).sort()
    legacy.groups.forEach(g => {
      expect(bySku(g.sku), g.sku).toEqual(g.parts.map(p => `${p.label}|${p.width}|${p.height}|${p.quantity}`).sort())
    })
  })
})

describe('groupPieces', () => {
  it('groups by name, size and material and keeps every ID', () => {
    const pieces = workOrderPieces(wo(), room([base(1), base(2)]))
    const sides = groupPieces(pieces).find(g => g.name === 'Side panel')
    expect(sides).toMatchObject({ quantity: 4, length: 720, width: 560, sku: 'C18' })
    expect(sides.ids).toEqual(['WO125-R2-01-SL', 'WO125-R2-01-SR', 'WO125-R2-02-SL', 'WO125-R2-02-SR'])
  })
})

describe('part codes', () => {
  it('maps machining part ids to short codes', () => {
    expect(['side-left', 'top', 'shelf-2', 'door-3', 'drawer-front-1', 'blind-stile-2', 'blind-panel'].map(partCode))
      .toEqual(['SL', 'TOP', 'SH2', 'D3', 'DF1', 'BS2', 'BP'])
    expect(pieceId('WO125', 2, 3, 'SL')).toBe('WO125-R2-03-SL')
  })
})

describe('cabinetBadges (same rule as crm/numbering.py)', () => {
  it('numbers an unconfirmed room 1, 2, 3 in list order', async () => {
    const { cabinetBadges } = await import('../formulaEngine')
    expect([...cabinetBadges([{ id: 'a' }, { id: 'b' }, { id: 'c' }]).values()]).toEqual([1, 2, 3])
  })
  it('keeps frozen badges and numbers new cabinets after the highest', async () => {
    const { cabinetBadges } = await import('../formulaEngine')
    const m = cabinetBadges([{ id: 'b', badge: 2 }, { id: 'x' }, { id: 'c', badge: 3 }, { id: 'y' }])
    expect([...m.entries()]).toEqual([['b', 2], ['x', 4], ['c', 3], ['y', 5]])
  })
})

describe('drawer box materials from company settings', () => {
  const drawers = (extra = {}) => base(1, { subtype: 'Drawers', drawerType: 'Wood Box', drawerSystem: 'Tandem',
    zonePreset: { zones: [{ type: 'drawer', h: 360 }, { type: 'drawer', h: 360 }] }, ...extra })

  it('cuts wood box sides/fronts/backs from the box board and bottoms from the bottom material', async () => {
    const { setCompanyDrawerMaterials } = await import('../formulaEngine')
    setCompanyDrawerMaterials({ boxMaterialCode: 'WB12', boxThickness: 12, bottomMaterialCode: 'HDF8', bottomThickness: 8 })
    try {
      const db = workOrderPieces(wo(), room([drawers()])).filter(p => p.kind === 'drawer')
      expect(db.filter(p => p.code.endsWith('-BT')).map(p => [p.sku, p.thickness])).toEqual([['HDF8', 8], ['HDF8', 8]])
      expect(new Set(db.filter(p => !p.code.endsWith('-BT')).map(p => `${p.sku}|${p.thickness}`))).toEqual(new Set(['WB12|12']))
      const { piecesToGroups } = await import('../../manufacturing/CuttingOptimizerModule')
      const groups = piecesToGroups(db, 'all')
      expect(groups.map(g => g.sku).sort()).toEqual(['HDF8', 'WB12']) // resolved: nothing to pick by hand
    } finally {
      setCompanyDrawerMaterials({})
    }
  })

  it('falls back to a thickness group for a manual pick when the company has none', () => {
    const db = workOrderPieces(wo(), room([drawers()])).filter(p => p.kind === 'drawer')
    expect(new Set(db.map(p => p.sku))).toEqual(new Set([null]))
    expect(new Set(db.map(p => p.thickness))).toEqual(new Set([12, 8]))
  })
})

describe('metal-sided drawer systems', () => {
  const TANDEM = { name: 'TANDEMBOX', box_construction: 'metal_sided', back_width_deduction: '87.0', back_height_m: '68.0', back_height_c: '167.0', back_thickness: 16 }
  const metal = (extra = {}) => base(1, { subtype: 'Drawers', drawerSystem: 'TANDEMBOX', drawerBoxConstruction: 'metal_sided',
    zonePreset: { zones: [{ type: 'drawer', h: 180 }, { type: 'drawer', h: 180 }, { type: 'drawer', h: 360 }] }, ...extra })

  it('cuts only a bottom and a back per drawer, the back sized from the catalog by height class', () => {
    const db = workOrderPieces(wo(), room([metal()]), { drawerSystems: [TANDEM] }).filter(p => p.kind === 'drawer')
    expect(db.map(p => p.code)).toEqual(['DB1-BT', 'DB1-BK', 'DB2-BT', 'DB2-BK', 'DB3-BT', 'DB3-BK'])
    const backs = db.filter(p => p.code.endsWith('-BK'))
    // inner width 600 - 36 = 564, less the system's 87
    expect(backs.map(p => [p.length, p.width, p.thickness])).toEqual([[477, 68, 16], [477, 68, 16], [477, 167, 16]])
    expect(db.flatMap(p => p.errors)).toEqual([])
  })

  it('cuts the back from the drawer box board only when its thickness matches', async () => {
    const { setCompanyDrawerMaterials } = await import('../formulaEngine')
    try {
      setCompanyDrawerMaterials({ boxMaterialCode: 'WB16', boxThickness: 16 })
      const back = (p) => p.find(x => x.code === 'DB1-BK')
      expect(back(workOrderPieces(wo(), room([metal()]), { drawerSystems: [TANDEM] })).sku).toBe('WB16')
      setCompanyDrawerMaterials({ boxMaterialCode: 'WB12', boxThickness: 12 })
      expect(back(workOrderPieces(wo(), room([metal()]), { drawerSystems: [TANDEM] })).sku).toBeNull()
    } finally {
      setCompanyDrawerMaterials({})
    }
  })

  it('cuts no back and says why when the catalog has no back sizes', () => {
    const db = workOrderPieces(wo(), room([metal()]), { drawerSystems: [{ ...TANDEM, back_height_c: null }] }).filter(p => p.kind === 'drawer')
    expect(db.map(p => p.code)).toEqual(['DB1-BT', 'DB1-BK', 'DB2-BT', 'DB2-BK', 'DB3-BT'])
    expect(db.find(p => p.code === 'DB3-BT').errors[0]).toMatch(/TANDEMBOX \(height class C\)/)
    expect(workOrderPieces(wo(), room([metal()])).filter(p => p.code.endsWith('-BK') && p.kind === 'drawer')).toEqual([])
  })
})
