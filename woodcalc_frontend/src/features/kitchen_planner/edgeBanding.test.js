import { describe, it, expect } from 'vitest'
import { calculateCabinet, panelEdgeBanding, flatPieceEdgeBanding, edgeBandingByMaterialMm, flatPieceEdgeBandingByMaterialMm, shelfCountFor, APPLIANCE_NICHE } from './formulaEngine'

const banding = (cfg, name) => {
  const p = calculateCabinet(cfg).panels.find(p => p.name === name)
  return panelEdgeBanding(p, null, null, 'Carcass', 'Oak', cfg.doorStyle)
}
const wall = { width: 600, height: 700, depth: 300, cabinetType: 'wall' }

describe('edge banding', () => {
  it('bands a wall side front edge in front color and its top/bottom in carcass color, whatever the door style', () => {
    for (const doorStyle of ['Handle', 'Gola', 'Push']) {
      expect(banding({ ...wall, doorStyle }, 'Side panel')).toEqual({ T: 'Carcass', B: 'Carcass', L: 'None', R: 'Oak' })
    }
  })

  it('bands an open box wall side top/bottom in its box board', () => {
    expect(banding({ ...wall, subtype: 'Open Shelf' }, 'Side panel')).toEqual({ T: 'Carcass', B: 'Carcass', L: 'None', R: 'Carcass' })
  })

  it('keeps a base side banded on its front edge only', () => {
    expect(banding({ width: 600, height: 800, depth: 580, cabinetType: 'base', doorStyle: 'Handle' }, 'Side panel'))
      .toEqual({ T: 'None', B: 'None', L: 'None', R: 'Oak' })
  })

  it('bands a glass door cabinet carcass in carcass color', () => {
    const cfg = { ...wall, doorStyle: 'Handle', subtype: 'Glass Door' }
    expect(banding(cfg, 'Side panel').R).toBe('Carcass')
    expect(banding(cfg, 'Bottom panel').R).toBe('Carcass')
  })

  it('bands fillers, side panels and panels all round in the front material', () => {
    for (const subtype of ['Filler', 'Side Panel', 'Panel']) {
      expect(flatPieceEdgeBanding({ subtype }, 'Oak')).toEqual({ T: 'Oak', B: 'Oak', L: 'Oak', R: 'Oak' })
    }
    expect(flatPieceEdgeBanding({ subtype: 'Toe Kick' }, 'Oak')).toEqual({})
    expect(flatPieceEdgeBandingByMaterialMm({ subtype: 'Panel', width: 100, height: 720 }, 'Oak')).toEqual({ Oak: 2 * (720 + 100) })
  })

  it('splits banded length between the carcass and front materials', () => {
    const r = calculateCabinet({ ...wall, doorStyle: 'Handle', doorCount: 1 })
    const byMat = edgeBandingByMaterialMm(r, 'Handle', 'White', 'Oak')
    const door = r.doors[0]
    expect(Object.keys(byMat).sort()).toEqual(['Oak', 'White'])
    // Carcass: the sides' top/bottom edges, 2 sides x 2 x depth.
    expect(byMat.White).toBe(4 * 300)
    // Front: side front edges, top/bottom front edges, and the door all round.
    expect(byMat.Oak).toBe(2 * 700 + 2 * (600 - 36) + 2 * (door.width + door.height))
  })

  it('gives an appliance niche 3 shelves at 2400, one fewer per 300mm shorter', () => {
    const niche = (height) => ({ category: 'tall', subtype: APPLIANCE_NICHE, height, width: 600, depth: 580 })
    expect(shelfCountFor(niche(2400))).toBe(3)
    expect(shelfCountFor(niche(2100))).toBe(2)
  })
})
