import { describe, expect, it } from 'vitest'
import { buildLibrary } from '../../features/kitchen_planner/CabinetCatalog'
import { buildZonePresets, calculateCabinet, cabinetConfig, isCarcassCabinet } from '../../features/kitchen_planner/formulaEngine'
import { HARDWARE_ENGINE_EXTRA_KEYS, HARDWARE_KEYS, hardwareList } from './jobDesign'

const ALLOWED = new Set([...HARDWARE_KEYS, ...HARDWARE_ENGINE_EXTRA_KEYS])
const DOOR_STYLES = ['Handle', 'Gola', 'Push']
const DRAWER_SYSTEMS = [
  { drawerSystem: 'Local Bearing', drawerBoxConstruction: 'wood_box' },
  { drawerSystem: 'Tandem', drawerBoxConstruction: 'wood_box' },
  { drawerSystem: 'LEGRABOX', drawerBoxConstruction: 'metal_sided' },
]

function variants() {
  const out = []
  for (const baseHeight of [720, 800]) {
    const library = buildLibrary(baseHeight)
    for (const [group, items] of Object.entries(library).filter(([, v]) => Array.isArray(v))) {
      for (const item of items) {
        const cab = { category: item.category || group, baseHeight, ...item }
        if (!isCarcassCabinet(cab)) continue
        for (const doorStyle of DOOR_STYLES) {
          for (const drawers of DRAWER_SYSTEMS) {
            const base = { ...cab, doorStyle, ...drawers }
            out.push(base)
            if (['Drawers', '2Drw+Door'].includes(cab.subtype)) {
              buildZonePresets(cab.height).forEach(zonePreset => out.push({ ...base, zonePreset }))
            }
          }
        }
      }
    }
  }
  return out
}

describe('hardware names produced by calculateCabinet', () => {
  const cabinets = variants()

  it('covers a representative set of cabinet types', () => {
    const subtypes = new Set(cabinets.map(c => c.subtype))
    for (const s of ['Drawers', '2Drw+Door', 'Sink', 'Hob + Oven', 'Standard', 'Pantry', 'Oven Tower', 'L-Shape', 'Blind', 'Glass Door', 'Open Shelf', 'Appliance Niche']) {
      expect(subtypes, s).toContain(s)
    }
    expect(cabinets.length).toBeGreaterThan(300)
  })

  it('only produces hardware names on the allow-list', () => {
    const unknown = new Map()
    for (const cab of cabinets) {
      const { hardware } = calculateCabinet(cabinetConfig(cab))
      for (const key of Object.keys(hardware)) {
        if (!ALLOWED.has(key) && !unknown.has(key)) unknown.set(key, `${cab.category}/${cab.subtype} ${cab.width} ${cab.doorStyle}`)
      }
    }
    expect(Object.fromEntries(unknown)).toEqual({})
  })

  it('every shown hardware row uses a known name', () => {
    const rows = hardwareList(cabinets)
    expect(rows.length).toBeGreaterThan(5)
    rows.forEach(row => expect(HARDWARE_KEYS).toContain(row.key))
  })
})
