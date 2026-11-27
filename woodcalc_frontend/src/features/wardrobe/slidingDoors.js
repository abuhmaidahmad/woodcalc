export const SLIDING_STYLES = ['panel', 'framed', 'split', 'mirror']

const num = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
const r1 = (n) => Math.round(n * 10) / 10

export function slidingStyle(design, k) {
  const sd = design.slidingDoors || {}
  const own = Array.isArray(sd.doors) ? sd.doors[k] : null
  const style = own || sd.style
  return SLIDING_STYLES.includes(style) ? style : 'panel'
}

export function doorLayout(style, doorW, doorH, sd, std) {
  if (style === 'panel') return { framed: false, panels: [], frameM: 0, insertW: doorW, transoms: [] }
  const f = num(std.slidingFrameDeduct)
  const t = num(std.slidingTransomH)
  const insertW = r1(doorW - 2 * f)
  const insertH = doorH - 2 * f
  const frameM = (2 * doorH + 2 * doorW) / 1000
  if (style !== 'split') {
    return { framed: true, panels: [{ kind: style === 'mirror' ? 'mirror' : 'wood', y: f, h: r1(insertH) }], frameM, insertW, transoms: [] }
  }
  const bottom = Math.max(0, num(sd?.bottomH, 400))
  const top = Math.max(0, num(sd?.topH, 400))
  const rails = (bottom > 0 ? 1 : 0) + (top > 0 ? 1 : 0)
  const mid = r1(insertH - bottom - top - rails * t)
  const panels = []
  const transoms = []
  let y = f
  if (bottom > 0) {
    panels.push({ kind: 'wood', y: r1(y), h: r1(bottom) })
    y += bottom
    transoms.push(r1(y))
    y += t
  }
  panels.push({ kind: 'mirror', y: r1(y), h: mid })
  y += mid
  if (top > 0) {
    transoms.push(r1(y))
    y += t
    panels.push({ kind: 'wood', y: r1(y), h: r1(top) })
  }
  return { framed: true, panels, frameM: frameM + (transoms.length * insertW) / 1000, insertW, transoms, mid }
}
