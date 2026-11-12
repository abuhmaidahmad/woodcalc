import { describe, it, expect } from 'vitest'
import { buildMachining, toCabinet } from './index'

const pins = (part) => part.machining_ops.filter(o => o.rule === 'shelf_pin')
const byId = (parts) => Object.fromEntries(parts.map(p => [p.id, p]))
const base600 = (extra = {}) => ({ width: 600, height: 720, depth: 560, cabinetType: 'base', subtype: 'Single Door', doorStyle: 'Handle', shelves: 1, ...extra })

describe('shelf pin rule', () => {
  it('drills 2 columns x 3 holes per shelf on the inner face of each side', () => {
    const { parts, errors } = buildMachining(base600({ backConstruction: 'groove' }))
    expect(errors).toEqual([])
    const p = byId(parts)
    ;['side-left', 'side-right'].forEach(id => {
      expect(pins(p[id])).toHaveLength(6)
      pins(p[id]).forEach(o => expect(o).toMatchObject({ type: 'HOLE', face: 'TOP', diameter: 5, depth: 12, through: false }))
    })
  })

  it('puts the columns 37 from the front and 37 in front of the groove', () => {
    const p = byId(buildMachining(base600({ backConstruction: 'groove' })).parts)
    // groove front wall at 560 - 18 - 9 = 533
    expect([...new Set(pins(p['side-right']).map(o => o.y))]).toEqual([37, 533 - 37])
    const surface = byId(buildMachining(base600()).parts)
    // surface back: its front face is at the bottom's depth, 522
    expect([...new Set(pins(surface['side-right']).map(o => o.y))]).toEqual([37, 522 - 37])
  })

  it('puts the middle hole 3mm under the shelf, 32 above and below, matched on both sides', () => {
    const { parts } = buildMachining(base600({ shelfHeights: [350] }))
    const p = byId(parts)
    const at = (side) => pins(side).map(o => toCabinet(side, o.x, o.y, 0))
    const zs = (side) => [...new Set(at(side).map(pt => pt[2]))].sort((a, b) => a - b)
    expect(zs(p['side-left'])).toEqual([315, 347, 379])
    expect(zs(p['side-right'])).toEqual([315, 347, 379])
    // Same holes, mirrored: only the x (which side) differs.
    const yz = (side) => at(side).map(pt => `${pt[1]},${pt[2]}`).sort()
    expect(yz(p['side-left'])).toEqual(yz(p['side-right']))
    expect(new Set(at(p['side-left']).map(pt => pt[0]))).toEqual(new Set([18]))
    expect(new Set(at(p['side-right']).map(pt => pt[0]))).toEqual(new Set([582]))
  })

  it('defaults the shelf height to the even spacing the 3D view draws', () => {
    const p = byId(buildMachining(base600()).parts)
    expect(p['shelf-1'].plannedHeight).toBe(18 + (720 - 36) / 2 - 9)
  })

  it('drills nothing without adjustable shelves', () => {
    const { parts } = buildMachining(base600({ shelves: 0 }))
    expect(parts.flatMap(pins)).toEqual([])
    expect(buildMachining(base600({ subtype: 'Open Shelf' })).parts.flatMap(pins)).toEqual([])
  })

  it('reads every value from the config', () => {
    const p = byId(buildMachining(base600({ shelfHeights: [350] }), { shelfPins: { pitch: 64, frontDistance: 50, shelfPinOffset: 0 } }).parts)
    expect(pins(p['side-right']).map(o => o.x).sort((a, b) => a - b)[0]).toBe(286)
    expect(pins(p['side-right']).map(o => o.y)).toContain(50)
  })
})

describe('shelf pin offset', () => {
  it('moves the middle hole with shelfPinOffset', () => {
    const z = (offset) => {
      const p = Object.fromEntries(buildMachining({ width: 600, height: 720, depth: 560, cabinetType: 'base', subtype: 'Single Door', doorStyle: 'Handle', shelves: 1, shelfHeights: [350] },
        offset == null ? {} : { shelfPins: { shelfPinOffset: offset } }).parts.map(x => [x.id, x]))
      const xs = p['side-right'].machining_ops.filter(o => o.rule === 'shelf_pin').map(o => o.x)
      return [...new Set(xs)].sort((a, b) => a - b)[1]
    }
    expect(z()).toBe(347)
    expect(z(0)).toBe(350)
    expect(z(5)).toBe(345)
  })
})
