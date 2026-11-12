import { describe, it, expect, afterEach } from 'vitest'
import { calculateCabinet, setCompanyBackPanel } from '../formulaEngine'
import { buildMachining, toCabinet } from './index'
import { SURFACE_CABINETS, cutSizes } from './surfaceCabinets'
import surfaceCutSizes from './__fixtures__/surfaceCutSizes.json'

const byId = (parts) => Object.fromEntries(parts.map(p => [p.id, p]))
const grooves = (part) => part.machining_ops.filter(o => o.type === 'GROOVE')
const panel = (r, name) => r.panels.find(p => p.name === name)
const base600 = { width: 600, height: 720, depth: 560, cabinetType: 'base', subtype: 'Single Door', doorStyle: 'Handle', shelves: 1 }
const grooved = (c) => ({ ...c, backConstruction: 'groove' })

afterEach(() => setCompanyBackPanel({}))

describe("backConstruction 'surface' (the default)", () => {
  it('gives every cabinet exactly the cut sizes it had before grooves existed', () => {
    Object.entries(SURFACE_CABINETS).forEach(([name, cab]) => {
      expect(cutSizes(calculateCabinet(cab)), name).toEqual(surfaceCutSizes[name])
      expect(cutSizes(calculateCabinet({ ...cab, backConstruction: 'surface' })), name).toEqual(surfaceCutSizes[name])
    })
  })

  it('cuts no grooves', () => {
    const { parts, result } = buildMachining(base600)
    expect(result.backGroove).toBeNull()
    expect(parts.flatMap(grooves)).toEqual([])
  })
})

describe("backConstruction 'groove'", () => {
  it('sizes a 600 base for a grooved back', () => {
    const r = calculateCabinet(grooved(base600))
    expect(r.backGroove).toEqual({ width: 9, depth: 8, setback: 18, backInto: 7 })
    expect(panel(r, 'Bottom panel')).toMatchObject({ width: 564, depth: 560 })
    // inner width + 2 x (8 - 1); rails, no top: bottom groove to the top edge
    expect(panel(r, 'Back panel (HDF)')).toMatchObject({ width: 578, depth: 720 - 18 + 7, thickness: 8 })
    expect(panel(r, 'Shelf (18mm)')).toMatchObject({ depth: 560 - 18 - 9 - 10 })
    expect(panel(r, 'Front rail').depth).toBe(100)
  })

  it('runs a top-and-bottom back between both grooves', () => {
    const r = calculateCabinet(grooved({ width: 600, height: 720, depth: 350, cabinetType: 'wall', subtype: 'Single Door', doorStyle: 'Handle' }))
    expect(panel(r, 'Top panel').depth).toBe(350)
    expect(panel(r, 'Bottom panel').depth).toBe(350)
    expect(panel(r, 'Back panel (HDF)')).toMatchObject({ width: 578, depth: 720 - 36 + 14 })
  })

  it('stops a pantry fixed panel at the groove\'s front wall', () => {
    const r = calculateCabinet(grooved({ width: 600, height: 2100, depth: 560, cabinetType: 'tall', subtype: 'Pantry', doorStyle: 'Handle', doorCount: 2 }))
    expect(panel(r, 'Fixed panel').depth).toBe(560 - 18 - 9)
  })

  it('takes the groove width from the company back thickness', () => {
    setCompanyBackPanel({ thickness: 3, construction: 'groove' })
    const r = calculateCabinet(base600)
    expect(r.backGroove.width).toBe(4)
    expect(panel(r, 'Back panel (HDF)')).toMatchObject({ width: 578, thickness: 3 })
  })

  it('follows the company setting unless the cabinet says otherwise', () => {
    setCompanyBackPanel({ construction: 'groove' })
    expect(calculateCabinet(base600).backConstruction).toBe('groove')
    expect(calculateCabinet({ ...base600, backConstruction: 'surface' }).backConstruction).toBe('surface')
    setCompanyBackPanel({ construction: 'nonsense' })
    expect(calculateCabinet(base600).backConstruction).toBe('surface')
  })

  it('leaves open boxes and sinks as they are', () => {
    ['base_open', 'base_sink'].forEach(name => {
      const r = calculateCabinet(grooved(SURFACE_CABINETS[name]))
      expect(r.backGroove).toBeNull()
      expect(cutSizes(r)).toEqual(surfaceCutSizes[name])
      expect(buildMachining(grooved(SURFACE_CABINETS[name])).parts.flatMap(grooves)).toEqual([])
    })
  })
})

describe('back groove rule', () => {
  it('grooves the inner face of both sides and the bottom, full length, nothing else', () => {
    const { parts, errors } = buildMachining(grooved(base600))
    expect(errors).toEqual([])
    const p = byId(parts)
    expect(parts.filter(x => grooves(x).length).map(x => x.id).sort()).toEqual(['bottom', 'side-left', 'side-right'])
    ;['side-left', 'side-right', 'bottom'].forEach(id => {
      expect(grooves(p[id])).toEqual([{ type: 'GROOVE', face: 'TOP', x: 0, y: 537.5, x2: p[id].length, y2: 537.5, width: 9, depth: 8, rule: 'back_groove' }])
      // TOP is the inner face on all three.
      expect(p[id].visibleFace === 'TOP' || id.startsWith('side')).toBe(true)
    })
  })

  it('grooves the top panel\'s inner face too when there is one', () => {
    const p = byId(buildMachining(grooved({ width: 600, height: 720, depth: 350, cabinetType: 'wall', subtype: 'Single Door', doorStyle: 'Handle' })).parts)
    expect(grooves(p.top)).toHaveLength(1)
    // The top's TOP face is its underside, facing into the cabinet.
    expect(p.top.frame.zAxis).toEqual([0, 0, 1])
  })

  it('lines the grooves up across the box and seats the back in them', () => {
    const { parts } = buildMachining(grooved({ width: 600, height: 720, depth: 350, cabinetType: 'wall', subtype: 'Single Door', doorStyle: 'Handle' }))
    const p = byId(parts)
    const centreY = (part) => toCabinet(part, 0, grooves(part)[0].y, 0)[1]
    const ys = ['side-left', 'side-right', 'top', 'bottom'].map(id => centreY(p[id]))
    expect(new Set(ys)).toEqual(new Set([350 - 18 - 4.5]))
    // The back sits inside the groove, 1mm short of each groove bottom.
    const back = p.back.box
    expect([back.y0, back.y1]).toEqual([350 - 18 - 8, 350 - 18])
    expect([back.x0, back.x1]).toEqual([18 - 7, 600 - 18 + 7])
    expect([back.z0, back.z1]).toEqual([18 - 7, 720 - 18 + 7])
  })

  it('keeps every confirmat face hole on an edge hole with grooved backs', () => {
    const edge = (ps) => ps.flatMap(x => x.machining_ops.filter(o => o.type === 'EDGE_HOLE').map(o => toCabinet(x, o.x, o.y, x.thickness - o.z).join(',')))
    const face = (ps) => ps.flatMap(x => x.machining_ops.filter(o => o.rule === 'confirmat' && o.type === 'HOLE').map(o => toCabinet(x, o.x, o.y, 0).join(',')))
    Object.values(SURFACE_CABINETS).forEach(cab => {
      const { parts, errors } = buildMachining(grooved(cab))
      expect(errors).toEqual([])
      expect(face(parts).sort()).toEqual(edge(parts).sort())
    })
  })
})
