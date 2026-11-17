import { describe, it, expect } from 'vitest'
import { DEFAULT_WARDROBE_STANDARD as STD, normalizeStandard } from './wardrobeStandard'
import { computeWardrobe, defaultDesign, sectionWidths, resolveZones, confirmatPerJoint, withSectionCount, presetZones, cutListCsv, runnerLengthFor } from './wardrobeEngine'

const find = (res, name, extra = {}) => res.parts.filter((p) => p.name === name && Object.entries(extra).every(([k, v]) => p[k] === v))
const qty = (rows) => rows.reduce((a, p) => a + p.qty, 0)

describe('default ABC wardrobe 2400 x 2600 x 600 with loft', () => {
  const d = defaultDesign(STD)
  const res = computeWardrobe(d, STD)

  it('splits into three 800 sections and a 2000 body under a 500 loft', () => {
    expect(d.sections).toHaveLength(3)
    expect(sectionWidths(d)).toEqual([800, 800, 800])
    expect(res.summary.bodyH).toBe(2000)
    expect(res.summary.innerH).toBe(1964)
    expect(res.summary.usableDepth).toBe(574)
  })

  it('cuts sides, tops and grooved backs to the standard', () => {
    expect(qty(find(res, 'Side', { L: 2000, W: 600 }))).toBe(6)
    expect(qty(find(res, 'Side', { L: 500, W: 600 }))).toBe(6)
    expect(qty(find(res, 'Top', { L: 764, W: 600, loft: false }))).toBe(3)
    const back = find(res, 'Back', { loft: false })[0]
    expect(back.L).toBe(1978)
    expect(back.W).toBe(778)
    expect(back.T).toBe(8)
  })

  it('gives two 397 x 1997 doors per section with 4 hinges each, loft doors 2 hinges', () => {
    const body = find(res, 'Door', { loft: false })[0]
    expect(body.W).toBe(397)
    expect(body.L).toBe(1997)
    expect(body.qty).toBe(6)
    const loft = find(res, 'Door', { loft: true })[0]
    expect(loft.L).toBe(497)
    expect(res.hardware.hinge).toBe(6 * 4 + 6 * 2)
    expect(res.hardware.leg).toBe(12)
  })

  it('has no warnings for the default design', () => {
    expect(res.warnings).toEqual([])
  })

  it('zones plus dividers fill the inner height exactly', () => {
    d.sections.forEach((s) => {
      const { zones } = resolveZones(s.zones, 1964, STD)
      const total = zones.reduce((a, z) => a + z.h, 0) + (zones.length - 1) * STD.carcassT
      expect(total).toBeCloseTo(1964, 5)
      expect(zones[0].top).toBe(1964)
      expect(zones[zones.length - 1].bottom).toBeCloseTo(0, 5)
    })
  })

  it('sizes internal drawers between 25mm spacers on 550 runners', () => {
    const front = find(res, 'Drawer front')[0]
    expect(front.L).toBe(764 - 50 - 4)
    expect(front.W).toBe(197)
    expect(front.qty).toBe(3)
    expect(find(res, 'Drawer side')[0].L).toBe(550)
    expect(runnerLengthFor(574, STD)).toBe(550)
    expect(runnerLengthFor(560, STD)).toBe(500)
  })
})

describe('section widths', () => {
  it('takes fillers off and shares the rest after a fixed section', () => {
    const d = { width: 2000, fillerLeft: 50, fillerRight: 0, sections: [{ w: 450 }, {}, {}] }
    expect(sectionWidths(d)).toEqual([450, 750, 750])
  })
  it('gives odd millimetres to the last free section', () => {
    const d = { width: 2001, sections: [{}, {}, {}] }
    expect(sectionWidths(d)).toEqual([667, 667, 667])
    const d2 = { width: 2003, sections: [{}, {}] }
    expect(sectionWidths(d2)).toEqual([1001, 1002])
  })
})

describe('rules and warnings', () => {
  it('warns when the body is taller than the transport limit without a loft', () => {
    const d = { ...defaultDesign(STD), loft: false }
    const res = computeWardrobe(d, STD)
    expect(res.summary.bodyH).toBe(2500)
    expect(res.warnings.map((w) => w.code)).toContain('bodyTooTall')
  })

  it('warns when hanging depth is under 530', () => {
    const d = { ...defaultDesign(STD), depth: 550 }
    expect(computeWardrobe(d, STD).warnings.map((w) => w.code)).toContain('hangDepth')
  })

  it('flags a section wider than the max door count allows', () => {
    const d = defaultDesign(STD)
    d.sections[0] = { ...d.sections[0], doors: 1 }
    const codes = computeWardrobe(d, STD).warnings.map((w) => w.code)
    expect(codes).toContain('doorTooWide')
  })

  it('reports zones that do not fit', () => {
    const d = defaultDesign(STD)
    d.sections[0] = { ...d.sections[0], zones: [{ type: 'hang', h: 1600 }, { type: 'shelves', h: 400, n: 0 }, { type: 'drawers', n: 3, h: 600, auto: true }] }
    const res = computeWardrobe(d, STD)
    expect(res.warnings.find((w) => w.code === 'zonesOverflow').level).toBe('error')
  })

  it('makes sliding doors across the whole run with overlap', () => {
    const d = { ...defaultDesign(STD), doorType: 'sliding' }
    const res = computeWardrobe(d, STD)
    const doors = find(res, 'Sliding door')[0]
    expect(doors.qty).toBe(3)
    expect(doors.W).toBeCloseTo((2400 + 80) / 3, 1)
    expect(doors.L).toBe(1950)
    expect(find(res, 'Door', { loft: false })).toHaveLength(0)
    expect(res.summary.usableDepth).toBe(474)
  })

  it('counts confirmat screws per joint like the machining rules', () => {
    expect(confirmatPerJoint(600)).toBe(3)
    expect(confirmatPerJoint(120)).toBe(2)
    expect(confirmatPerJoint(1000)).toBe(5)
  })
})

describe('helpers', () => {
  it('keeps existing sections when the count changes', () => {
    const d = defaultDesign(STD)
    const more = withSectionCount(d, 4, STD)
    expect(more.sections).toHaveLength(4)
    expect(more.sections[0].zones).toEqual(d.sections[0].zones)
    expect(withSectionCount(more, 2, STD).sections).toHaveLength(2)
  })

  it('returns fresh zone objects from presets', () => {
    const a = presetZones('longHang', STD)
    const b = presetZones('longHang', STD)
    expect(a[0]).not.toBe(b[0])
  })

  it('normalizes a stored standard and ignores junk', () => {
    const s = normalizeStandard({ carcassT: '16', maxDoorW: 'abc', runnerLengths: [400, 300] })
    expect(s.carcassT).toBe(16)
    expect(s.maxDoorW).toBe(STD.maxDoorW)
    expect(s.runnerLengths).toEqual([300, 400])
  })

  it('writes a CSV with quoted fields', () => {
    const csv = cutListCsv({ parts: [{ name: 'Side, left', nameAr: 'جانب', sections: ['S1'], L: 1, W: 2, T: 18, qty: 2, material: 'Carcass', edges: 'F' }] })
    expect(csv.split('\n')[1]).toBe('1,"Side, left",جانب,S1,1,2,18,2,Carcass,F')
  })
})
