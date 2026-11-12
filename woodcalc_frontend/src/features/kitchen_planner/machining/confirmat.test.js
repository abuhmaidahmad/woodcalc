import { describe, it, expect } from 'vitest'
import { buildMachining, confirmatPositions, toCabinet, MACHINING_CONFIG } from './index'

const C = MACHINING_CONFIG.confirmat
const ops = (part, type) => part.machining_ops.filter(o => o.rule === 'confirmat' && o.type === type)
const byId = (parts) => Object.fromEntries(parts.map(p => [p.id, p]))
const base = (extra = {}) => ({ width: 600, height: 720, depth: 560, cabinetType: 'base', subtype: 'Single Door', doorStyle: 'Handle', ...extra })

// Each hole's axis in cabinet space: an edge hole's entry point (z is measured
// from the BOTTOM face, frames from TOP), a side face hole's point on the side's
// inner face (it runs right through).
const edgeAxes = (parts) => parts.flatMap(p => ops(p, 'EDGE_HOLE').map(o => toCabinet(p, o.x, o.y, p.thickness - o.z).join(',')))
const faceAxes = (parts) => parts.flatMap(p => ops(p, 'HOLE').map(o => toCabinet(p, o.x, o.y, 0).join(',')))

describe('confirmat positions', () => {
  it('puts screws 50 from each end, a middle one over 400, never more than 250 apart', () => {
    expect(confirmatPositions(300, C)).toEqual([50, 250])
    expect(confirmatPositions(350, C)).toEqual([50, 300])
    expect(confirmatPositions(522, C)).toEqual([50, 261, 472])
    expect(confirmatPositions(900, C)).toEqual([50, 250, 450, 650, 850])
  })

  it('lets the 250 spacing add a middle screw to a 351-400 joint too', () => {
    expect(confirmatPositions(400, C)).toEqual([50, 200, 350])
  })

  it('puts one screw in the middle of a joint too short for two', () => {
    expect(confirmatPositions(100, C)).toEqual([50])
  })
})

describe('confirmat rule', () => {
  it('drills 7mm through-holes in the sides and 5x45 edge holes in every mating panel', () => {
    const { parts, errors } = buildMachining(base())
    expect(errors).toEqual([])
    const p = byId(parts)
    const bottomEdge = ops(p.bottom, 'EDGE_HOLE')
    expect(bottomEdge).toHaveLength(6) // 3 per end on a 522-deep bottom
    expect(bottomEdge[0]).toEqual({ type: 'EDGE_HOLE', face: 'LEFT', x: 0, y: 50, z: 9, diameter: 5, depth: 45, rule: 'confirmat' })
    expect(bottomEdge.filter(o => o.face === 'RIGHT').every(o => o.x === p.bottom.length)).toBe(true)
    ;['front-rail', 'back-rail'].forEach(id => expect(ops(p[id], 'EDGE_HOLE')).toHaveLength(2))
    const face = ops(p['side-left'], 'HOLE')
    expect(face).toHaveLength(5) // bottom 3 + front rail 1 + back rail 1
    face.forEach(o => expect(o).toMatchObject({ face: 'BOTTOM', diameter: 7, depth: 18, through: true }))
  })

  it('centres the side holes on the mating panel thickness', () => {
    const { parts } = buildMachining(base())
    const p = byId(parts)
    // Right side: X runs up from the cabinet bottom, so the bottom panel's
    // screws sit at x = 9 and the rails' at 720 - 9.
    expect(ops(p['side-right'], 'HOLE').map(o => o.x).sort((a, b) => a - b)).toEqual([9, 9, 9, 711, 711])
    // Left side: X runs down from the cabinet top.
    expect(ops(p['side-left'], 'HOLE').map(o => o.x).sort((a, b) => a - b)).toEqual([9, 9, 711, 711, 711])
  })

  it('lines every face hole up with an edge hole, on every carcass type', () => {
    [
      base(),
      base({ width: 900, doorCount: 2, depth: 600 }),
      { width: 600, height: 720, depth: 350, cabinetType: 'wall', subtype: 'Single Door', doorStyle: 'Handle' },
      { width: 600, height: 2100, depth: 560, cabinetType: 'tall', subtype: 'Pantry', doorStyle: 'Handle', doorCount: 2, baseHeight: 800 },
      base({ subtype: 'Sink' }),
      base({ subtype: 'Open Shelf' }),
    ].forEach(cab => {
      const { parts, errors } = buildMachining(cab)
      expect(errors).toEqual([])
      const edges = edgeAxes(parts), faces = faceAxes(parts)
      expect(faces.length).toBeGreaterThan(0)
      expect(faces.sort()).toEqual(edges.sort())
    })
  })

  it('covers the top, the fixed panel and a sink rail', () => {
    const tall = byId(buildMachining({ width: 600, height: 2100, depth: 560, cabinetType: 'tall', subtype: 'Pantry', doorStyle: 'Handle', doorCount: 2 }).parts)
    expect(ops(tall.top, 'EDGE_HOLE')).toHaveLength(6)
    expect(ops(tall['fixed-panel'], 'EDGE_HOLE')).toHaveLength(6)
    expect(ops(tall['side-left'], 'HOLE')).toHaveLength(9)
    const sink = byId(buildMachining(base({ subtype: 'Sink' })).parts)
    expect(ops(sink['bottom-rail'], 'EDGE_HOLE')).toHaveLength(2)
  })

  it('skips face holes on an exposed side but keeps the other side\'s', () => {
    const { parts } = buildMachining(base({ exposedSides: { left: true } }))
    const p = byId(parts)
    expect(ops(p['side-left'], 'HOLE')).toEqual([])
    expect(ops(p['side-right'], 'HOLE')).toHaveLength(5)
    expect(ops(p.bottom, 'EDGE_HOLE')).toHaveLength(6)
    const off = byId(buildMachining(base({ exposedSides: { left: true } }), { confirmat: { skipFaceHolesOnExposedSides: false } }).parts)
    expect(ops(off['side-left'], 'HOLE')).toHaveLength(5)
  })
})
