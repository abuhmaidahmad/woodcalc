import { describe, it, expect } from 'vitest'
import { DEFAULT_WARDROBE_STANDARD as STD } from './wardrobeStandard'
import { defaultDesign, computeWardrobe } from './wardrobeEngine'
import { priceWardrobe } from './wardrobePricing'
import { piecesFromParts } from './wardrobePieces'
import { doorLayout, slidingStyle } from './slidingDoors'

const sliding = { ...defaultDesign(STD), doorType: 'sliding', loft: false, width: 2400 }
const parts = (r, name) => r.parts.filter((p) => p.name === name)
const qty = (r, name) => parts(r, name).reduce((a, p) => a + p.qty, 0)
const door = (r) => r.geometry.filter((g) => g.kind === 'slidingDoor')

describe('sliding door styles', () => {
  const plain = computeWardrobe(sliding, STD)
  const n = door(plain).length
  const { w: doorW, h: doorH } = door(plain)[0]
  const f = STD.slidingFrameDeduct

  it('keeps today\'s melamine doors when no style is set', () => {
    expect(JSON.stringify(computeWardrobe({ ...sliding, slidingDoors: { style: 'panel' } }, STD))).toBe(JSON.stringify(plain))
    expect(qty(plain, 'Sliding door')).toBe(n)
  })

  it('makes an aluminium frame with a full melamine insert', () => {
    const r = computeWardrobe({ ...sliding, slidingDoors: { style: 'framed' } }, STD)
    expect(qty(r, 'Sliding door')).toBe(0)
    expect(parts(r, 'Sliding door panel')).toEqual([expect.objectContaining({ L: Math.round((doorH - 2 * f) * 10) / 10, W: Math.round((doorW - 2 * f) * 10) / 10, T: STD.slidingInsertT, qty: n, material: 'Front', edges: '' })])
    const r1 = (x) => Math.round(x * 10) / 10
    expect(r.hardware.slidingFrameM).toBe(Array.from({ length: n }).reduce((a) => r1(a + (2 * doorH + 2 * doorW) / 1000), 0))
    expect(r.hardware.mirrorM2).toBeUndefined()
    expect(door(r)[0]).toMatchObject({ style: 'framed', frame: f, panels: [{ kind: 'wood' }] })
  })

  it('makes all-mirror doors priced per m²', () => {
    const r = computeWardrobe({ ...sliding, slidingDoors: { style: 'mirror' } }, STD)
    const mw = doorW - 2 * f
    const mh = doorH - 2 * f
    expect(qty(r, 'Mirror')).toBe(n)
    expect(r.hardware.mirrorM2).toBe(Math.round(((n * mw * mh) / 1e6) * 100) / 100)
    const line = priceWardrobe(r, STD).hardware.find((h) => h.key === 'mirrorM2')
    expect(line.unit).toBe(STD.priceMirrorM2)
    expect(piecesFromParts(r.rawParts).filter((p) => p.kind === 'mirror')).toHaveLength(n)
  })

  it('splits wood top and bottom with a mirror between two rails', () => {
    const sd = { style: 'split', topH: 500, bottomH: 300 }
    const l = doorLayout('split', 1000, 2200, sd, STD)
    const t = STD.slidingTransomH
    expect(l.panels).toEqual([
      { kind: 'wood', y: f, h: 300 },
      { kind: 'mirror', y: f + 300 + t, h: 2200 - 2 * f - 800 - 2 * t },
      { kind: 'wood', y: f + 300 + t + (2200 - 2 * f - 800 - 2 * t) + t, h: 500 },
    ])
    expect(l.transoms).toEqual([f + 300, f + 300 + t + (2200 - 2 * f - 800 - 2 * t)])
    expect(l.frameM).toBeCloseTo((2 * 2200 + 2 * 1000 + 2 * (1000 - 2 * f)) / 1000)
    const r = computeWardrobe({ ...sliding, slidingDoors: sd }, STD)
    expect(qty(r, 'Sliding door panel')).toBe(2 * n)
    expect(qty(r, 'Mirror')).toBe(n)
  })

  it('mixes styles door by door', () => {
    const sd = { style: 'framed', doors: ['mirror', null] }
    expect(slidingStyle({ slidingDoors: sd }, 0)).toBe('mirror')
    expect(slidingStyle({ slidingDoors: sd }, 1)).toBe('framed')
    const r = computeWardrobe({ ...sliding, slidingDoors: { doors: ['split'] } }, STD)
    expect(qty(r, 'Sliding door')).toBe(n - 1)
    expect(qty(r, 'Mirror')).toBe(1)
    expect(door(r).map((g) => g.style || 'panel')).toEqual(['split', ...Array(n - 1).fill('panel')])
  })

  it('warns when the wood panels leave no room for the mirror', () => {
    const r = computeWardrobe({ ...sliding, slidingDoors: { style: 'split', topH: 1200, bottomH: 1200 } }, STD)
    expect(r.warnings.map((w) => w.code)).toContain('slidingMirrorTooSmall')
  })
})
