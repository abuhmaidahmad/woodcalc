import { describe, it, expect } from 'vitest'
import { bomPanelsToGroups, boardKey } from './CuttingOptimizerModule'

const cab = (frontMaterialCode, width) => ({
  category: 'base', subtype: 'Base', width, height: 720, depth: 560,
  carcassMaterialCode: 'PLY18', frontMaterialCode, doorStyle: 'slab',
})

describe('bomPanelsToGroups', () => {
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
    expect(hg.parts.some(p => p.label === 'Door')).toBe(true)
    expect(hg.parts.some(p => p.label !== 'Door')).toBe(true)
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
    expect(hg.parts).toEqual([{ label: 'Filler', width: '720', height: '50', quantity: 1, grain_locked: true }])
    const h1210 = groups.find(g => g.sku === 'H1210_ST')
    expect(h1210.parts).toEqual([{ label: 'Side Panel', width: '2400', height: '580', quantity: 1, grain_locked: true }])
    const ply = groups.find(g => g.sku === 'PLY18')
    expect(ply.parts).toEqual([{ label: 'Filler Fixing Cleat', width: '717', height: '100', quantity: 1, grain_locked: false }])
  })

  it('cuts drawer fronts from the front board with the grain along their height', () => {
    const drawers = { ...cab('H1210_ST', 600), subtype: 'Drawers' }
    const groups = bomPanelsToGroups([drawers], 'front')
    const fronts = groups[0].parts.filter(p => p.label === 'Drawer Front')
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
    const door = front.parts.find(p => p.label === 'Door')
    expect(front.parts.find(p => p.label === 'Blind filler'))
      .toEqual({ label: 'Blind filler', width: door.width, height: '150', quantity: 1, grain_locked: true })
    expect(groups.find(g => g.sku === 'PLY18').parts.some(p => p.label === 'Blind filler')).toBe(false)
  })

  it("cuts a filler's cleat from the kitchen's carcass board when the filler has none", () => {
    const filler = { ...cab('HG623', 50), category: 'accessories', subtype: 'Filler', carcassMaterialCode: null }
    const groups = bomPanelsToGroups([cab('HG623', 600), cab('HG623', 400), filler], 'carcass')
    expect(groups.map(g => g.sku)).toEqual(['PLY18'])
    expect(groups[0].parts.some(p => p.label === 'Filler Fixing Cleat')).toBe(true)
  })
})

describe('boardKey', () => {
  it('treats 18 and "18.00" as the same board', () => {
    expect(boardKey(5, '18.00')).toBe(boardKey('5', 18))
    expect(boardKey(5, '18')).not.toBe(boardKey(5, '3'))
  })
})
