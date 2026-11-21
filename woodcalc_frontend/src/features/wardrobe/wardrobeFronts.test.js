import { describe, it, expect } from 'vitest'
import { DEFAULT_WARDROBE_STANDARD as STD } from './wardrobeStandard'
import { computeWardrobe, defaultDesign, withSectionCount, resolveFrontRows, rowsFromZones } from './wardrobeEngine'
import { defaultCloset, computeDesign } from './closetEngine'
import { priceWardrobe } from './wardrobePricing'
import { piecesFromParts } from './wardrobePieces'
import { getHingeCount } from '../kitchen_planner/formulaEngine'

const SHOE_FRONTS = [
  { h: null, items: [{ type: 'door', hinge: 'left' }] },
  { h: 185, items: [{ type: 'fixed' }] },
  { h: 490, items: [{ type: 'door', hinge: 'left' }] },
]

function acceptance(extra = {}, fronts = SHOE_FRONTS) {
  const d = withSectionCount({ ...defaultDesign(STD), width: 2500, height: 2400, depth: 600, fillerLeft: 40, doorType: 'hinged', loft: true, loftH: 300, ...extra }, 4, STD)
  d.sections[0] = { ...d.sections[0], w: 510, preset: null, zones: [{ type: 'shelves', auto: true, n: null }, { type: 'shelves', h: 680, n: 1 }], fronts }
  return d
}
const parts = (r, name) => r.parts.filter((p) => p.name === name && p.sections.includes('S1') && !p.loft)
const ops = (p, rule) => (p.part?.machining_ops || []).filter((o) => o.rule === rule)

describe('custom fronts regression', () => {
  it('gives identical results with fronts null or empty and no hinge', () => {
    const base = defaultDesign(STD)
    const closet = { ...base, mode: 'closet', closet: { ...defaultCloset(STD), runs: { ...defaultCloset(STD).runs, A: { ...defaultCloset(STD).runs.A, doorType: 'hinged' } } } }
    const out = (d) => JSON.stringify(computeDesign(d, STD), (k, v) => (k === 'design' ? undefined : v))
    ;[base, { ...base, construction: 'shared' }, closet].forEach((d) => {
      const plain = out(d)
      const withNull = (sections) => sections.map((s) => ({ ...s, fronts: null }))
      const nulled = d.mode === 'closet'
        ? { ...d, closet: { ...d.closet, runs: Object.fromEntries(Object.entries(d.closet.runs).map(([k, r]) => [k, { ...r, sections: withNull(r.sections) }])) } }
        : { ...d, sections: withNull(d.sections) }
      expect(out(nulled)).toBe(plain)
      if (d.sections) expect(out({ ...d, sections: d.sections.map((s) => ({ ...s, fronts: [] })) })).toBe(plain)
    })
  })
})

describe('custom fronts on the acceptance job', () => {
  const res = computeWardrobe(acceptance(), STD)
  const auto = computeWardrobe(acceptance({}, null), STD)

  it('resolves rows bottom-up with the fill row taking the rest', () => {
    const { rows } = resolveFrontRows(SHOE_FRONTS, 2000)
    expect(rows.map((r) => [r.h, r.bottom, r.fill])).toEqual([[1325, 675, true], [185, 490, false], [490, 0, false]])
  })

  it('cuts two doors and one fixed front at the right sizes', () => {
    expect(parts(res, 'Door').map((p) => [p.L, p.W, p.qty]).sort((a, b) => a[0] - b[0])).toEqual([[487, 507, 1], [1322, 507, 1]])
    expect(parts(res, 'Fixed front')).toEqual([expect.objectContaining({ L: 182, W: 507, qty: 1, material: 'Front', edges: 'F,B,L,R' })])
    expect(res.summary.fixedFrontCount).toBe(1)
    expect(res.summary.doorCount).toBe(auto.summary.doorCount + 1)
  })

  it('counts hinges per door and a handle per door', () => {
    expect(res.hardware.hinge).toBe(auto.hardware.hinge - getHingeCount(1997) + getHingeCount(1322) + getHingeCount(487))
    expect(res.hardware.handle).toBe(auto.hardware.handle + 1)
  })

  it('hangs both doors on the left wall and draws a fixed front', () => {
    const g = res.geometry.filter((x) => x.section === 0 && !x.loft)
    expect(g.filter((x) => x.kind === 'door').map((x) => x.hinge)).toEqual(['left', 'left'])
    expect(g.filter((x) => x.kind === 'fixedFront')).toHaveLength(1)
    expect(g.find((x) => x.kind === 'fixedFront')).toEqual(expect.objectContaining({ y: 100 + 490 + 1.5, h: 182, w: 507 }))
  })

  it('drills hinge plates on the left wall only, at the cup centres of both doors', () => {
    const ps = piecesFromParts(res.rawParts, { woNumber: 'WO1', roomNumber: 1 })
    const sides = ps.filter((p) => p.name === 'Side' && p.cabinet === 'S1' && !p.code.startsWith('L'))
    expect(sides).toHaveLength(2)
    const [leftSide, rightSide] = sides
    expect(ops(rightSide, 'hinge_plate')).toHaveLength(0)
    const doors = ps.filter((p) => p.name === 'Door' && p.cabinet === 'S1' && !p.code.startsWith('L'))
    const centres = doors.flatMap((d) => {
      const bottom = d.length === 487 ? 101.5 : 100 + 675 + 1.5
      return ops(d, 'hinge').map((c) => bottom + c.x - 100)
    }).sort((a, b) => a - b)
    expect(centres).toHaveLength(getHingeCount(1322) + getHingeCount(487))
    expect(ops(leftSide, 'hinge_plate').map((o) => o.x).sort((a, b) => a - b)).toEqual(centres.flatMap((c) => [c - 16, c + 16]).sort((a, b) => a - b))
  })

  it('flags a fixed front with no fixed shelf at either edge, not one that sits on a shelf', () => {
    expect(res.warnings.map((w) => w.code)).toContain('fixedFrontNoSupport')
    const onShelf = computeWardrobe(acceptance({}, [SHOE_FRONTS[0], { h: 210, items: [{ type: 'fixed' }] }, SHOE_FRONTS[2]]), STD)
    expect(onShelf.warnings.map((w) => w.code)).not.toContain('fixedFrontNoSupport')
  })

  it('prices the fixed front as front board and passes clash checks', () => {
    const front = (r) => priceWardrobe(r, STD).boards.find((b) => b.material === 'Front' && b.T === 18).areaM2
    expect(front(res)).toBeCloseTo(front(auto) - (1997 * 507) / 1e6 + (1322 * 507 + 487 * 507 + 182 * 507) / 1e6, 1)
    const ps = piecesFromParts(res.rawParts, { woNumber: 'WO1', roomNumber: 1 })
    expect(ps.find((p) => p.name === 'Fixed front').code).toBe('FXF1')
    expect(ps.flatMap((p) => p.errors)).toEqual([])
  })
})

