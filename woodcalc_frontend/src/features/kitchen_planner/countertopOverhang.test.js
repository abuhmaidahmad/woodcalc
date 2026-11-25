import { describe, it, expect } from 'vitest'
import { hasCountertop, countertopFootprint, countertopOutline } from './countertopOverhang'

const base = (x, y, width, extra = {}) => ({ category: 'base', subtype: 'Standard', x, y, width, depth: 560, height: 720, baseHeight: 720, rotation: 0, ...extra })

const round = segs => segs.map(s => s.map(p => p.map(v => Math.round(v * 100) / 100)))

describe('hasCountertop', () => {
  it('matches the 3D countertop rule', () => {
    expect(hasCountertop(base(0, 0, 600))).toBe(true)
    expect(hasCountertop({ category: 'wall', subtype: 'Standard' })).toBe(false)
    expect(hasCountertop({ category: 'tall', subtype: 'Pantry' })).toBe(false)
    expect(hasCountertop({ category: 'base', subtype: 'Open Shelf' })).toBe(true)
    expect(hasCountertop({ category: 'base', subtype: 'Toe Kick' })).toBe(false)
    expect(hasCountertop({ category: 'accessory', subtype: 'Filler', height: 720, baseHeight: 720 })).toBe(true)
    expect(hasCountertop({ category: 'accessory', subtype: 'Filler', height: 2200, baseHeight: 720 })).toBe(false)
    expect(hasCountertop({ category: 'appliance', subtype: 'Freestanding Dishwasher' })).toBe(true)
  })
})

describe('countertopFootprint', () => {
  it('uses default overhangs with front at the high-y side', () => {
    const { pts } = countertopFootprint(base(100, 0, 600))
    expect(round([pts])[0]).toEqual([[80, 0], [720, 0], [720, 600], [80, 600]])
  })

  it('rotates around the cabinet centre', () => {
    const { pts } = countertopFootprint(base(0, 0, 600, { rotation: 90, depth: 600, ctOverhang: { front: 40, back: 0, left: 0, right: 0 } }))
    const xs = pts.map(p => Math.round(p[0]) + 0), ys = pts.map(p => Math.round(p[1]) + 0)
    expect(Math.min(...xs)).toBe(-40)
    expect(Math.max(...xs)).toBe(600)
    expect(Math.min(...ys)).toBe(0)
    expect(Math.max(...ys)).toBe(600)
  })
})

describe('countertopOutline', () => {
  it('draws one continuous front line and the two end returns for a straight run', () => {
    const segs = round(countertopOutline([base(0, 0, 600), base(600, 0, 400)]))
    expect(segs).toHaveLength(3)
    expect(segs).toContainEqual([[1020, 600], [-20, 600]])
    expect(segs).toContainEqual([[-20, 600], [-20, 0]])
    expect(segs).toContainEqual([[1020, 0], [1020, 600]])
  })

  it('skips sides with zero overhang', () => {
    const segs = countertopOutline([base(0, 0, 600, { ctOverhang: { front: 40, back: 0, left: 0, right: 0 } })])
    expect(segs).toHaveLength(1)
  })

  it('handles an L corner without drawing lines inside the worktop', () => {
    const run = base(0, 0, 1000, { ctOverhang: { front: 40, back: 0, left: 0, right: 20 } })
    const side = base(-600, 600, 600, { rotation: 90, ctOverhang: { front: 40, back: 0, left: 20, right: 0 } })
    const segs = countertopOutline([run, side])
    const inside = (p) => p[0] > 1 && p[0] < 999 && p[1] > 1 && p[1] < 599
    for (const sg of segs) {
      const m = [(sg[0][0] + sg[1][0]) / 2, (sg[0][1] + sg[1][1]) / 2]
      expect(inside(m)).toBe(false)
    }
  })

  it('ignores wall and tall units', () => {
    expect(countertopOutline([{ category: 'wall', x: 0, y: 0, width: 600, depth: 350 }])).toEqual([])
  })
})
