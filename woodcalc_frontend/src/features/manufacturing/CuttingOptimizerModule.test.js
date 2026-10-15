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
})
