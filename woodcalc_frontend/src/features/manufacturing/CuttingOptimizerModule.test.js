import { describe, it, expect } from 'vitest'
import { piecesToGroups, partRows, boardKey } from './CuttingOptimizerModule'
import { workOrderPieces } from '../kitchen_planner/machining/pieces'
import { bilingualPartName as L } from '../kitchen_planner/partNamesAr'

// A work order's pieces grouped per board, then (to check sizes and counts the
// way the saw reads them) identical pieces merged into one line with a quantity.
const load = (cabinets, group) => piecesToGroups(
  workOrderPieces({ order_number: 'WO-1' }, { room_number: 1, planner_data: { cabinets: cabinets.map((c, i) => ({ id: i + 1, ...c })) } }),
  group)
const merged = (parts) => partRows(parts).map(r => ({ label: r.label, width: r.width, height: r.height, quantity: r.ids.length, grain_locked: r.grain_locked }))
const bomPanelsToGroups = (cabinets, group) => load(cabinets, group).map(g => ({ ...g, parts: merged(g.parts) }))

const cab = (frontMaterialCode, width) => ({
  category: 'base', subtype: 'Base', width, height: 720, depth: 560,
  carcassMaterialCode: 'PLY18', frontMaterialCode, doorStyle: 'slab',
})

describe('piecesToGroups', () => {
  it('splits fronts into one group per front material', () => {
    const groups = bomPanelsToGroups([cab('HG623', 600), cab('H1210_ST', 400), cab('HG623', 600)], 'front')
    expect(groups.map(g => g.sku).sort()).toEqual(['H1210_ST', 'HG623'])
    groups.forEach(g => expect(g.parts.length).toBeGreaterThan(0))
  })

  it('keeps carcass in one group when every cabinet shares the board', () => {
    const groups = bomPanelsToGroups([cab('HG623', 600), cab('H1210_ST', 400)], 'carcass')
    expect(groups.map(g => g.sku)).toEqual(['PLY18'])
  })

  it('treats a code with stray spaces as the same board', () => {
    const groups = bomPanelsToGroups([cab('HG623', 600), { ...cab('HG623', 400), carcassMaterialCode: 'PLY18 ' }], 'carcass')
    expect(groups.map(g => g.sku)).toEqual(['PLY18'])
  })

  it('gathers carcass and fronts into one group per material', () => {
    const groups = bomPanelsToGroups([cab('HG623', 600), { ...cab('HG623', 400), carcassMaterialCode: 'HG623' }], 'all')
    const skus = groups.map(g => g.sku).filter(Boolean).sort()
    expect(skus).toEqual(['HG623', 'PLY18'])
    const hg = groups.find(g => g.sku === 'HG623')
    expect(hg.parts.some(p => p.label === L('Door'))).toBe(true)
    expect(hg.parts.some(p => p.label !== L('Door'))).toBe(true)
  })

  it('leaves glass shelves out -- the glass supplier makes them to size', () => {
    const openBox = { ...cab('HG623', 600), category: 'wall', subtype: 'Open Shelf', height: 720, depth: 320 }
    const groups = bomPanelsToGroups([openBox], 'all')
    expect(groups.flatMap(g => g.parts).some(p => /glass/i.test(p.label))).toBe(false)
  })

  it('cuts fillers and side panels from the front board, and the filler cleat from the carcass', () => {
    const filler = { ...cab('HG623', 50), category: 'accessories', subtype: 'Filler' }
    const panel = { ...cab('H1210_ST', 18), category: 'accessories', subtype: 'Side Panel', height: 2400, depth: 580 }
    const fridge = { ...cab('HG623', 600), category: 'accessories', subtype: 'Fridge' }
    const groups = bomPanelsToGroups([filler, panel, fridge], 'all')
    const hg = groups.find(g => g.sku === 'HG623')
    expect(hg.parts).toEqual([{ label: L('Filler'), width: '720', height: '50', quantity: 1, grain_locked: true }])
    const h1210 = groups.find(g => g.sku === 'H1210_ST')
    expect(h1210.parts).toEqual([{ label: L('Side Panel'), width: '2400', height: '580', quantity: 1, grain_locked: true }])
    const ply = groups.find(g => g.sku === 'PLY18')
    expect(ply.parts).toEqual([{ label: L('Filler Fixing Cleat'), width: '717', height: '100', quantity: 1, grain_locked: false }])
  })

  it('cuts drawer fronts from the front board with the grain along their height', () => {
    const drawers = { ...cab('H1210_ST', 600), subtype: 'Drawers' }
    const groups = bomPanelsToGroups([drawers], 'front')
    const fronts = groups[0].parts.filter(p => p.label === L('Drawer Front'))
    expect(fronts.reduce((n, p) => n + p.quantity, 0)).toBeGreaterThan(0)
    fronts.forEach(p => {
      expect(p.grain_locked).toBe(true)
      expect(p.height).toBe('597') // the 600 cabinet's front width runs across the grain
    })
  })

  it("cuts a blind corner's 150mm filler from the front board, door height, grain locked", () => {
    const blind = { ...cab('H1210_ST', 1200), subtype: 'Blind', doorStyle: 'Gola' }
    const groups = bomPanelsToGroups([blind], 'all')
    const front = groups.find(g => g.sku === 'H1210_ST')
    const door = front.parts.find(p => p.label === L('Door'))
    expect(front.parts.find(p => p.label === L('Blind filler')))
      .toEqual({ label: L('Blind filler'), width: door.width, height: '150', quantity: 1, grain_locked: true })
    expect(groups.find(g => g.sku === 'PLY18').parts.some(p => p.label === L('Blind filler'))).toBe(false)
  })

  it("cuts a filler's cleat from the kitchen's carcass board when the filler has none", () => {
    const filler = { ...cab('HG623', 50), category: 'accessories', subtype: 'Filler', carcassMaterialCode: null }
    const groups = bomPanelsToGroups([cab('HG623', 600), cab('HG623', 400), filler], 'carcass')
    expect(groups.map(g => g.sku)).toEqual(['PLY18'])
    expect(groups[0].parts.some(p => p.label === L('Filler Fixing Cleat'))).toBe(true)
  })
})

