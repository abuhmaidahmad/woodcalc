import { MACHINING_CONFIG } from '../kitchen_planner/machining/config'
import { confirmatPositions } from '../kitchen_planner/machining/rules/confirmat'
import { hingePositions } from '../kitchen_planner/machining/rules/hinge'
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

export function partitionPositions(length, minEdge, fromRight) {
  const n = jointPositions(length, minEdge).length
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
  const minFaceGap = std.minConfirmatSpacing

  const wall = (y0, length, { partition = false, frontZ = D } = {}) => ({ ops: opList(), y0, length, frontZ, partition })

  const positionsFor = (w, face, length) => {
    if (!w.partition) return jointPositions(length, minEdge)
    const { positions, spacing } = partitionPositions(length, minEdge, face === 'BOTTOM')
    if (spacing < minFaceGap) warn('confirmatCrowded', { length: r2(length), spacing, min: minFaceGap })
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
    jointPositions(length, minEdge).forEach((pos) => {
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

  const pins = (w, face, shelfBottomAbs, { frontY, backY }, base) => {
    const shift = w.partition && face === 'BOTTOM' ? std.partitionStagger : 0
    const mid = snap(shelfBottomAbs - PIN.shelfPinOffset, base, faceGrid(w, face)) - w.y0
    ;[mid - PIN.pitch, mid, mid + PIN.pitch].forEach((x) => {
      [frontY + PIN.frontDistance + shift, backY - PIN.backDistance + shift].forEach((y) => {
        w.ops.add(hole({ face, x, y, diameter: PIN.diameter, depth: PIN.depth, rule: 'shelf_pin' }))
      })
    })
  }

  const HINGE = MACHINING_CONFIG.hinge
  const snap = (abs, base, offset = 0) => r2(base + offset + PIN.pitch * Math.round((abs - base - offset) / PIN.pitch))
  const gridShift = (v) => PIN.pitch * Math.round(v / PIN.pitch)

  const faceGrid = (w, face) => (w && w.partition && face === 'BOTTOM' ? PIN.pitch / 2 : 0)

  const hingeCentres = (doorH, doorBottom, base, shift = 0, gridOffset = 0) => {
    const lo = doorBottom + HINGE.cupDiameter
    const hi = doorBottom + doorH - HINGE.cupDiameter
    return hingePositions(doorH, HINGE).map((x) => {
      let c = snap(doorBottom + x + gridShift(shift), base, std.hingePlateSpacing / 2 + gridOffset)
      while (c > hi) c -= PIN.pitch
      while (c < lo) c += PIN.pitch
      return c
    })
  }

  const hingeCups = (ops, centres, doorBottom, doorW, side) => {
    const y = side === 'right' ? doorW - HINGE.edgeDistance : HINGE.edgeDistance
    centres.forEach((c) => ops.add(hole({ face: 'TOP', x: r2(c - doorBottom), y, diameter: HINGE.cupDiameter, depth: HINGE.cupDepth, rule: 'hinge' })))
  }

  const hingePlate = (w, face, absY) => {
    ;[-std.hingePlateSpacing / 2, std.hingePlateSpacing / 2].forEach((dx) => {
      w.ops.add(hole({ face, x: r2(absY - w.y0 + dx), y: r2(std.hingePlateFront), diameter: std.hingePlateDiameter, depth: std.hingePlateDepth, rule: 'hinge_plate' }))
    })
  }

  const runnerYs = (runnerLen) => {
    const ys = []
    for (let y = std.runnerHoleFront; y <= runnerLen - 10; y += std.runnerHolePitch) ys.push(y)
    return ys
  }

  const runnerHoles = (w, face, absY, startY, runnerLen, shift = 0) => {
    runnerYs(runnerLen).forEach((y) => {
      w.ops.add(hole({ face, x: r2(absY - w.y0), y: r2(startY + y + shift), diameter: std.runnerHoleDiameter, depth: std.runnerHoleDepth, rule: 'runner' }))
    })
  }

  const railSocket = (w, face, absY, centreY) => {
    const n = Math.max(1, Math.round(std.railSocketHoles))
    Array.from({ length: n }, (_, k) => centreY + (k - (n - 1) / 2) * std.railSocketSpacing).forEach((y) => {
      w.ops.add(hole({ face, x: r2(absY - w.y0), y: r2(y), diameter: std.railSocketDiameter, depth: std.railSocketDepth, rule: 'rail_socket' }))
    })
  }

  const railHoleGap = (railH, s) => {
    const ps = jointPositions(railH, minEdge)
    return r2(Math.min(...ps.flatMap((a) => ps.map((b) => Math.abs(s + b - a)))))
  }

  const connect = (a, b) => {
    const n = Math.max(0, Math.round(std.connectorsPerJoint))
    const rows = Math.ceil(n / 2)
    const L = a.length
    const xs = rows <= 1 ? [L / 2] : Array.from({ length: rows }, (_, k) => std.connectorEdge + ((L - 2 * std.connectorEdge) * k) / (rows - 1))
    const spots = xs.flatMap((x) => [[x, std.connectorInset], [x, D - std.connectorInset]]).slice(0, n)
    spots.forEach(([x, y]) => [a, b].forEach((w) => {
      w.ops.add(hole({ face: 'BOTTOM', x: r2(x), y: r2(y), diameter: std.connectorDiameter, depth: T, through: true, rule: 'carcass_connector' }))
    }))
    return spots.length
  }

  return { wall, join, railJoin, over, backGroove, pins, connect, snap, faceGrid, hingeCentres, hingeCups, hingePlate, runnerHoles, railSocket, railHoleGap, minFaceGap, grooveY, grooveW }
}

export function holeClashes(part) {
  const holes = part.machining_ops.filter((o) => o.type === 'HOLE')
  const out = []
  const reach = (o, face) => (o.through || o.face === face ? o.depth : 0)
  for (let i = 0; i < holes.length; i++) {
    for (let j = i + 1; j < holes.length; j++) {
      const a = holes[i]
      const b = holes[j]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (d >= (a.diameter + b.diameter) / 2) continue
      const same = d < 0.01 && a.diameter === b.diameter && a.face === b.face && a.depth === b.depth && a.through === b.through
      if (same) continue
      const sameFace = a.face === b.face || a.through || b.through
      const meet = reach(a, 'TOP') + reach(b, 'BOTTOM') > part.thickness - 0.01 || reach(a, 'BOTTOM') + reach(b, 'TOP') > part.thickness - 0.01
      if (sameFace || meet) out.push(`${part.id}: ${a.rule} hole at (${a.x}, ${a.y}) ${a.face} clashes with ${b.rule} hole at (${b.x}, ${b.y}) ${b.face}`)
    }
  }
  return out
}
