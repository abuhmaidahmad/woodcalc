import { describe, it, expect } from 'vitest'
import { bomPanelsToGroups } from './CuttingOptimizerModule'

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
})
