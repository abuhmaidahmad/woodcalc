import { describe, expect, it, vi } from 'vitest'

vi.mock('../../features/kitchen_planner/formulaEngine', () => ({
  isCarcassCabinet: () => true,
  cabinetConfig: (c) => c,
  calculateCabinet: () => ({
    hardware: { hinges: 2, legs: 4, hinge_cost: 6.5, unit_price: 12, total_cost: 30, margin: 0.3 },
    cost: 99, price: 140,
  }),
}))

const { hardwareList } = await import('./jobDesign')

describe('hardwareList when the engine returns cost values', () => {
  it('never passes them on', () => {
    const items = hardwareList([{ id: 1 }, { id: 2 }])
    expect(items).toEqual([{ key: 'hinges', qty: 4 }, { key: 'legs', qty: 8 }])
    expect(JSON.stringify(items)).not.toMatch(/cost|price|margin|total|6\.5|12|30|99|140/)
  })
})
