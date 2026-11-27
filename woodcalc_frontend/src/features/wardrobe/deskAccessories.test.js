import { describe, it, expect } from 'vitest'
import { DEFAULT_WARDROBE_STANDARD as STD, normalizeStandard } from './wardrobeStandard'
import { defaultDesign, computeWardrobe } from './wardrobeEngine'
import { computeDesign } from './closetEngine'
import { priceWardrobe } from './wardrobePricing'
import { piecesFromParts, workOrderItems } from './wardrobePieces'
import { computeDesk, defaultDeskDesign } from './deskEngine'
import { addFreeUnit } from './unitOps'
import { outlineRoom } from './closetRoom'
import { contractRows } from './wardrobeRoom'

const base = defaultDesign(STD)
const qty = (r, name) => r.parts.filter((p) => p.name === name).reduce((a, p) => a + p.qty, 0)

describe('wardrobe accessories', () => {
  it('leaves designs without accessories exactly as they were', () => {
    expect(JSON.stringify(computeWardrobe({ ...base, accessories: {} }, STD))).toBe(JSON.stringify(computeWardrobe(base, STD)))
  })

  it('prices LED per metre, a sensor per door and mirrors per m²', () => {
    const d = { ...base, accessories: { led: true, ledRows: 2, doorSensors: true, mirrors: [{ w: 400, h: 1200 }, { w: 500, h: 1000 }] } }
    const r = computeWardrobe(d, STD)
    const plain = computeWardrobe(base, STD)
    expect(r.hardware.ledMeters).toBe(Math.round((plain.summary.carcassW / 1000) * 2 * 10) / 10)
    expect(r.hardware.doorSensor).toBe(plain.summary.doorCount)
    expect(r.hardware.mirrorM2).toBe(0.98)
    expect(qty(r, 'Mirror')).toBe(2)
    expect(r.materials).toEqual(plain.materials)
    const lines = priceWardrobe(r, STD).hardware
    expect(lines.find((h) => h.key === 'mirrorM2')).toMatchObject({ qty: 0.98, unit: STD.priceMirrorM2 })
    expect(lines.find((h) => h.key === 'ledMeters').unit).toBe(STD.priceLedM)
    expect(lines.find((h) => h.key === 'doorSensor').cost).toBe(plain.summary.doorCount * STD.priceDoorSensor)
    const pieces = piecesFromParts(r.rawParts)
    expect(pieces.filter((p) => p.kind === 'mirror').map((p) => [p.code, p.materialName])).toEqual([['MR1', 'Mirror 4mm'], ['MR2', 'Mirror 4mm']])
    expect(workOrderItems(pieces).some((i) => i.description.startsWith('Mirror 1200x400x4mm'))).toBe(true)
  })

  it('fills the new standard prices into older saved standards', () => {
    const old = { ...STD }
    delete old.priceLedM
    delete old.priceMirrorM2
    expect(normalizeStandard(old)).toMatchObject({ priceLedM: STD.priceLedM, priceMirrorM2: STD.priceMirrorM2, mirrorT: 4 })
  })
})

describe('dressing table', () => {
  const desk = defaultDeskDesign(STD)

  it('builds a top, end panels, a back panel and a drawer pedestal', () => {
    const r = computeDesk(desk, STD)
    const by = (name) => r.parts.find((p) => p.name === name)
    expect(by('Desk top')).toMatchObject({ L: 1200, W: 500, T: STD.frontT, qty: 1, material: 'Front' })
    expect(by('Desk end panel')).toMatchObject({ L: 750 - STD.frontT, W: 500, qty: 2, material: 'Front' })
    expect(by('Desk modesty panel')).toMatchObject({ L: 1200 - 2 * STD.frontT, W: STD.deskModestyH, material: 'Carcass' })
    expect(r.pedestal.design.width).toBe(450)
    expect(r.pedestal.x).toBe(1200 - STD.frontT - 450)
    expect(r.pedestal.result.parts.filter((p) => p.name === 'Drawer front').reduce((a, p) => a + p.qty, 0)).toBe(3)
    expect(r.knee).toBe(1200 - 2 * STD.frontT - 450)
    expect(r.warnings).toEqual([])
  })

  it('drops end panels that butt onto a closet and warns when the knee space is too narrow', () => {
    const r = computeDesk({ ...desk, width: 900, endRight: false }, STD)
    expect(r.parts.find((p) => p.name === 'Desk end panel').qty).toBe(1)
    expect(r.warnings.map((w) => w.code)).toEqual(['deskKneeNarrow'])
  })

  it('adds a mirror above the desk', () => {
    const r = computeDesk({ ...desk, mirror: { enabled: true, w: 800, h: 1000, elevation: 1000 } }, STD)
    expect(r.parts.find((p) => p.name === 'Mirror')).toMatchObject({ L: 1000, W: 800, T: 4 })
    expect(r.hardware.mirrorM2).toBe(0.8)
    expect(r.geometry.find((g) => g.kind === 'mirror')).toMatchObject({ y: 1000, w: 800, h: 1000 })
  })

  it('is placed and priced like the other closets', () => {
    const room = outlineRoom({ width: 3000, roomDepth: 2600 })
    const closet = addFreeUnit({ height: 2400, units: [], room }, room, 'desk', STD)
    const design = { ...base, mode: 'closet', closet: { ...closet, units: [{ ...closet.units[0], design: { ...closet.units[0].design, mirror: { enabled: true, w: 800, h: 1000, elevation: 1000 } } }] } }
    const r = computeDesign(design, STD)
    expect(r.units[0].kind).toBe('desk')
    expect(qty(r, 'Desk top')).toBe(1)
    expect(r.parts.find((p) => p.name === 'Desk top').sections).toEqual(['U1'])
    expect(r.hardware.mirrorM2).toBe(0.8)
    expect(r.hardware.runnerPair).toBe(3)
    expect(priceWardrobe(r, STD).grandTotal).toBeGreaterThan(0)
    const rows = contractRows(design, r, [], (k, p) => (p ? `${k}:${JSON.stringify(p)}` : k), 'White')
    expect(rows[0]).toMatchObject({ id: 'U1', width: 1200, depth: 500, height: 750 })
  })
})
