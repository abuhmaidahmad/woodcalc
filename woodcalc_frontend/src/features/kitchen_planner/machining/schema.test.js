import { describe, it, expect } from 'vitest'
import { hole, edgeHole, groove, validateOp, validatePart, buildMachining, toCabinet, toPart, doorHingeSides } from './index'

const board = { id: 'test', length: 700, width: 560, thickness: 18, visibleFace: 'TOP', machining_ops: [] }

describe('machining op schema', () => {
  it('builds one valid op of each type', () => {
    const ops = [
      hole({ face: 'BOTTOM', x: 50, y: 9, diameter: 7, depth: 18, through: true, rule: 'confirmat' }),
      edgeHole({ face: 'LEFT', x: 0, y: 50, diameter: 5, depth: 45, rule: 'confirmat' }, 18),
      groove({ face: 'TOP', x: 0, y: 540, x2: 700, y2: 540, width: 4, depth: 8, rule: 'back_groove' }),
    ]
    expect(ops.map(o => o.type)).toEqual(['HOLE', 'EDGE_HOLE', 'GROOVE'])
    expect(ops[1].z).toBe(9) // defaults to half the thickness
    ops.forEach(op => expect(validateOp(op, board)).toEqual([]))
    expect(validatePart({ ...board, machining_ops: ops })).toEqual([])
  })

  it('rejects ops that break the schema', () => {
    expect(validateOp({ type: 'POCKET' })).toEqual(['unknown op type POCKET'])
    expect(validateOp(hole({ face: 'LEFT', x: 1, y: 1, diameter: 5, depth: 5 }))).toContain('HOLE face must be TOP or BOTTOM')
    expect(validateOp({ ...hole({ x: 1, y: 1, diameter: 5, depth: 5 }), through: undefined })).toContain('through must be a boolean')
    expect(validateOp(edgeHole({ face: 'TOP', x: 0, y: 1, z: 9, diameter: 5, depth: 5 }))[0]).toMatch(/EDGE_HOLE face/)
    expect(validateOp(groove({ x: 0, y: 0, x2: 1, y2: 0, width: 0, depth: 8 }))).toContain('width must be positive')
  })

  it('checks ops against the board they are on', () => {
    expect(validateOp(hole({ x: 800, y: 9, diameter: 5, depth: 12 }), board)[0]).toMatch(/off the part/)
    expect(validateOp(hole({ x: 50, y: 9, diameter: 7, depth: 18 }), board)[0]).toMatch(/set through/)
    expect(validateOp(hole({ x: 50, y: 9, diameter: 7, depth: 12, through: true }), board)[0]).toMatch(/through hole depth/)
    expect(validateOp(edgeHole({ face: 'RIGHT', x: 699, y: 50, diameter: 5, depth: 45 }, 18), board)[0]).toMatch(/not on the RIGHT edge/)
    expect(validateOp(edgeHole({ face: 'FRONT', x: 50, y: 0, z: 1, diameter: 5, depth: 45 }), board)[0]).toMatch(/breaks out/)
    expect(validateOp(groove({ x: 0, y: 540, x2: 700, y2: 540, width: 4, depth: 18 }), board)[0]).toMatch(/cuts through/)
  })
})

describe('machining parts', () => {
  const base600 = { width: 600, height: 720, depth: 560, cabinetType: 'base', subtype: 'Single Door', doorStyle: 'Handle', shelves: 1 }

  it('expands a base cabinet into individual parts with cut-list sizes', () => {
    const { parts, errors } = buildMachining(base600)
    expect(errors).toEqual([])
    const byId = Object.fromEntries(parts.map(p => [p.id, p]))
    expect(Object.keys(byId)).toEqual(expect.arrayContaining(['side-left', 'side-right', 'bottom', 'front-rail', 'back-rail', 'shelf-1', 'back', 'door-1']))
    expect([byId['side-left'].length, byId['side-left'].width]).toEqual([720, 560])
    expect([byId.bottom.length, byId.bottom.width]).toEqual([564, byId.bottom.width])
    expect(byId['side-left'].visibleFace).toBe('BOTTOM')
    expect(byId['door-1']).toMatchObject({ length: 717, width: 597, visibleFace: 'BOTTOM', hingeSide: 'left', hingeCount: 2 })
  })

  it('gives every placed part a right-handed frame whose TOP face is where the box says', () => {
    const { parts } = buildMachining(base600)
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
    parts.filter(p => p.frame).forEach(p => {
      const { xAxis, yAxis, zAxis } = p.frame
      expect(cross(xAxis, yAxis).map(v => -v + 0)).toEqual(zAxis.map(v => v + 0))
      // The part's far corner lands inside the box it was built from.
      const [x, y, z] = toCabinet(p, p.length, p.width, p.thickness)
      const b = p.box
      expect([x, y, z]).toEqual([
        expect.toBeOneOf([b.x0, b.x1]), expect.toBeOneOf([b.y0, b.y1]), expect.toBeOneOf([b.z0, b.z1])])
      expect(toPart(p, toCabinet(p, 12, 34, 5))).toEqual([12, 34, 5])
    })
  })

  it('makes the left and right sides mirror images: inner faces face each other', () => {
    const { parts } = buildMachining(base600)
    const l = parts.find(p => p.id === 'side-left'), r = parts.find(p => p.id === 'side-right')
    expect(toCabinet(l, 0, 0, 0)).toEqual([18, 0, 720]) // TOP is the inner face
    expect(toCabinet(r, 0, 0, 0)).toEqual([582, 0, 0])
    expect(toCabinet(l, 0, 0, 18)[0]).toBe(0) // BOTTOM is the outer face
    expect(toCabinet(r, 0, 0, 18)[0]).toBe(600)
  })

  it('hinges doors like the 3D view does', () => {
    const d = (w, h = 700) => ({ width: w, height: h })
    expect(doorHingeSides([d(597)], { width: 600 })).toEqual(['left'])
    expect(doorHingeSides([d(597)], { width: 600, hingeSide: 'right' })).toEqual(['right'])
    expect(doorHingeSides([d(397), d(397)], { width: 800 })).toEqual(['left', 'right'])
    expect(doorHingeSides([d(397, 770), d(397, 1417), d(397, 770), d(397, 1417)], { width: 800 })).toEqual(['left', 'left', 'right', 'right'])
    expect(doorHingeSides([d(347)], { width: 1000, subtype: 'Blind', blindSide: 'right' })).toEqual(['right'])
  })
})
