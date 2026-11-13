// Acceptance: a 600-wide base cabinet with one adjustable shelf, grooved back.
// With MACHINING_DXF_OUT=<dir> it also writes one DXF per part there.
import { describe, it, expect } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildMachining, toCabinet, partToDxf, formatOp } from './index'

const cabinet = { width: 600, height: 720, depth: 560, cabinetType: 'base', subtype: 'Single Door', doorStyle: 'Handle', shelves: 1, backConstruction: 'groove' }
const { parts, errors, result } = buildMachining(cabinet)
const p = Object.fromEntries(parts.map(x => [x.id, x]))
const ops = (part, rule, type) => part.machining_ops.filter(o => o.rule === rule && (!type || o.type === type))

describe('600 base cabinet, one adjustable shelf, grooved back', () => {
  it('validates every op against its part', () => {
    expect(errors).toEqual([])
  })

  it('has an edge hole behind every confirmat face hole, and no spare edge holes', () => {
    const face = parts.flatMap(x => ops(x, 'confirmat', 'HOLE').map(o => toCabinet(x, o.x, o.y, 0).join(',')))
    const edge = parts.flatMap(x => ops(x, 'confirmat', 'EDGE_HOLE').map(o => toCabinet(x, o.x, o.y, x.thickness - o.z).join(',')))
    // bottom 3 + front rail 2 + back rail 2, on each side
    expect(face).toHaveLength(14)
    expect(face.sort()).toEqual(edge.sort())
  })

  it('grooves the inner faces of the sides and bottom only (no top: rails)', () => {
    const grooved = parts.filter(x => ops(x, 'back_groove').length).map(x => x.id).sort()
    expect(grooved).toEqual(['bottom', 'side-left', 'side-right'])
    grooved.forEach(id => {
      const g = ops(p[id], 'back_groove')[0]
      expect(g).toMatchObject({ face: 'TOP', x: 0, x2: p[id].length, width: 9, depth: 8 })
      // TOP faces into the cabinet: a step down into the board moves towards the middle.
      const inward = toCabinet(p[id], 0, 0, 1).map((v, k) => v - toCabinet(p[id], 0, 0, 0)[k])
      const toMiddle = [300, 280, 360].map((v, k) => v - toCabinet(p[id], 0, 0, 0)[k])
      expect(inward.reduce((s, v, k) => s + v * toMiddle[k], 0)).toBeLessThan(0)
    })
  })

  it('sizes the back to the grooves: inner width + 2 x (8 - 1), bottom groove to the top edge', () => {
    const back = result.panels.find(x => x.name === 'Back panel (HDF)')
    expect([back.width, back.depth]).toEqual([564 + 14, 720 - 18 + 7])
  })

  it('drills 6 shelf pin holes per side (2 columns x 3) for the one shelf', () => {
    expect(ops(p['side-left'], 'shelf_pin')).toHaveLength(6)
    expect(ops(p['side-right'], 'shelf_pin')).toHaveLength(6)
  })

  it('hinges the door', () => {
    expect(ops(p['door-1'], 'hinge')).toHaveLength(2)
  })

  it('exports a DXF per part with one layer per tool', () => {
    const dxf = partToDxf(p['side-left'])
    expect(dxf.startsWith('999\n')).toBe(true)
    expect(dxf.trimEnd().endsWith('0\nEOF')).toBe(true)
    ;['OUTLINE', 'HOLE_BOTTOM_D7_THRU', 'HOLE_TOP_D5_Z12', 'GROOVE_TOP_W9_Z8'].forEach(l => expect(dxf).toContain(`\n8\n${l}\n`))
    expect(partToDxf(p.bottom)).toContain('\n8\nEDGE_HOLE_LEFT_D5_Z45_H9\n')
    expect(partToDxf(p['door-1'])).toContain('\n8\nHOLE_TOP_D35_Z13\n')
    expect(dxf.match(/\nCIRCLE\n/g)).toHaveLength(7 + 6)
    expect(formatOp(ops(p['side-left'], 'confirmat')[0])).toMatch(/^Hole Ø7 through at \(\d/)
    expect(formatOp('legacy text op')).toBe('legacy text op')

    const out = process.env.MACHINING_DXF_OUT
    if (out) {
      mkdirSync(out, { recursive: true })
      parts.filter(x => x.machining_ops.length).forEach(x => writeFileSync(join(out, `base600_${x.id}.dxf`), partToDxf(x)))
      writeFileSync(join(out, 'base600_parts.json'), JSON.stringify(parts.map(({ id, source, length, width, thickness, visibleFace, machining_ops }) => ({ id, source, length, width, thickness, visibleFace, machining_ops })), null, 2))
    }
  })
})
