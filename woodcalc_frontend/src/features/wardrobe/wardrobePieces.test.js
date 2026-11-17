import { describe, it, expect } from 'vitest'
import { DEFAULT_WARDROBE_STANDARD as STD } from './wardrobeStandard'
import { computeWardrobe, defaultDesign } from './wardrobeEngine'
import { defaultCloset, computeDesign } from './closetEngine'
import { priceWardrobe } from './wardrobePricing'
import { buildWardrobePlannerData } from './wardrobeRoom'
import { piecesFromParts, wardrobePieces, workOrderItems, edgeBandingFor, materialFor } from './wardrobePieces'
import { roomPieces } from '../rooms/roomPieces'
import { piecesToGroups } from '../manufacturing/CuttingOptimizerModule'

const carcass = { sku: 'EG-W980', name: 'Egger White W980', board_thickness: 18 }

function roomFor(design, picked = {}) {
  const result = computeDesign(design, STD)
  const planner_data = JSON.parse(JSON.stringify(buildWardrobePlannerData({ design, std: STD, price: priceWardrobe(result, STD), result, picked })))
  return { id: 9, room_number: 2, room_type: 'wardrobe', planner_data }
}

describe('wardrobe pieces for work orders', () => {
  const design = { ...defaultDesign(STD), construction: 'shared' }
  const room = roomFor(design, { Carcass: carcass })
  const pieces = wardrobePieces({ order_number: 'WO12' }, room)
  const result = computeWardrobe(design, STD)

  it('makes one piece per part with a unique ID', () => {
    expect(pieces).toHaveLength(result.parts.reduce((a, p) => a + p.qty, 0))
    expect(new Set(pieces.map((p) => p.id)).size).toBe(pieces.length)
    expect(pieces.map((p) => p.id)).toEqual(expect.arrayContaining(['WO12-R2-00-SD1', 'WO12-R2-00-SD2', 'WO12-R2-00-P1', 'WO12-R2-00-LSD1', 'WO12-R2-S2-DF1']))
  })

  it('keeps sizes, kinds and the frozen catalog board', () => {
    const side = pieces.find((p) => p.id === 'WO12-R2-00-SD1')
    expect(side).toEqual(expect.objectContaining({ length: 2000, width: 600, thickness: 18, kind: 'carcass', sku: 'EG-W980', materialName: 'Egger White W980', grainLocked: false, part: null }))
    const spacer = pieces.find((p) => p.name === 'Drawer spacer')
    expect(spacer).toEqual(expect.objectContaining({ sku: null, materialName: 'Carcass 25mm' }))
    expect(pieces.find((p) => p.name === 'Door')).toEqual(expect.objectContaining({ kind: 'front', grainLocked: true }))
    expect(pieces.find((p) => p.name === 'Drawer bottom').kind).toBe('drawer')
  })

  it('maps edge banding to the kitchen sides', () => {
    expect(edgeBandingFor('F', 'W')).toEqual({ T: 'None', B: 'None', L: 'None', R: 'W' })
    expect(edgeBandingFor('F,B,L,R', 'O')).toEqual({ T: 'O', B: 'O', L: 'O', R: 'O' })
    expect(pieces.find((p) => p.name === 'Shelf').edgeBanding.R).toBe('Egger White W980')
    expect(materialFor('Front', 18, {})).toEqual({ sku: null, materialName: 'Front 18mm' })
  })

  it('lists the same pieces as work order lines', () => {
    const items = workOrderItems(pieces)
    expect(items.reduce((a, i) => a + i.quantity, 0)).toBe(pieces.length)
    expect(items.find((i) => i.description.startsWith('Partition 1964x600x18mm (Egger White W980)')).quantity).toBe(2)
  })

  it('groups pieces for the optimizer by board', () => {
    const groups = piecesToGroups(pieces, 'all')
    const w980 = groups.find((g) => g.sku === 'EG-W980')
    expect(w980.parts.length).toBe(pieces.filter((p) => p.sku === 'EG-W980').length)
    expect(groups.some((g) => !g.sku && g.thickness === '25')).toBe(true)
    expect(piecesToGroups(pieces, 'front').every((g) => g.parts.length > 0)).toBe(true)
  })

  it('gives closet pieces their run and island in the ID', () => {
    const closet = defaultCloset(STD)
    const d = { ...defaultDesign(STD), mode: 'closet', closet: { ...closet, island: { ...closet.island, enabled: true } } }
    const ps = wardrobePieces({ order_number: 'WO3' }, roomFor(d))
    expect(new Set(ps.map((p) => p.id)).size).toBe(ps.length)
    expect(ps.map((p) => p.id)).toEqual(expect.arrayContaining(['WO3-R2-A-SD1', 'WO3-R2-AS2-FX1', 'WO3-R2-I-IT1', 'WO3-R2-I1S1-DF1']))
    expect(ps.find((p) => p.id === 'WO3-R2-AS2-FX1').cabinet).toBe('A-S2')
  })

  it('sends wardrobe rooms to the wardrobe pieces and kitchen rooms to the cabinet pieces', () => {
    expect(roomPieces({ order_number: 'WO12' }, room)).toEqual(pieces)
    expect(roomPieces({ order_number: 'WO1' }, { room_type: 'kitchen', planner_data: { cabinets: [] } })).toEqual([])
    expect(piecesFromParts([])).toEqual([])
  })
})
