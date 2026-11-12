import { describe, expect, it } from 'vitest'
import { HARDWARE_KEYS, cleanHardware, groupByWall, hardwareList, jobHardware } from './jobDesign'
import { calculateCabinet, cabinetConfig } from '../../features/kitchen_planner/formulaEngine'

const walls = [
  { index: 0, label: 'Wall 1', x1: 0, y1: 0, x2: 4000, y2: 0 },
  { index: 1, label: 'Wall 2', x1: 0, y1: 0, x2: 0, y2: 3000 },
]

describe('groupByWall', () => {
  it('groups cabinets by wall in order along the wall and keeps free-standing ones last', () => {
    const design = {
      walls,
      cabinets: [
        { id: 'b', wall: 0, x: 2000, y: 0, width: 600, depth: 560 },
        { id: 'a', wall: 0, x: 0, y: 0, width: 600, depth: 560 },
        { id: 'island', wall: null, x: 1500, y: 1500, width: 1200, depth: 900 },
      ],
      elements: [{ id: 'water', wall: 0 }],
    }
    const groups = groupByWall(design)
    expect(groups.map(g => g.wall?.label ?? null)).toEqual(['Wall 1', null])
    expect(groups[0].cabinets.map(c => c.id)).toEqual(['a', 'b'])
    expect(groups[0].elements.map(e => e.id)).toEqual(['water'])
    expect(groups[1].cabinets.map(c => c.id)).toEqual(['island'])
  })
})

describe('hardwareList', () => {
  it('sums hardware for carcass cabinets and skips appliances', () => {
    const items = hardwareList([
      { category: 'base', subtype: 'Base', width: 600, height: 720, depth: 560, doorStyle: 'Handle', doorCount: 1 },
      { category: 'accessories', subtype: 'Freestanding Fridge', width: 600, height: 1800, depth: 650 },
    ])
    const qty = Object.fromEntries(items.map(i => [i.key, i.qty]))
    expect(qty.legs).toBe(4)
    expect(qty.hinges).toBeGreaterThan(0)
    expect(qty.handles).toBe(1)
  })

  it('returns an empty list when there are no cabinets', () => {
    expect(hardwareList([])).toEqual([])
  })
})

const PRICE_FIELDS = { price: 410, unitCost: 200, margin: 0.3, sinkPrice: 320, totalCost: 99, laborCost: 40 }
const ENGINE_INPUTS = [
  'width', 'height', 'depth', 'material', 'doorStyle', 'category', 'doorCount', 'subtype', 'zonePreset', 'drawerType',
  'drawerSystem', 'drawerBoxConstruction', 'baseHeight', 'openBoxMaterialSource', 'nicheLowerDoorH', 'nicheUpperDoorH',
  'shelfCount', 'glassShelfCount',
]
const CABINETS = [
  { category: 'base', subtype: 'Base', width: 800, height: 720, depth: 560, doorStyle: 'Handle', doorCount: 2, baseHeight: 800 },
  { category: 'base', subtype: 'Drawers', width: 600, height: 720, depth: 560, doorStyle: 'Gola', drawerSystem: 'LEGRABOX', drawerBoxConstruction: 'metal_sided' },
  { category: 'wall', subtype: 'Standard', width: 600, height: 720, depth: 320, doorStyle: 'Push', doorCount: 1 },
  { category: 'tall', subtype: 'Pantry', width: 600, height: 2220, depth: 560, doorStyle: 'Handle', shelfCount: 5 },
]
const only = (obj, keys) => Object.fromEntries(keys.filter(k => k in obj).map(k => [k, obj[k]]))
const PRICEY = /price|cost|margin|total|amount|vat|discount|payment/i

describe('calculateCabinet without price fields', () => {
  it('runs on cabinets that carry only the engine inputs', () => {
    CABINETS.forEach(cab => {
      const result = calculateCabinet(cabinetConfig(only(cab, ENGINE_INPUTS)))
      expect(result.hardware.legs).toBeGreaterThanOrEqual(0)
      expect(Object.keys(result.hardware).filter(k => PRICEY.test(k))).toEqual([])
    })
  })

  it('gives the same hardware whether or not price fields are present', () => {
    const priced = CABINETS.map(c => ({ ...c, ...PRICE_FIELDS }))
    const stripped = CABINETS.map(c => only(c, ENGINE_INPUTS))
    expect(hardwareList(stripped)).toEqual(hardwareList(priced))
    expect(hardwareList(stripped).length).toBeGreaterThan(3)
  })
})

describe('cleanHardware', () => {
  it('keeps only known hardware keys and drops any extra or cost fields', () => {
    const rows = cleanHardware([
      { key: 'hinges', qty: 4, cost: 123, price: 456, total: 789 },
      { key: 'unit_cost', qty: 99 },
      { key: 'price', qty: 5 },
      { key: 'drawer_runner_sets', qty: 2, spec: 'LEGRABOX', margin: 0.3 },
      { key: 'legs', qty: 'lots' },
      { key: 'legs', qty: 0 },
    ])
    expect(rows).toEqual([{ key: 'hinges', qty: 4 }, { key: 'drawer_runner_sets', qty: 2, spec: 'LEGRABOX' }])
    rows.forEach(row => expect(Object.keys(row).every(k => ['key', 'qty', 'spec'].includes(k))).toBe(true))
    expect(HARDWARE_KEYS.some(k => PRICEY.test(k))).toBe(false)
  })
})

describe('jobHardware', () => {
  it('uses the saved summary when the job has one', () => {
    const design = { hardwareSummary: [{ key: 'hinges', qty: 7, cost: 1 }], cabinets: CABINETS }
    expect(jobHardware(design)).toEqual([{ key: 'hinges', qty: 7 }])
  })

  it('uses an empty saved summary as is', () => {
    expect(jobHardware({ hardwareSummary: [], cabinets: CABINETS })).toEqual([])
  })

  it('recalculates from the cabinets when the summary is missing', () => {
    expect(jobHardware({ cabinets: CABINETS })).toEqual(hardwareList(CABINETS))
    expect(jobHardware({ hardwareSummary: null, cabinets: CABINETS })).toEqual(hardwareList(CABINETS))
  })
})