describe('pieces in the optimizer', () => {
  it('sends every piece as its own part with its ID, cabinet and edge banding', () => {
    const groups = load([{ ...cab('HG623', 600), label: 'Base 600' }, cab('HG623', 600)], 'carcass')
    const sides = groups[0].parts.filter(p => p.label === L('Side panel'))
    expect(sides.map(p => p.piece_id)).toEqual(['WO-1-R1-01-SL', 'WO-1-R1-01-SR', 'WO-1-R1-02-SL', 'WO-1-R1-02-SR'])
    sides.forEach(p => expect(p.quantity).toBe(1))
    expect(sides[0]).toMatchObject({ cabinet: 'Base 600', width: '720', height: '560' })
    expect(sides[0].edge_banding).toHaveProperty('R')
  })

  it('shows loaded pieces grouped, and hand-typed parts on their own editable rows', () => {
    const parts = [...load([cab('HG623', 600), cab('HG623', 600)], 'carcass')[0].parts,
      { label: 'Spare', width: '500', height: '300', quantity: 2, grain_locked: false }]
    const rows = partRows(parts)
    const sides = rows.find(r => r.label === L('Side panel'))
    expect(sides).toMatchObject({ type: 'pieces', width: '720', height: '560' })
    expect(sides.ids).toHaveLength(4)
    expect(rows[rows.length - 1]).toEqual({ type: 'manual', part: parts[parts.length - 1], idx: parts.length - 1 })
  })

  it('puts drawer box parts in their own boards, only when loading everything', () => {
    const drawers = { ...cab('H1210_ST', 600), subtype: 'Drawers', drawerType: 'Wood Box', drawerSystem: 'Tandem',
      zonePreset: { zones: [{ type: 'drawer', h: 360 }, { type: 'drawer', h: 360 }] } }
    const all = load([drawers], 'all')
    // 12mm box sides/fronts/backs and the 8mm HDF bases; the HDF back (no stock
    // material set here) is its own 8mm group, as before.
    expect(all.filter(g => !g.sku).map(g => g.thickness).sort()).toEqual(['12', '8', '8'])
    expect(all.flatMap(g => g.parts).filter(p => /-DB\d-/.test(p.piece_id))).toHaveLength(2 * 5)
    expect(load([drawers], 'carcass').some(g => !g.sku)).toBe(false)
  })
})

describe('boardKey', () => {
  it('treats 18 and "18.00" as the same board', () => {
    expect(boardKey(5, '18.00')).toBe(boardKey('5', 18))
    expect(boardKey(5, '18')).not.toBe(boardKey(5, '3'))
  })
})
