import { describe, expect, it } from 'vitest'
import { groupByWall, hardwareList } from './jobDesign'

const walls = [
  { index: 0, label: 'Wall 1', x1: 0, y1: 0, x2: 4000, y2: 0 },
  { index: 1, label: 'Wall 2', x1: 0, y1: 0, x2: 0, y2: 3000 },
]

describe('groupByWall', () => {
  it('groups cabinets by wall in order along the wall and keeps free-standing ones last', () => {
    const design = {
      walls,
      cabinets: [
        { id: 'b', wall: 0, x: 2000, y: 0, width: 600, depth: 560 },
        { id: 'a', wall: 0, x: 0, y: 0, width: 600, depth: 560 },
        { id: 'island', wall: null, x: 1500, y: 1500, width: 1200, depth: 900 },
      ],
      elements: [{ id: 'water', wall: 0 }],
    }
    const groups = groupByWall(design)
    expect(groups.map(g => g.wall?.label ?? null)).toEqual(['Wall 1', null])
    expect(groups[0].cabinets.map(c => c.id)).toEqual(['a', 'b'])
    expect(groups[0].elements.map(e => e.id)).toEqual(['water'])
    expect(groups[1].cabinets.map(c => c.id)).toEqual(['island'])
  })
})

describe('hardwareList', () => {
  it('sums hardware for carcass cabinets and skips appliances', () => {
    const items = hardwareList([
      { category: 'base', subtype: 'Base', width: 600, height: 720, depth: 560, doorStyle: 'Handle', doorCount: 1 },
      { category: 'accessories', subtype: 'Freestanding Fridge', width: 600, height: 1800, depth: 650 },
    ])
    const qty = Object.fromEntries(items.map(i => [i.key, i.qty]))
    expect(qty.legs).toBe(4)
    expect(qty.hinges).toBeGreaterThan(0)
    expect(qty.handles).toBe(1)
  })

  it('returns an empty list when there are no cabinets', () => {
    expect(hardwareList([])).toEqual([])
  })
})
