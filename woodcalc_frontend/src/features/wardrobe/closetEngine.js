import { computeWardrobe, withSectionCount, mergeParts, summarizeParts, PART_NAMES_AR } from './wardrobeEngine'

export const CLOSET_SHAPES = ['straight', 'L', 'U']
export const CORNER_RULES = ['empty', 'back', 'side']
export const WALL_IDS = ['B', 'A', 'C']
const SHAPE_WALLS = { straight: ['A'], L: ['B', 'A'], U: ['B', 'A', 'C'] }

const r1 = (n) => Math.round(n * 10) / 10
const num = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function closetWalls(closet) {
  return SHAPE_WALLS[closet.shape] || SHAPE_WALLS.straight
}

export function runSectionCount(length, std) {
  const bySpan = Math.ceil(length / (num(std.maxShelfSpan) + 2 * num(std.carcassT)))
  return Math.max(1, Math.ceil(length / num(std.maxSectionW, 1000)), bySpan)
}

const RUN_CYCLES = {
  A: ['longHang', 'shelvesDrawers', 'doubleHang', 'shelves'],
  B: ['doubleHang', 'shelves'],
  C: ['shelves', 'longHang'],
}

export function newRun(wallId, overrides = {}) {
  return {
    depth: wallId === 'A' ? 600 : 580,
    construction: 'shared',
    backType: 'none',
    doorType: 'none',
    loft: false,
    loftH: 400,
    topFiller: 0,
    endGap: 0,
    sections: [],
    ...overrides,
  }
}

export function defaultCloset(std) {
  const closet = {
    shape: 'U',
    width: 3000,
    roomDepth: 2600,
    height: 2400,
    corners: { AB: 'back', AC: 'back' },
    runs: { A: newRun('A'), B: newRun('B'), C: newRun('C') },
    island: { enabled: false, width: 1200, depth: 600, height: 900, bays: 2, drawers: 3, doubleSided: true, construction: 'shared', drawerStyle: 'external', dx: 0, dy: 0 },
  }
  const layout = closetLayout(closet, std)
  WALL_IDS.forEach((id) => {
    const len = layout.runs[id]?.length || 0
    const d = { ...closet.runs[id], width: len }
    closet.runs[id] = { ...closet.runs[id], sections: withSectionCount(d, runSectionCount(len, std), std, RUN_CYCLES[id]).sections }
  })
  return closet
}

export function wallFrames(closet) {
  const W = num(closet.width)
  const D = num(closet.roomDepth)
  return {
    A: { length: W, origin: [0, 0], u: [1, 0], n: [0, 1] },
    B: { length: D, origin: [0, D], u: [0, -1], n: [1, 0] },
    C: { length: D, origin: [W, 0], u: [0, 1], n: [-1, 0] },
  }
}