describe('custom front rules', () => {
  it('forces left/right hinges in a two-item row', () => {
    const r = computeWardrobe(acceptance({}, [{ h: null, items: [{ type: 'door', hinge: 'right' }, { type: 'door', hinge: 'left' }] }]), STD)
    expect(r.geometry.filter((g) => g.section === 0 && g.kind === 'door' && !g.loft).map((g) => g.hinge)).toEqual(['left', 'right'])
  })

  it('reports rows taller than the body', () => {
    const r = computeWardrobe(acceptance({}, [{ h: null, items: [{ type: 'door' }] }, { h: 1500, items: [{ type: 'door' }] }, { h: 600, items: [{ type: 'door' }] }]), STD)
    expect(r.warnings.find((w) => w.code === 'frontsTooTall')).toEqual(expect.objectContaining({ level: 'error', params: { section: 'S1', h: 2100, max: 2000 } }))
  })

  it('warns about rows under the minimum front height', () => {
    const r = computeWardrobe(acceptance({}, [{ h: null, items: [{ type: 'door' }] }, { h: 80, items: [{ type: 'fixed' }] }]), STD)
    expect(r.warnings.map((w) => w.code)).toContain('frontRowTooSmall')
  })

  it('leaves open items without a part', () => {
    const r = computeWardrobe(acceptance({}, [{ h: null, items: [{ type: 'door' }] }, { h: 600, items: [{ type: 'open' }] }]), STD)
    expect(parts(r, 'Door')).toHaveLength(1)
    expect(parts(r, 'Fixed front')).toHaveLength(0)
  })

  it('hangs an auto single door on the right when asked', () => {
    const d = { ...defaultDesign(STD), construction: 'shared' }
    d.sections = d.sections.map((s, i) => ({ ...s, doors: 1, ...(i === 0 ? { hinge: 'right' } : {}) }))
    const r = computeWardrobe(d, STD)
    expect(r.geometry.filter((g) => g.section === 0 && g.kind === 'door' && !g.loft).map((g) => g.hinge)).toEqual(['right'])
    const ps = piecesFromParts(r.rawParts, { woNumber: 'WO1', roomNumber: 1 })
    const p1 = ps.find((p) => p.id === 'WO1-R1-00-P1')
    expect(ops(p1, 'hinge_plate').filter((o) => o.face === 'TOP').length).toBeGreaterThan(0)
    const leftSide = ps.find((p) => p.name === 'Side' && !p.code.startsWith('L'))
    expect(ops(leftSide, 'hinge_plate').filter((o) => o.x < 2000)).toHaveLength(0)
  })

  it('builds rows from zones with edges on the fixed shelves', () => {
    const r = computeWardrobe(acceptance({}, null), STD)
    const rows = rowsFromZones(r.sections[0].zones, 2000, 18)
    expect(rows).toEqual([{ h: null, items: [{ type: 'door' }] }, { h: 707, items: [{ type: 'door' }] }])
    expect(resolveFrontRows(rows, 2000).rows.map((x) => x.h)).toEqual([1293, 707])
  })

  it('passes closet run sections through untouched', () => {
    const closet = defaultCloset(STD)
    const runA = { ...closet.runs.A, doorType: 'hinged' }
    runA.sections = runA.sections.map((s, i) => (i === 0 ? { ...s, fronts: SHOE_FRONTS } : s))
    const r = computeDesign({ ...defaultDesign(STD), mode: 'closet', closet: { ...closet, runs: { ...closet.runs, A: runA } } }, STD)
    expect(r.parts.some((p) => p.name === 'Fixed front')).toBe(true)
    expect(r.summary.fixedFrontCount).toBe(1)
  })
})
