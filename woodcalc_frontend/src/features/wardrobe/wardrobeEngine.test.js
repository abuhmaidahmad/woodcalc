import { describe, it, expect } from 'vitest'
import { DEFAULT_WARDROBE_STANDARD as STD, normalizeStandard } from './wardrobeStandard'
import { computeWardrobe, defaultDesign, sectionWidths, resolveZones, confirmatPerJoint, withSectionCount, presetZones, cutListCsv, runnerLengthFor, splitRun } from './wardrobeEngine'

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

describe('shared partitions, no back', () => {
  const d = { ...defaultDesign(STD), construction: 'shared', backType: 'none' }
  const res = computeWardrobe(d, STD)
  const boxes = computeWardrobe(defaultDesign(STD), STD)

  it('uses 2 full-height outer sides and 2 partitions between top and bottom', () => {
    expect(qty(find(res, 'Side', { loft: false }))).toBe(2)
    expect(find(res, 'Side', { loft: false })[0].L).toBe(2000)
    const p = find(res, 'Partition', { loft: false })
    expect(qty(p)).toBe(2)
    expect(p[0].L).toBe(1964)
    expect(p[0].W).toBe(600)
    expect(qty(find(res, 'Partition', { loft: true }))).toBe(2)
  })

  it('makes one continuous top and bottom between the outer sides', () => {
    expect(find(res, 'Top', { loft: false })).toEqual([expect.objectContaining({ L: 2364, W: 600, qty: 1 })])
    expect(find(res, 'Bottom', { loft: false })).toEqual([expect.objectContaining({ L: 2364, qty: 1 })])
  })

  it('has no back but 2 rails of 100 per bay, and gains depth', () => {
    expect(find(res, 'Back')).toHaveLength(0)
    const rails = find(res, 'Back rail', { loft: false })
    expect(qty(rails)).toBe(6)
    expect(rails.map((r) => r.L).sort()).toEqual([773, 782])
    expect(rails[0].W).toBe(100)
    expect(rails[0].material).toBe('Carcass')
    expect(res.summary.usableDepth).toBe(582)
    expect(res.summary.usableDepth).toBeGreaterThan(boxes.summary.usableDepth)
    expect(res.sections.map((s) => s.innerW)).toEqual([773, 782, 773])
  })

  it('cuts shelves to the bay and the extra depth less wall clearance', () => {
    const shelf = find(res, 'Shelf')[0]
    expect(shelf.W).toBe(582 - STD.wallClearance - STD.shelfFrontSetback)
    find(res, 'Fixed shelf').forEach((p) => expect([773, 782]).toContain(p.L))
    expect(find(res, 'Drawer front')[0].L).toBe(782 - 50 - 4)
  })

  it('counts each partition once for confirmat and legs', () => {
    const fixedShelves = qty(find(res, 'Fixed shelf'))
    const shelfScrews = fixedShelves * 2 * confirmatPerJoint(581)
    const carcass = 2 * (4 * 3 + 2 * 2 * 3)
    const rails = 12 * 2 * 2
    expect(res.hardware.confirmat).toBe(carcass + rails + shelfScrews)
    expect(res.hardware.leg).toBe(8)
  })

  it('needs fewer carcass sheets than separate boxes', () => {
    const carc = (r) => r.materials.filter((m) => m.material === 'Carcass').reduce((a, m) => a + m.areaM2, 0)
    expect(carc(res)).toBeLessThan(carc(boxes))
    expect(res.summary.construction).toBe('shared')
  })

  it('keeps door sizes the same as boxes', () => {
    expect(find(res, 'Door', { loft: false })[0]).toEqual(expect.objectContaining({ W: 397, L: 1997, qty: 6 }))
  })
})

describe('shared partitions, other options', () => {
  it('splits a long top with the joint centred on a partition', () => {
    const d = withSectionCount({ ...defaultDesign(STD), width: 3000, construction: 'shared' }, 3, STD)
    const res = computeWardrobe(d, STD)
    expect(find(res, 'Top', { loft: false }).map((p) => p.L).sort((a, b) => a - b)).toEqual([982, 1982])
    expect(res.warnings.map((w) => w.code)).not.toContain('panelTooLong')
  })

  it('splits a full back on partitions and shortens partitions for it', () => {
    const d = { ...defaultDesign(STD), construction: 'shared', backType: 'full' }
    const res = computeWardrobe(d, STD)
    const backs = find(res, 'Back', { loft: false })
    expect(backs.map((b) => b.W).sort((a, b) => a - b)).toEqual([789, 800])
    expect(qty(backs)).toBe(3)
    expect(backs[0].L).toBe(1978)
    expect(find(res, 'Partition', { loft: false })[0].W).toBe(600 - STD.grooveSetback - STD.backT)
    expect(find(res, 'Back rail')).toHaveLength(0)
    expect(res.summary.usableDepth).toBe(574)
  })

  it('gives one back per bay', () => {
    const d = { ...defaultDesign(STD), construction: 'shared', backType: 'perSection' }
    const res = computeWardrobe(d, STD)
    expect(find(res, 'Back', { loft: false }).map((b) => b.W).sort()).toEqual([787, 796])
    expect(find(res, 'Partition', { loft: false })[0].W).toBe(600)
  })

  it('still loses track depth with sliding doors', () => {
    const d = { ...defaultDesign(STD), construction: 'shared', doorType: 'sliding' }
    expect(computeWardrobe(d, STD).summary.usableDepth).toBe(600 - 100 - 18)
  })

  it('follows the editable join rules', () => {
    const d = { ...defaultDesign(STD), construction: 'shared' }
    const over = computeWardrobe(d, { ...STD, sideJoin: 'between' })
    expect(find(over, 'Side', { loft: false })[0].L).toBe(1964)
    expect(find(over, 'Top', { loft: false })[0].L).toBe(2400)
    const full = computeWardrobe(d, { ...STD, partitionJoin: 'full' })
    expect(find(full, 'Partition', { loft: false })[0].L).toBe(2000)
    expect(qty(find(full, 'Top', { loft: false }))).toBe(3)
  })

  it('takes rail count and height from the standard', () => {
    const d = { ...defaultDesign(STD), construction: 'shared', loft: false, height: 2100 }
    const res = computeWardrobe(d, { ...STD, backRailCount: 3, backRailH: 120 })
    expect(qty(find(res, 'Back rail'))).toBe(9)
    expect(find(res, 'Back rail')[0].W).toBe(120)
    expect(qty(find(computeWardrobe(d, { ...STD, backRailCount: 0 }), 'Back rail'))).toBe(0)
  })

  it('splits runs greedily at cuts', () => {
    expect(splitRun(0, 3000, [1000, 2000], 2440).pieces).toEqual([[0, 2000], [2000, 3000]])
    expect(splitRun(0, 3000, [], 2440).tooLong).toBe(true)
  })

  it('reads join rules from a stored standard', () => {
    expect(normalizeStandard({ sideJoin: 'between', partitionJoin: 'junk' })).toEqual(expect.objectContaining({ sideJoin: 'between', partitionJoin: 'between' }))
  })
})
