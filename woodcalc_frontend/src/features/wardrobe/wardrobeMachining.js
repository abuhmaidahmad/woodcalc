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

export function staggered(positions, length, shift) {
  if (!shift) return positions
  const edge = 2 * MACHINING_CONFIG.confirmat.edgeDiameter
  const up = positions.map((p) => p + shift)
  if (up.every((p) => p <= length - edge)) return up.map(r2)
  const down = positions.map((p) => p - shift)
  if (down.every((p) => p >= edge)) return down.map(r2)
  return positions
}

export function createKit(std, D, T) {
  const C = MACHINING_CONFIG.confirmat
  const PIN = MACHINING_CONFIG.shelfPins
  const grooveW = std.backT + MACHINING_CONFIG.backGroove.widthClearance
  const grooveY = r2(D - std.grooveSetback - grooveW / 2)
  const other = (face) => (face === 'TOP' ? 'BOTTOM' : 'TOP')

  const wall = (y0, length, { partition = false } = {}) => ({ ops: opList(), y0, length, frontZ: D, partition })

  const shiftFor = (w, face) => (w.partition && face === 'BOTTOM' ? std.partitionStagger : 0)

  const join = (w, face, panelOps, end, { absY, frontZ, length, panelLength }) => {
    const ys = staggered(confirmatPositions(length, C), length, shiftFor(w, face))
    const x = end === 'LEFT' ? 0 : panelLength
    ys.forEach((pos) => {
      panelOps.add(edgeHole({ face: end, x, y: pos, z: T / 2, diameter: C.edgeDiameter, depth: C.edgeDepth, rule: 'confirmat' }, T))
      w.ops.add(hole({ face: other(face), x: absY - w.y0, y: (w.frontZ - frontZ) + pos, diameter: C.faceDiameter, depth: T, through: true, rule: 'confirmat' }))
    })
  }

  const railJoin = (w, face, railOps, end, { absY, length, panelLength }) => {
    const ys = staggered(confirmatPositions(length, C), length, shiftFor(w, face))
    const x = end === 'LEFT' ? 0 : panelLength
    ys.forEach((pos) => {
      railOps.add(edgeHole({ face: end, x, y: pos, z: T / 2, diameter: C.edgeDiameter, depth: C.edgeDepth, rule: 'confirmat' }, T))
      w.ops.add(hole({ face: other(face), x: absY - w.y0 + pos, y: w.frontZ - T / 2, diameter: C.faceDiameter, depth: T, through: true, rule: 'confirmat' }))
    })
  }

  const over = (panelOps, x, w, wallEnd, { length, z = T / 2 }) => {
    confirmatPositions(length, C).forEach((pos) => {
      panelOps.add(hole({ face: 'BOTTOM', x, y: pos, diameter: C.faceDiameter, depth: T, through: true, rule: 'confirmat' }))
      w.ops.add(edgeHole({ face: wallEnd, x: wallEnd === 'LEFT' ? 0 : w.length, y: pos, z, diameter: C.edgeDiameter, depth: C.edgeDepth, rule: 'confirmat' }, T))
    })
  }

  const backGroove = (ops, length, face = 'TOP') => {
    ops.add(groove({ face, x: 0, y: grooveY, x2: length, y2: grooveY, width: grooveW, depth: std.grooveDepth, rule: 'back_groove' }))
  }

  const pins = (w, face, shelfBottomAbs, { frontY, backY }) => {
    const shift = shiftFor(w, face)
    const mid = shelfBottomAbs - w.y0 - PIN.shelfPinOffset
    ;[mid - PIN.pitch, mid, mid + PIN.pitch].forEach((x) => {
      [frontY + PIN.frontDistance + shift, backY - PIN.backDistance + shift].forEach((y) => {
        w.ops.add(hole({ face, x, y, diameter: PIN.diameter, depth: PIN.depth, rule: 'shelf_pin' }))
      })
    })
  }

  return { wall, join, railJoin, over, backGroove, pins, grooveY, grooveW }
}
