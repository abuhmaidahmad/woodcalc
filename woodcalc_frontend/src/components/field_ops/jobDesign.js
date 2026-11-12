import { calculateCabinet, cabinetConfig, isCarcassCabinet } from '../../features/kitchen_planner/formulaEngine'

const COUNTED = ['hinges', 'handles', 'tip_on', 'legs', 'cabinet_hangers', 'shelf_pins', 'confirmats', 'dowels', 'back_screws']
export const HARDWARE_KEYS = [...COUNTED, 'drawer_runner_sets']
export const HARDWARE_ENGINE_EXTRA_KEYS = ['drawer_system', 'runner_sizes', 'confirmat_spec', 'edge_banding_spec']

export function cleanHardware(items) {
  if (!Array.isArray(items)) return []
  return items
    .filter(item => item && HARDWARE_KEYS.includes(item.key) && Number.isFinite(Number(item.qty)) && Number(item.qty) > 0)
    .map(item => {
      const row = { key: item.key, qty: Math.round(Number(item.qty)) }
      if (typeof item.spec === 'string' && item.spec) row.spec = item.spec.slice(0, 100)
      return row
    })
}

export function hardwareList(cabinets = []) {
  const totals = {}
  const runners = {}
  cabinets.forEach(cab => {
    if (!isCarcassCabinet(cab)) return
    let hardware
    try {
      hardware = calculateCabinet(cabinetConfig(cab)).hardware || {}
    } catch {
      return
    }
    COUNTED.forEach(key => { totals[key] = (totals[key] || 0) + (Number(hardware[key]) || 0) })
    if (hardware.drawer_runner_sets) {
      const system = hardware.drawer_system || ''
      runners[system] = (runners[system] || 0) + hardware.drawer_runner_sets
    }
  })
  const items = COUNTED.filter(key => totals[key] > 0).map(key => ({ key, qty: totals[key] }))
  Object.entries(runners).forEach(([system, qty]) => items.push({ key: 'drawer_runner_sets', spec: system, qty }))
  return cleanHardware(items)
}

export function jobHardware(design) {
  if (Array.isArray(design?.hardwareSummary)) return cleanHardware(design.hardwareSummary)
  return hardwareList(design?.cabinets || [])
}

function alongWall(wall, x, y) {
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const lengthSq = dx * dx + dy * dy
  return lengthSq ? ((x - wall.x1) * dx + (y - wall.y1) * dy) / lengthSq : 0
}

const cabinetCenter = (c) => [Number(c.x || 0) + Number(c.width || 0) / 2, Number(c.y || 0) + Number(c.depth || 0) / 2]

export function groupByWall(design) {
  const walls = design?.walls || []
  const cabinets = design?.cabinets || []
  const elements = design?.elements || []
  const groups = walls.map(wall => {
    const order = (c) => alongWall(wall, ...cabinetCenter(c))
    return {
      wall,
      cabinets: cabinets.filter(c => c.wall === wall.index).sort((a, b) => order(a) - order(b)),
      elements: elements.filter(e => e.wall === wall.index),
    }
  }).filter(g => g.cabinets.length || g.elements.length)
  const free = cabinets.filter(c => c.wall === null || c.wall === undefined || !walls.some(w => w.index === c.wall))
  if (free.length) groups.push({ wall: null, cabinets: free, elements: [] })
  return groups
}
