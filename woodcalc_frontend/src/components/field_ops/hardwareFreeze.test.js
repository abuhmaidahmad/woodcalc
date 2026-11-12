import { describe, expect, it, vi } from 'vitest'
import { freezeJobHardware } from './hardwareFreeze'

const CABINETS = [{ category: 'base', subtype: 'Base', width: 600, height: 720, depth: 560, doorStyle: 'Handle', doorCount: 1 }]

function fakeApi({ get = { ok: true, data: { design: { cabinets: CABINETS } } }, update = { ok: true } } = {}) {
  return {
    getInstallation: vi.fn(async () => (get instanceof Error ? Promise.reject(get) : get)),
    updateInstallation: vi.fn(async () => update),
  }
}

describe('freezeJobHardware', () => {
  it('saves totals calculated from the job design copy', async () => {
    const api = fakeApi()
    expect(await freezeJobHardware(7, api)).toBe(true)
    const [id, payload] = api.updateInstallation.mock.calls[0]
    expect(id).toBe(7)
    expect(payload.hardware_summary.find(i => i.key === 'legs').qty).toBe(4)
  })

  it('reports failure when the job cannot be loaded', async () => {
    for (const get of [{ ok: false, data: null }, { ok: true, data: { design: null } }, new Error('offline')]) {
      const api = fakeApi({ get })
      expect(await freezeJobHardware(7, api)).toBe(false)
      expect(api.updateInstallation).not.toHaveBeenCalled()
    }
  })

  it('reports failure when saving the totals fails', async () => {
    expect(await freezeJobHardware(7, fakeApi({ update: { ok: false } }))).toBe(false)
  })
})
