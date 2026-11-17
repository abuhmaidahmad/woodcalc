import { MACHINING_CONFIG } from '../kitchen_planner/machining/config'
import { confirmatPositions } from '../kitchen_planner/machining/rules/confirmat'
import { hole, edgeHole, groove } from '../kitchen_planner/machining/schema'

const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100

export function opList() {
  const ops = []
  const keys = new Set()
  ops.add = (op) => {
    const key = JSON.stringify(op)
    if (keys.has(key)) return
    keys.add(key)
    ops.push(op)
  }
  return ops
}

export function jointPositions(length, minEdge) {
  const c = MACHINING_CONFIG.confirmat
  return confirmatPositions(length, {
    ...c,
    endDistance: Math.max(c.endDistance, minEdge),
    shortJointEndDistance: Math.max(c.shortJointEndDistance, minEdge),
  })
}

export function partitionPositions(length, shift, minEdge, fromRight) {
  const base = jointPositions(length, minEdge)
  const up = base.map((p) => p + shift)
  if (up.every((p) => p <= length - minEdge)) return { positions: (fromRight ? up : base).map(r2), spacing: shift }
  const n = base.length
  const step = (length - 2 * minEdge) / (2 * n - 1)
  const all = Array.from({ length: 2 * n }, (_, i) => r2(minEdge + i * step))
  return { positions: all.filter((_, i) => i % 2 === (fromRight ? 1 : 0)), spacing: r2(step) }
}

export function createKit(std, D, T, warn = () => {}) {
  const C = MACHINING_CONFIG.confirmat
  const PIN = MACHINING_CONFIG.shelfPins
  const minEdge = std.minConfirmatEdge
  const grooveW = std.backT + MACHINING_CONFIG.backGroove.widthClearance
  const grooveY = r2(D - std.grooveSetback - grooveW / 2)
  const other = (face) => (face === 'TOP' ? 'BOTTOM' : 'TOP')
  const minSpacing = C.faceDiameter + 3

  const wall = (y0, length, { partition = false } = {}) => ({ ops: opList(), y0, length, frontZ: D, partition })

  const positionsFor = (w, face, length) => {
    if (!w.partition) return jointPositions(length, minEdge)
    const { positions, spacing } = partitionPositions(length, std.partitionStagger, minEdge, face === 'BOTTOM')
    if (spacing < minSpacing) warn('confirmatCrowded', { length: r2(length), spacing, min: minSpacing })
    return positions
  }

  const join = (w, face, panelOps, end, { absY, frontZ, length, panelLength }) => {
    const x = end === 'LEFT' ? 0 : panelLength
    positionsFor(w, face, length).forEach((pos) => {
      panelOps.add(edgeHole({ face: end, x, y: pos, z: T / 2, diameter: C.edgeDiameter, depth: C.edgeDepth, rule: 'confirmat' }, T))
      w.ops.add(hole({ face: other(face), x: absY - w.y0, y: (w.frontZ - frontZ) + pos, diameter: C.faceDiameter, depth: T, through: true, rule: 'confirmat' }))
    })
  }

  const railJoin = (w, face, railOps, end, { absY, length, panelLength }) => {
    const x = end === 'LEFT' ? 0 : panelLength
    positionsFor(w, face, length).forEach((pos) => {
      railOps.add(edgeHole({ face: end, x, y: pos, z: T / 2, diameter: C.edgeDiameter, depth: C.edgeDepth, rule: 'confirmat' }, T))
      w.ops.add(hole({ face: other(face), x: absY - w.y0 + pos, y: w.frontZ - T / 2, diameter: C.faceDiameter, depth: T, through: true, rule: 'confirmat' }))
    })
  }

  const over = (panelOps, x, w, wallEnd, { length }) => {
    jointPositions(length, minEdge).forEach((pos) => {
      panelOps.add(hole({ face: 'BOTTOM', x, y: pos, diameter: C.faceDiameter, depth: T, through: true, rule: 'confirmat' }))
      w.ops.add(edgeHole({ face: wallEnd, x: wallEnd === 'LEFT' ? 0 : w.length, y: pos, z: T / 2, diameter: C.edgeDiameter, depth: C.edgeDepth, rule: 'confirmat' }, T))
    })
  }

  const backGroove = (ops, length, { face = 'TOP', shift = 0, x0 = 0, x1 = length } = {}) => {
    const y = r2(grooveY - shift)
    ops.add(groove({ face, x: r2(x0), y, x2: r2(x1), y2: y, width: grooveW, depth: std.grooveDepth, rule: 'back_groove' }))
  }

  const pins = (w, face, shelfBottomAbs, { frontY, backY }) => {
    const shift = w.partition && face === 'BOTTOM' ? std.partitionStagger : 0
    const mid = shelfBottomAbs - w.y0 - PIN.shelfPinOffset
    ;[mid - PIN.pitch, mid, mid + PIN.pitch].forEach((x) => {
      [frontY + PIN.frontDistance + shift, backY - PIN.backDistance + shift].forEach((y) => {
        w.ops.add(hole({ face, x, y, diameter: PIN.diameter, depth: PIN.depth, rule: 'shelf_pin' }))
      })
    })
  }

  return { wall, join, railJoin, over, backGroove, pins, grooveY, grooveW }
}