export function closetLayout(closet, std) {
  const walls = closetWalls(closet)
  const frames = wallFrames(closet)
  const has = (id) => walls.includes(id)
  const depthOf = (id) => (has(id) ? num(closet.runs?.[id]?.depth) : 0)
  const gap = num(std.closetCornerGap)
  const offsets = { A: { start: 0, end: 0 }, B: { start: 0, end: 0 }, C: { start: 0, end: 0 } }
  const warnings = []
  const corner = (key, side, sideEnd, backEnd) => {
    if (!has(side) || !has('A')) return
    const rule = CORNER_RULES.includes(closet.corners?.[key]) ? closet.corners[key] : 'back'
    if (rule === 'back') offsets[side][sideEnd] = depthOf('A') + gap
    else if (rule === 'side') offsets.A[backEnd] = depthOf(side) + gap
    else {
      offsets[side][sideEnd] = depthOf('A')
      offsets.A[backEnd] = depthOf(side)
    }
  }
  corner('AB', 'B', 'end', 'start')
  corner('AC', 'C', 'start', 'end')
  if (has('B')) offsets.B.start += num(closet.runs.B.endGap)
  if (has('C')) offsets.C.end += num(closet.runs.C.endGap)

  const runs = {}
  walls.forEach((id) => {
    const f = frames[id]
    const { start, end } = offsets[id]
    const length = r1(f.length - start - end)
    const origin = [f.origin[0] + f.u[0] * start, f.origin[1] + f.u[1] * start]
    const angle = Math.atan2(-f.u[1], f.u[0])
    runs[id] = { id, start: r1(start), end: r1(end), length, origin, u: f.u, n: f.n, angle, depth: depthOf(id) }
    if (length < std.minSectionW) warnings.push({ code: 'runTooShort', level: 'error', params: { run: id, length } })
  })

  const W = num(closet.width)
  const D = num(closet.roomDepth)
  if (has('B') && has('C')) {
    const walk = r1(W - depthOf('B') - depthOf('C'))
    if (walk < std.minWalkway) warnings.push({ code: 'walkwayNarrow', level: walk < 0 ? 'error' : 'warn', params: { between: 'B–C', w: walk, min: std.minWalkway } })
  }
  if (has('A')) {
    const walk = r1(D - depthOf('A'))
    if (walk < std.minWalkway) warnings.push({ code: 'walkwayNarrow', level: walk < 0 ? 'error' : 'warn', params: { between: 'A', w: walk, min: std.minWalkway } })
  }

  let island = null
  const isl = closet.island
  if (isl?.enabled) {
    const iw = num(isl.width)
    const id = num(isl.depth)
    const left = depthOf('B')
    const right = W - depthOf('C')
    const top = depthOf('A')
    const cx = (left + right) / 2 + num(isl.dx)
    const cy = (top + D) / 2 + num(isl.dy)
    island = { x: r1(cx - iw / 2), y: r1(cy - id / 2), w: iw, d: id }
    const clear = {
      A: r1(island.y - top),
      B: r1(island.x - left),
      C: r1(right - island.x - iw),
      entrance: r1(D - island.y - id),
    }
    island.clearance = clear
    Object.entries(clear).forEach(([side, w]) => {
      if (w < std.minWalkway) warnings.push({ code: 'islandClearance', level: w < 0 ? 'error' : 'warn', params: { side, w, min: std.minWalkway } })
    })
  }

  return { walls, runs, island, warnings, width: W, depth: D }
}

export function runDesign(closet, id, length) {
  const run = closet.runs[id]
  return {
    width: length,
    height: closet.height,
    depth: run.depth,
    fillerLeft: 0,
    fillerRight: 0,
    topFiller: num(run.topFiller),
    loft: !!run.loft,
    loftH: run.loftH,
    doorType: run.doorType || 'none',
    construction: run.construction,
    backType: run.backType,
    sections: run.sections,
  }
}

export function islandDesigns(island, std) {
  const doubleSided = !!island.doubleSided
  const bays = Math.max(1, Math.round(num(island.bays, 1)))
  const n = Math.max(1, Math.round(num(island.drawers, 1)))
  const design = {
    width: num(island.width),
    height: num(island.height) - std.frontT,
    depth: doubleSided ? num(island.depth) / 2 : num(island.depth),
    fillerLeft: 0,
    fillerRight: 0,
    topFiller: 0,
    loft: false,
    loftH: 0,
    doorType: 'none',
    drawerStyle: island.drawerStyle === 'internal' ? 'internal' : 'external',
    construction: island.construction,
    backType: 'full',
    sections: Array.from({ length: bays }, () => ({ preset: null, zones: [{ type: 'drawers', n, h: n * std.drawerH, auto: true }], w: null, doors: null })),
  }
  return doubleSided ? [design, design] : [design]
}

function relabel(result, prefix) {
  const parts = result.parts.map((p) => ({
    ...p,
    sections: p.sections.map((s) => (s === 'ALL' ? prefix : `${prefix}·${s}`)),
  }))
  const warnings = result.warnings.map((w) => ({
    ...w,
    run: prefix,
    params: w.params?.section ? { ...w.params, section: `${prefix}·${w.params.section}` } : w.params,
  }))
  return { parts, warnings }
}

