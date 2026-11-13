import { describe, it, expect } from 'vitest'
import { buildMachining, hingePositions, MACHINING_CONFIG } from './index'
import { getHingeCount } from '../formulaEngine'

const cups = (part) => part.machining_ops.filter(o => o.rule === 'hinge')
const base = (extra = {}) => ({ width: 600, height: 720, depth: 560, cabinetType: 'base', subtype: 'Single Door', doorStyle: 'Handle', ...extra })

describe('hinge rule', () => {
  it('drills 35mm x 13mm cups on the back face, 22.5mm from the hinge edge, 100mm from the ends', () => {
    const { parts, errors } = buildMachining(base())
    expect(errors).toEqual([])
    const door = parts.find(p => p.id === 'door-1')
    expect(cups(door)).toEqual([
      { type: 'HOLE', face: 'TOP', x: 100, y: 22.5, diameter: 35, depth: 13, through: false, rule: 'hinge' },
      { type: 'HOLE', face: 'TOP', x: 617, y: 22.5, diameter: 35, depth: 13, through: false, rule: 'hinge' },
    ])
  })

  it('puts a right-hinged door\'s cups by its right edge', () => {
    const door = buildMachining(base({ hingeSide: 'right' })).parts.find(p => p.id === 'door-1')
    expect(cups(door).map(o => o.y)).toEqual([574.5, 574.5])
  })

  it('opens two side-by-side doors from the middle', () => {
    const { parts } = buildMachining(base({ width: 800, doorCount: 2 }))
    const [l, r] = ['door-1', 'door-2'].map(id => parts.find(p => p.id === id))
    expect(cups(l).map(o => o.y)).toEqual([22.5, 22.5])
    expect(cups(r).map(o => o.y)).toEqual([r.width - 22.5, r.width - 22.5])
  })

  it('takes the count from getHingeCount and spaces extra hinges evenly', () => {
    const { parts, errors } = buildMachining({ width: 600, height: 2100, depth: 560, cabinetType: 'tall', subtype: 'Pantry', doorStyle: 'Handle', doorCount: 1 })
    expect(errors).toEqual([])
    const door = parts.find(p => p.id === 'door-1')
    expect(cups(door)).toHaveLength(getHingeCount(door.length))
    expect(cups(door).map(o => o.x)).toEqual([100, 574.25, 1048.5, 1522.75, 1997]) // 2097 tall: 5 hinges
    expect(hingePositions(2500, MACHINING_CONFIG.hinge)).toEqual([100, 675, 1250, 1825, 2400])
  })

  it('reads every dimension from the config', () => {
    const door = buildMachining(base(), { hinge: { cupDiameter: 26, edgeDistance: 20 } }).parts.find(p => p.id === 'door-1')
    expect(cups(door)[0]).toMatchObject({ diameter: 26, depth: 13, y: 20, x: 100 })
  })

  it('leaves bought-in glass doors alone', () => {
    const { parts } = buildMachining(base({ subtype: 'Glass Door' }))
    expect(parts.filter(p => p.source === 'Door')).toEqual([])
  })
})
