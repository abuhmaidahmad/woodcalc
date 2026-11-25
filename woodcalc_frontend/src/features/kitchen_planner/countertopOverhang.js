export const CT_OVERHANG_DEFAULTS = { front: 40, back: 0, left: 20, right: 20 }

export const CT_OVERHANG_SIDES = ['front', 'back', 'left', 'right']

export function countertopOverhang(cab) {
  const o = (cab && cab.ctOverhang) || {}
  const pick = k => {
    const v = Number(o[k])
    return o[k] !== '' && o[k] != null && Number.isFinite(v) && v >= 0 ? v : CT_OVERHANG_DEFAULTS[k]
  }
  return { front: pick('front'), back: pick('back'), left: pick('left'), right: pick('right') }
}

export function countertopRunMm(cab) {
  const o = countertopOverhang(cab)
  const extraW = Math.max(0, o.left - CT_OVERHANG_DEFAULTS.left) + Math.max(0, o.right - CT_OVERHANG_DEFAULTS.right)
  const depth = Number(cab.depth) || 560
  const stdD = depth + CT_OVERHANG_DEFAULTS.front + CT_OVERHANG_DEFAULTS.back
  const factor = Math.max(1, (depth + o.front + o.back) / stdD)
  return (cab.width + extraW) * factor
}

export function hasCountertop(cab) {
  if (!cab) return false
  const st = cab.subtype
  const isBase = cab.category === 'base' || cab.category === 'vanity' || cab.category === 'corner' || st === 'Freestanding Dishwasher'
  const isShelf = st === 'Shelf' || st === 'Open Shelf' || st === 'Filler' || st === 'Panel' || st === 'Toe Kick'
  return (isBase && !isShelf) || (st === 'Filler' && cab.height === cab.baseHeight) || (st === 'Open Shelf' && isBase)
}

export function countertopFootprint(cab) {
  const o = countertopOverhang(cab)
  const W = Number(cab.width) || 0
  const D = Number(cab.depth) || 0
  const cx = (Number(cab.x) || 0) + W / 2
  const cy = (Number(cab.y) || 0) + D / 2
  const a = (Number(cab.rotation) || 0) * Math.PI / 180
  const c = Math.cos(a), s = Math.sin(a)
  const local = [[-o.left, -o.back], [W + o.right, -o.back], [W + o.right, D + o.front], [-o.left, D + o.front]]
  const pts = local.map(([lx, ly]) => {
    const dx = lx - W / 2, dy = ly - D / 2
    return [cx + dx * c - dy * s, cy + dx * s + dy * c]
  })
  return { pts, sides: [o.back, o.right, o.front, o.left] }
}

const EPS = 1e-6
const PROBE = 0.5

function pointInQuad(p, pts) {
  let sign = 0
  for (let k = 0; k < 4; k++) {
    const a = pts[k], b = pts[(k + 1) % 4]
    const cr = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
    if (Math.abs(cr) < EPS) return false
    const sg = cr > 0 ? 1 : -1
    if (sign === 0) sign = sg
    else if (sg !== sign) return false
  }
  return true
}

function splitParams(A, B, others) {
  const dx = B[0] - A[0], dy = B[1] - A[1]
  const len2 = dx * dx + dy * dy
  const ts = [0, 1]
  for (const q of others) {
    for (let k = 0; k < 4; k++) {
      const C = q[k], E = q[(k + 1) % 4]
      const ex = E[0] - C[0], ey = E[1] - C[1]
      const den = dx * ey - dy * ex
      if (Math.abs(den) > EPS) {
        const t = ((C[0] - A[0]) * ey - (C[1] - A[1]) * ex) / den
        const u = ((C[0] - A[0]) * dy - (C[1] - A[1]) * dx) / den
        if (t > EPS && t < 1 - EPS && u >= -EPS && u <= 1 + EPS) ts.push(t)
      } else {
        for (const V of [C, E]) {
          const cr = dx * (V[1] - A[1]) - dy * (V[0] - A[0])
          if (Math.abs(cr) / Math.sqrt(len2) < 1e-3) {
            const t = ((V[0] - A[0]) * dx + (V[1] - A[1]) * dy) / len2
            if (t > EPS && t < 1 - EPS) ts.push(t)
          }
        }
      }
    }
  }
  return [...new Set(ts.map(t => Math.round(t * 1e9) / 1e9))].sort((a, b) => a - b)
}

function mergeCollinear(segs) {
  const out = segs.map(s => [s[0].slice(), s[1].slice()])
  const close = (p, q) => Math.abs(p[0] - q[0]) < 1e-3 && Math.abs(p[1] - q[1]) < 1e-3
  const dir = s => {
    const dx = s[1][0] - s[0][0], dy = s[1][1] - s[0][1]
    const l = Math.hypot(dx, dy) || 1
    return [dx / l, dy / l]
  }
  let merged = true
  while (merged) {
    merged = false
    outer: for (let i = 0; i < out.length; i++) {
      for (let j = 0; j < out.length; j++) {
        if (i === j) continue
        if (!close(out[i][1], out[j][0])) continue
        const a = dir(out[i]), b = dir(out[j])
        if (Math.abs(a[0] * b[1] - a[1] * b[0]) > 1e-6 || a[0] * b[0] + a[1] * b[1] < 0) continue
        out[i][1] = out[j][1]
        out.splice(j, 1)
        merged = true
        break outer
      }
    }
  }
  return out
}

export function countertopOutline(cabs) {
  const fps = (cabs || []).filter(hasCountertop).map(countertopFootprint)
  const quads = fps.map(f => f.pts)
  const segs = []
  fps.forEach((fp, i) => {
    const others = quads.filter((_, j) => j !== i)
    const cx = fp.pts.reduce((s, p) => s + p[0], 0) / 4
    const cy = fp.pts.reduce((s, p) => s + p[1], 0) / 4
    for (let k = 0; k < 4; k++) {
      if (!(fp.sides[k] > 0)) continue
      const A = fp.pts[k], B = fp.pts[(k + 1) % 4]
      const dx = B[0] - A[0], dy = B[1] - A[1]
      const len = Math.hypot(dx, dy)
      if (len < EPS) continue
      let nx = -dy / len, ny = dx / len
      const mx0 = (A[0] + B[0]) / 2, my0 = (A[1] + B[1]) / 2
      if (nx * (mx0 - cx) + ny * (my0 - cy) < 0) { nx = -nx; ny = -ny }
      const ts = splitParams(A, B, others)
      for (let m = 0; m < ts.length - 1; m++) {
        const t0 = ts[m], t1 = ts[m + 1]
        if ((t1 - t0) * len < 0.01) continue
        const tm = (t0 + t1) / 2
        const M = [A[0] + dx * tm, A[1] + dy * tm]
        const out = [M[0] + nx * PROBE, M[1] + ny * PROBE]
        const inn = [M[0] - nx * PROBE, M[1] - ny * PROBE]
        if (quads.some(q => pointInQuad(out, q))) continue
        if (quads.some((q, j) => j < i && pointInQuad(inn, q))) {
          const shared = quads.some((q, j) => j < i && pointInQuad(inn, q) && !pointInQuad(M, q))
          if (shared) continue
        }
        segs.push([[A[0] + dx * t0, A[1] + dy * t0], [A[0] + dx * t1, A[1] + dy * t1]])
      }
    }
  })
  return mergeCollinear(segs)
}