function addHardware(into, hw) {
  Object.entries(hw).forEach(([k, v]) => { into[k] = r1((into[k] || 0) + v) })
}

export function computeCloset(closet, std) {
  const layout = closetLayout(closet, std)
  const runs = []
  let parts = []
  const hardware = {}
  const warnings = layout.warnings.map((w) => ({ ...w }))

  layout.walls.forEach((id) => {
    const place = layout.runs[id]
    if (place.length <= 0) return
    const design = runDesign(closet, id, place.length)
    const result = computeWardrobe(design, std)
    const lab = relabel(result, id)
    parts = parts.concat(lab.parts)
    warnings.push(...lab.warnings)
    addHardware(hardware, result.hardware)
    runs.push({ id, design, result, place })
  })

  let island = null
  if (closet.island?.enabled && layout.island) {
    const designs = islandDesigns(closet.island, std)
    const halves = designs.map((design, k) => {
      const result = computeWardrobe(design, std)
      const lab = relabel(result, designs.length > 1 ? `I${k + 1}` : 'I')
      parts = parts.concat(lab.parts)
      warnings.push(...lab.warnings)
      addHardware(hardware, result.hardware)
      return { design, result }
    })
    const ov = num(std.islandTopOverhang)
    const top = { name: 'Island top', nameAr: PART_NAMES_AR['Island top'], L: r1(num(closet.island.width) + 2 * ov), W: r1(num(closet.island.depth) + 2 * ov), T: std.frontT, qty: 1, material: 'Front', edges: 'F,B,L,R', sections: ['I'], loft: false }
    parts.push(top)
    island = { place: layout.island, halves, top }
  }

  const merged = mergeParts(parts)
  const { materials, edgeBanding } = summarizeParts(merged, std)
  const constructions = [...new Set(runs.map((r) => r.result.summary.construction).concat(island ? [island.halves[0].result.summary.construction] : []))]
  const backs = [...new Set(runs.map((r) => r.result.summary.backType))]
  const summary = {
    mode: 'closet',
    construction: constructions.length === 1 ? constructions[0] : 'mixed',
    backType: backs.length === 1 ? backs[0] : 'mixed',
    runCount: runs.length,
    runLength: r1(runs.reduce((a, r) => a + r.place.length, 0)),
    sectionCount: runs.reduce((a, r) => a + r.design.sections.length, 0),
    doorCount: runs.reduce((a, r) => a + (r.result.summary.doorCount || 0), 0),
    partCount: merged.reduce((a, p) => a + p.qty, 0),
    width: layout.width,
    depth: layout.depth,
    height: num(closet.height),
  }
  return { mode: 'closet', parts: merged, hardware, materials, edgeBanding, warnings, summary, runs, island, layout, geometry: [], sections: [] }
}

export function computeDesign(design, std) {
  return design.mode === 'closet' && design.closet ? computeCloset(design.closet, std) : computeWardrobe(design, std)
}

export function withConstruction(design, construction) {
  const apply = (r) => ({ ...r, construction, backType: construction === 'shared' ? r.backType || 'none' : r.backType })
  if (design.mode === 'closet' && design.closet) {
    const runs = Object.fromEntries(Object.entries(design.closet.runs).map(([k, r]) => [k, apply(r)]))
    return { ...design, closet: { ...design.closet, runs, island: { ...design.closet.island, construction } } }
  }
  return apply(design)
}

export function fitRunSections(closet, id, std) {
  const layout = closetLayout(closet, std)
  const len = layout.runs[id]?.length || 0
  const d = { ...closet.runs[id], width: len, sections: closet.runs[id].sections }
  const count = runSectionCount(len, std)
  return { ...closet, runs: { ...closet.runs, [id]: { ...closet.runs[id], sections: withSectionCount(d, count, std, RUN_CYCLES[id]).sections } } }
}
