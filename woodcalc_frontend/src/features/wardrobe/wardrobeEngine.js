import { MACHINING_CONFIG } from '../kitchen_planner/machining/config'
import { getHingeCount } from '../kitchen_planner/formulaEngine'
import { createKit, opList } from './wardrobeMachining'
import { slidingStyle, doorLayout } from './slidingDoors'

export const ZONE_TYPES = ['shelves', 'hang', 'hang2', 'drawers', 'open']
export const PRESET_IDS = ['longHang', 'doubleHang', 'shelves', 'hangDrawers', 'shelvesDrawers']
export const DOOR_TYPES = ['hinged', 'sliding', 'none']
export const CONSTRUCTION_TYPES = ['boxes', 'shared']
export const BACK_TYPES = ['none', 'full', 'perSection']
export const DRAWER_STYLES = ['internal', 'external']

export const RUNNER_DEFAULTS = { runnerSideClearance: 12.5, runnerHoleFront: 37, runnerHolePitch: 128, runnerLine: 30 }

export function drawerSystemSnapshot(sys) {
  if (!sys) return null
  const pick = (v, d, positive = false) => {
    const n = Number(v)
    return v !== null && v !== undefined && v !== '' && Number.isFinite(n) && (positive ? n > 0 : n >= 0) ? n : d
  }
  return {
    id: sys.id,
    name: sys.name,
    runnerSideClearance: pick(sys.runner_side_clearance, RUNNER_DEFAULTS.runnerSideClearance),
    runnerHoleFront: pick(sys.runner_hole_front, RUNNER_DEFAULTS.runnerHoleFront),
    runnerHolePitch: pick(sys.runner_hole_pitch, RUNNER_DEFAULTS.runnerHolePitch, true),
    runnerLine: pick(sys.runner_line, RUNNER_DEFAULTS.runnerLine),
  }
}

export const PART_NAMES_AR = {
  'Side': 'جانب',
  'Partition': 'قاطع',
  'Double partition': 'قاطع مزدوج',
  'Back rail': 'مرباط خلفي',
  'Top': 'سقف',
  'Bottom': 'قاعدة',
  'Back': 'ظهر',
  'Fixed shelf': 'رف ثابت',
  'Shelf': 'رف متحرك',
  'Door': 'باب',
  'Sliding door': 'باب جرار',
  'Sliding door panel': 'حشوة باب جرار',
  'Drawer spacer': 'تسميكة',
  'Drawer front': 'وجه درج',
  'Drawer side': 'جانب درج',
  'Drawer front/back': 'ظهر/وجه علبة الدرج',
  'Drawer bottom': 'قاعدة درج',
  'Plinth': 'بانيل',
  'Filler': 'سدة',
  'Top filler': 'سدة علوية',
  'Fixed front': 'لوح أمامي ثابت',
  'Island top': 'سطح الجزيرة',
  'Mirror': 'مرآة',
  'Desk top': 'سطح التسريحة',
  'Desk end panel': 'جانب التسريحة',
  'Desk modesty panel': 'لوح خلفي للتسريحة',
}

const r1 = (n) => Math.round(n * 10) / 10
const num = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function presetZones(id, std) {
  const top = () => ({ type: 'shelves', h: 350, n: 0 })
  const drawers = (n) => ({ type: 'drawers', n, h: n * std.drawerH })
  switch (id) {
    case 'doubleHang': return [{ type: 'hang2', auto: true }]
    case 'shelves': return [{ type: 'shelves', auto: true, n: null }]
    case 'hangDrawers': return [top(), { type: 'hang', auto: true }, drawers(2)]
    case 'shelvesDrawers': return [{ type: 'shelves', auto: true, n: null }, drawers(3)]
    default: return [top(), { type: 'hang', auto: true }]
  }
}

export function newZone(type, std) {
  if (type === 'drawers') return { type, n: 2, h: 2 * std.drawerH }
  if (type === 'shelves') return { type, n: null, h: 700 }
  if (type === 'hang') return { type, h: 1400 }
  if (type === 'hang2') return { type, h: 1800 }
  return { type: 'open', h: 400 }
}

export function carcassWidth(d) {
  return Math.max(0, num(d.width) - num(d.fillerLeft) - num(d.fillerRight))
}

export function autoSectionCount(d, std) {
  return Math.max(1, Math.ceil(carcassWidth(d) / std.maxSectionW))
}

const DEFAULT_CYCLE = ['longHang', 'shelvesDrawers', 'doubleHang', 'shelves']

export function withSectionCount(d, count, std, cycle = DEFAULT_CYCLE) {
  const n = Math.max(1, Math.min(12, Math.round(num(count, 1))))
  const prev = Array.isArray(d.sections) ? d.sections : []
  const sections = Array.from({ length: n }, (_, i) => {
    if (prev[i]) return { ...prev[i] }
    const preset = cycle[i % cycle.length]
    return { preset, zones: presetZones(preset, std), w: null, doors: null }
  })
  return { ...d, sections }
}

export function defaultDesign(std) {
  const d = {
    width: 2400, height: 2600, depth: 600,
    fillerLeft: 0, fillerRight: 0, topFiller: 0,
    loft: true, loftH: 500,
    doorType: 'hinged',
    construction: 'boxes',
    backType: 'none',
    sections: [],
  }
  return withSectionCount(d, autoSectionCount(d, std), std, ['longHang', 'shelvesDrawers', 'doubleHang'])
}

export function sectionWidths(d) {
  const total = carcassWidth(d)
  const fixed = d.sections.map((s) => (num(s.w) > 0 ? num(s.w) : null))
  const fixedSum = fixed.reduce((a, w) => a + (w || 0), 0)
  const free = fixed.filter((w) => w == null).length
  if (free === 0) return fixed
  const each = Math.floor((total - fixedSum) / free)
  const out = fixed.map((w) => (w == null ? each : w))
  let last = -1
  fixed.forEach((w, i) => { if (w == null) last = i })
  out[last] = r1(out[last] + (total - fixedSum - each * free))
  return out
}

export function autoShelfCount(h, std) {
  const T = std.carcassT
  return Math.max(0, Math.round((h + T) / (std.shelfSpacing + T)) - 1)
}

export function resolveZones(zones, innerH, std) {
  const T = std.carcassT
  const list = Array.isArray(zones) && zones.length ? zones : [{ type: 'open', auto: true }]
  let autoIdx = list.findIndex((z) => z.auto)
  if (autoIdx < 0) autoIdx = list.length - 1
  const fixedSum = list.reduce((a, z, i) => a + (i === autoIdx ? 0 : Math.max(0, num(z.h))), 0)
  const autoH = innerH - (list.length - 1) * T - fixedSum
  let y = innerH
  const resolved = list.map((z, i) => {
    const h = i === autoIdx ? autoH : Math.max(0, num(z.h))
    const top = y
    const bottom = y - h
    y = bottom - T
    const n = z.type === 'shelves' ? (z.n == null || z.n === '' ? autoShelfCount(h, std) : Math.max(0, Math.round(num(z.n)))) : z.type === 'drawers' ? Math.max(1, Math.round(num(z.n, 1))) : 0
    return { ...z, h: r1(h), top: r1(top), bottom: r1(bottom), auto: i === autoIdx, n }
  })
  return { zones: resolved, autoH: r1(autoH) }
}

export function confirmatPerJoint(L) {
  const c = MACHINING_CONFIG.confirmat
  if (L <= c.shortJointMax) return 2
  let n = Math.max(2, Math.ceil((L - 2 * c.endDistance) / c.maxSpacing) + 1)
  if (L > c.middleOverLength) n = Math.max(n, 3)
  return n
}

export const MAX_DOORS_PER_SECTION = 2
export const FRONT_ITEM_TYPES = ['door', 'fixed', 'open']

export function hasCustomFronts(section) {
  return Array.isArray(section?.fronts) && section.fronts.length > 0
}

export function resolveFrontRows(fronts, bodyH) {
  const rows = fronts.map((r) => ({ ...r, items: (Array.isArray(r.items) && r.items.length ? r.items : [{ type: 'door' }]).slice(0, MAX_DOORS_PER_SECTION) }))
  let fill = rows.findIndex((r) => r.h == null || r.h === '')
  if (fill < 0) fill = rows.length - 1
  const fixedSum = rows.reduce((a, r, i) => a + (i === fill ? 0 : Math.max(0, num(r.h))), 0)
  const fillH = bodyH - fixedSum
  let y = 0
  const out = rows.map((r, i) => ({ ...r, h: r1(i === fill ? Math.max(0, fillH) : Math.max(0, num(r.h))), fill: i === fill }))
  for (let i = out.length - 1; i >= 0; i--) {
    out[i].bottom = r1(y)
    y += out[i].h
  }
  return { rows: out, overflow: fillH < 0, fixedSum: r1(fixedSum) }
}

export function frontItemHinge(items, k) {
  if (items.length === 2) return k === 0 ? 'left' : 'right'
  return items[k]?.hinge === 'right' ? 'right' : 'left'
}

export function rowsFromZones(zones, bodyH, T) {
  const cuts = zones.slice(0, -1).map((z) => r1(z.bottom + T - T / 2)).sort((a, b) => a - b)
  const edges = [0, ...cuts, bodyH]
  const hs = edges.slice(1).map((e, i) => r1(e - edges[i])).reverse()
  return hs.map((h, i) => ({ h: i === 0 ? null : h, items: [{ type: 'door' }] }))
}

export function hingedDoorCount(section, w, std) {
  const forced = Math.round(num(section.doors))
  const n = forced > 0 ? forced : Math.ceil(w / std.maxDoorW)
  return Math.min(MAX_DOORS_PER_SECTION, Math.max(1, n))
}

export function runnerLengthFor(depth, std) {
  const fits = std.runnerLengths.filter((l) => l <= depth - 20)
  return fits.length ? fits[fits.length - 1] : std.runnerLengths[0]
}

export function splitRun(start, end, cuts, maxL) {
  const inner = cuts.filter((c) => c > start + 0.01 && c < end - 0.01)
  const pieces = []
  let s = start
  let tooLong = false
  while (end - s > maxL + 0.01) {
    const fit = inner.filter((c) => c > s + 0.01 && c - s <= maxL + 0.01)
    const c = fit.length ? fit[fit.length - 1] : inner.find((v) => v > s + 0.01)
    if (c == null) { tooLong = true; break }
    if (!fit.length) tooLong = true
    pieces.push([s, c])
    s = c
  }
  pieces.push([s, end])
  if (pieces.some(([a, b]) => b - a > maxL + 0.01)) tooLong = true
  return { pieces, tooLong }
}

export function constructionOf(design) {
  const construction = design.construction === 'shared' ? 'shared' : 'boxes'
  const backType = construction === 'shared' ? (BACK_TYPES.includes(design.backType) ? design.backType : 'none') : 'full'
  return { construction, backType }
}

export function sectionBounds(widths) {
  const bounds = []
  let acc = 0
  widths.forEach((w, i) => { acc += w; if (i < widths.length - 1) bounds.push(acc) })
  return bounds
}

export function chooseDoubles(bounds, xa, xb, T, sidesFull, sheetL, k0 = 0) {
  const topLen = (a, b) => (b - a) - (sidesFull ? 2 * T : 0)
  if (topLen(xa, xb) <= sheetL + 0.01) return []
  const inside = bounds.map((b, k) => ({ b, k })).filter(({ b, k }) => k >= k0 && b > xa + 0.01 && b < xb - 0.01)
  if (!inside.length) return []
  const fits = inside.filter(({ b }) => topLen(xa, b) <= sheetL + 0.01 && topLen(b, xb) <= sheetL + 0.01)
  const pool = fits.length ? fits : inside
  const mid = (xa + xb) / 2
  const pick = pool.reduce((best, c) => (Math.abs(c.b - mid) < Math.abs(best.b - mid) ? c : best))
  return [
    ...chooseDoubles(bounds, xa, pick.b, T, sidesFull, sheetL, k0),
    pick.k,
    ...chooseDoubles(bounds, pick.b, xb, T, sidesFull, sheetL, pick.k + 1),
  ]
}

export function sectionBays(widths, cw, T, shared, doubles = []) {
  const bounds = sectionBounds(widths)
  const dbl = new Set(doubles)
  const half = (k) => (dbl.has(k) ? T : T / 2)
  let x = 0
  const bays = widths.map((w, i) => {
    const left = shared ? (i === 0 ? T : bounds[i - 1] + half(i - 1)) : x + T
    const right = shared ? (i === widths.length - 1 ? cw - T : bounds[i] - half(i)) : x + w - T
    const out = { x, w, left: r1(left), innerW: r1(right - left) }
    x += w
    return out
  })
  return { bays, bounds }
}

function aggregate(parts) {
  const map = new Map()
  parts.forEach((p) => {
    const key = [p.name, p.L, p.W, p.T, p.material, p.edges, p.loft ? 1 : 0].join('|')
    const e = map.get(key)
    if (e) {
      e.qty += p.qty
      if (!e.sections.includes(p.section)) e.sections.push(p.section)
    } else {
      map.set(key, { ...p, sections: [p.section] })
    }
  })
  return [...map.values()]
}

export function mergeParts(parts) {
  const map = new Map()
  parts.forEach((p) => {
    const key = [p.name, p.L, p.W, p.T, p.material, p.edges, p.loft ? 1 : 0].join('|')
    const e = map.get(key)
    if (e) {
      e.qty += p.qty
      p.sections.forEach((sec) => { if (!e.sections.includes(sec)) e.sections.push(sec) })
    } else {
      map.set(key, { ...p, sections: [...p.sections] })
    }
  })
  return [...map.values()]
}

export function summarizeParts(parts, std) {
  const matMap = new Map()
  const edgeMap = new Map()
  parts.forEach((p) => {
    if (p.material === 'Mirror') return
    const mk = `${p.material}|${p.T}`
    const m = matMap.get(mk) || { material: p.material, T: p.T, areaM2: 0 }
    m.areaM2 += (p.qty * p.L * p.W) / 1e6
    matMap.set(mk, m)
    const edges = p.edges ? p.edges.split(',') : []
    const mm = edges.reduce((a, e) => a + (e === 'F' || e === 'B' ? p.L : p.W), 0) * p.qty
    if (mm > 0) {
      const thickness = p.material === 'Front' ? std.edgeFront : std.edgeCarcass
      const ek = `${p.material}|${thickness}`
      const e = edgeMap.get(ek) || { material: p.material, thickness, meters: 0 }
      e.meters += mm / 1000
      edgeMap.set(ek, e)
    }
  })
  const sheetArea = (std.sheetL * std.sheetW) / 1e6
  const materials = [...matMap.values()].map((m) => ({
    ...m,
    areaM2: Math.round(m.areaM2 * 100) / 100,
    sheets: sheetArea > 0 ? Math.ceil((m.areaM2 * std.wasteFactor) / sheetArea) : 0,
  }))
  const edgeBanding = [...edgeMap.values()].map((e) => ({ ...e, meters: Math.round(e.meters * 10) / 10 }))
  return { materials, edgeBanding }
}

const EDGE_ALL = 'F,B,L,R'

export function computeWardrobe(design, std) {
  const T = std.carcassT
  const FT = std.frontT
  const warnings = []
  const rawParts = []
  const hardware = {}
  const geometry = []
  const warn = (code, params = {}, level = 'warn') => warnings.push({ code, level, params })
  const addHw = (key, qty) => { if (qty > 0) hardware[key] = r1((hardware[key] || 0) + qty) }
  const part = (p) => { if (p.qty > 0 && p.L > 0 && p.W > 0) rawParts.push({ ...p, L: r1(p.L), W: r1(p.W) }) }
  const box = (g) => geometry.push(g)

  const { construction, backType } = constructionOf(design)
  const shared = construction === 'shared'
  const noBack = backType === 'none'
  const railCount = noBack ? Math.max(0, Math.round(num(std.backRailCount))) : 0
  const externalDrawers = design.drawerStyle === 'external'
  const runnerClear = num(design.drawerSystem?.runnerSideClearance, std.runnerClearance)
  const runnerPattern = {
    front: num(design.drawerSystem?.runnerHoleFront, RUNNER_DEFAULTS.runnerHoleFront),
    pitch: Math.max(1, num(design.drawerSystem?.runnerHolePitch, RUNNER_DEFAULTS.runnerHolePitch)),
    line: num(design.drawerSystem?.runnerLine, RUNNER_DEFAULTS.runnerLine),
  }
  const sliding = design.doorType === 'sliding'
  const hinged = design.doorType === 'hinged'
  const D = num(design.depth)
  const cw = carcassWidth(design)
  const loftH = design.loft ? num(design.loftH) : 0
  const topFiller = num(design.topFiller)
  const bodyH = num(design.height) - std.plinthH - topFiller - loftH
  const innerH = bodyH - 2 * T
  const front = D - (sliding ? std.slidingTrackDepth : 0)
  const usableDepth = front - (noBack ? (railCount > 0 ? T : 0) : std.grooveSetback + std.backT)
  const fixedShelfDepth = usableDepth - 1
  const shelfDepth = usableDepth - (noBack ? std.wallClearance : std.shelfBackClearance) - std.shelfFrontSetback
  const runnerDepth = usableDepth - (noBack ? std.wallClearance : 0)
  const backGrow = 2 * (std.grooveDepth - std.backClearance)
  const widths = sectionWidths(design)
  const doubles = shared && std.partitionJoin !== 'full'
    ? chooseDoubles(sectionBounds(widths), 0, cw, T, std.sideJoin !== 'between', std.sheetL)
    : []
  const { bays, bounds } = sectionBays(widths, cw, T, shared, doubles)
  const groups = []
  ;[...doubles, bounds.length].reduce((i0, k) => {
    groups.push({ i0, i1: k, xa: i0 === 0 ? 0 : bounds[i0 - 1], xb: k === bounds.length ? cw : bounds[k] })
    return k + 1
  }, 0)
  const warnedOnce = new Set()
  const warnOnce = (code, params) => {
    const key = code + JSON.stringify(params)
    if (!warnedOnce.has(key)) { warnedOnce.add(key); warn(code, params) }
  }
  const kit = createKit(std, D, T, warnOnce)
  const perSectionShared = shared && backType === 'perSection'
  const bayShift = (i) => (perSectionShared && i % 2 === 1 ? std.grooveStagger : 0)
  const sectionGrid = (i) => (shared && i % 2 === 1 ? kit.halfPitch : 0)
  if (backType !== 'none' && T - std.grooveDepth < std.minGrooveBacking) warn('grooveBackingThin', { left: r1(T - std.grooveDepth), min: std.minGrooveBacking })
  if (shared && railCount > 0 && bays.length > 1 && kit.railHoleGap(std.backRailH, std.railStagger) < kit.minFaceGap) {
    warn('railStaggerSmall', { stagger: std.railStagger, gap: kit.railHoleGap(std.backRailH, std.railStagger), min: kit.minFaceGap })
  }
  if (perSectionShared && bays.length > 1 && std.grooveStagger < kit.grooveW) warn('grooveStaggerSmall', { stagger: std.grooveStagger, min: kit.grooveW }, 'error')
  const pinColumns = {
    frontY: D - front,
    backY: backType !== 'none' ? r1(kit.grooveY - kit.grooveW / 2) : r1(D - (front - usableDepth)),
  }
  const wallSets = { body: [], loft: [] }
  const bayWalls = (loft) => wallSets[loft ? 'loft' : 'body']
  const sectionsOut = []
  let railMm = 0

  if (bodyH < 400 || innerH < 200) {
    warn('heightTooSmall', { h: r1(bodyH) }, 'error')
    return { parts: [], rawParts: [], hardware, geometry, warnings, summary: { bodyH: r1(bodyH), carcassW: cw, construction, backType }, sections: [], materials: [], edgeBanding: [] }
  }
  if (bodyH > std.maxCarcassH) warn('bodyTooTall', { h: r1(bodyH), max: std.maxCarcassH })
  if (design.loft && loftH < std.minLoftH) warn('loftTooSmall', { h: loftH, min: std.minLoftH })
  const widthSum = r1(widths.reduce((a, w) => a + w, 0))
  if (Math.abs(widthSum - cw) > 0.5) warn('widthMismatch', { sum: widthSum, total: cw }, 'error')

  const carcass = (section, si, x, w, y0, h, loft, splitSides = false) => {
    const innerW = w - 2 * T
    const side = kit.wall(y0, h)
    const rightSide = splitSides ? kit.wall(y0, h) : side
    const topOps = opList()
    const bottomOps = opList()
    if (splitSides) {
      ;[side, rightSide].forEach((sw) => part({ name: 'Side', L: h, W: D, T, qty: 1, material: 'Carcass', edges: 'F', section, loft, ops: sw.ops }))
    } else {
      part({ name: 'Side', L: h, W: D, T, qty: 2, material: 'Carcass', edges: 'F', section, loft, ops: side.ops })
    }
    part({ name: 'Top', L: innerW, W: D, T, qty: 1, material: 'Carcass', edges: 'F', section, loft, ops: topOps })
    part({ name: 'Bottom', L: innerW, W: D, T, qty: 1, material: 'Carcass', edges: 'F', section, loft, ops: bottomOps })
    part({ name: 'Back', L: h - 2 * T + backGrow, W: innerW + backGrow, T: std.backT, qty: 1, material: 'Back', edges: '', section, loft })
    addHw('confirmat', 4 * confirmatPerJoint(D))
    ;[[topOps, y0 + h - T / 2], [bottomOps, y0 + T / 2]].forEach(([ops, absY]) => {
      ;['LEFT', 'RIGHT'].forEach((end) => kit.join(end === 'LEFT' ? side : rightSide, 'TOP', ops, end, { absY, frontZ: D, length: D, panelLength: innerW }))
      kit.backGroove(ops, innerW)
    })
    kit.backGroove(side.ops, h)
    if (splitSides) kit.backGroove(rightSide.ops, h)
    bayWalls(loft)[si] = { left: { w: side, face: 'TOP' }, right: { w: rightSide, face: 'TOP' } }
    box({ kind: 'carcass', x, y: y0, z: 0, w: T, h, d: D })
    box({ kind: 'carcass', x: x + w - T, y: y0, z: 0, w: T, h, d: D })
    box({ kind: 'carcass', x: x + T, y: y0, z: 0, w: innerW, h: T, d: D })
    box({ kind: 'carcass', x: x + T, y: y0 + h - T, z: 0, w: innerW, h: T, d: D })
    box({ kind: 'back', x: x + T, y: y0 + T, z: std.grooveSetback, w: innerW, h: h - 2 * T, d: std.backT })
  }

  const backRails = (section, si, left, innerW, y0, h, loft) => {
    if (railCount <= 0 || innerW <= 0) return
    const railH = std.backRailH
    const room = h - 2 * T - railH
    const s = si % 2 === 1 ? std.railStagger : 0
    const ys = Array.from({ length: railCount }, (_, k) => {
      if (railCount === 1) return y0 + h - T - railH - s
      if (k === railCount - 1) return y0 + T + s
      return y0 + T + room - (room * k) / (railCount - 1) - s
    }).sort((a, b) => a - b)
    const overlap = ys.some((y, k) => k > 0 && y - ys[k - 1] < railH - 0.01) || ys[0] < y0 + T - 0.01 || ys[ys.length - 1] + railH > y0 + h - T + 0.01
    if (railCount * railH > h - 2 * T || overlap) warn('backRailsDontFit', { h: r1(h), n: railCount, railH }, 'error')
    const railOps = opList()
    part({ name: 'Back rail', L: innerW, W: railH, T, qty: railCount, material: 'Carcass', edges: 'F', section, loft, ops: railOps })
    addHw('confirmat', 2 * railCount * confirmatPerJoint(railH))
    const walls = bayWalls(loft)[si]
    for (const y of ys) {
      kit.railJoin(walls.left.w, walls.left.face, railOps, 'LEFT', { absY: y, length: railH, panelLength: innerW })
      kit.railJoin(walls.right.w, walls.right.face, railOps, 'RIGHT', { absY: y, length: railH, panelLength: innerW })
      box({ kind: 'backRail', x: left, y: r1(y), z: 0, w: innerW, h: railH, d: T })
    }
  }

  const sharedGroup = (y0, h, loft, g) => {
    const gb = bays.slice(g.i0, g.i1 + 1)
    const n = gb.length
    const local = bounds.slice(g.i0, g.i1)
    const sidesFull = std.sideJoin !== 'between'
    const partFull = std.partitionJoin === 'full'
    const backZ = std.grooveSetback + std.backT
    const pD = backType === 'full' ? D - backZ : D
    const pz = D - pD
    const sideL = sidesFull ? h : h - 2 * T
    const sideY = sidesFull ? y0 : y0 + T
    const grooved = backType !== 'none'
    const leftSide = kit.wall(sideY, sideL)
    const rightSide = kit.wall(sideY, sideL)
    ;[[leftSide, g.xa === 0], [rightSide, g.xb === cw]].forEach(([w, outer]) => {
      part({ name: outer ? 'Side' : 'Double partition', L: sideL, W: D, T, qty: 1, material: 'Carcass', edges: 'F', section: 'ALL', loft, ops: w.ops })
    })
    if (grooved) {
      kit.backGroove(leftSide.ops, sideL, { shift: bayShift(g.i0) })
      kit.backGroove(rightSide.ops, sideL, { shift: bayShift(g.i1) })
    }
    box({ kind: 'carcass', x: g.xa, y: sideY, z: 0, w: T, h: sideL, d: D })
    box({ kind: 'carcass', x: g.xb - T, y: sideY, z: 0, w: T, h: sideL, d: D })
    const partL = partFull ? h : h - 2 * T
    const partY = partFull ? y0 : y0 + T
    const parts = local.map((_, j) => {
      const k = g.i0 + j
      const w = kit.wall(partY, partL, { partition: true })
      part({ name: 'Partition', L: partL, W: pD, T, qty: 1, material: 'Carcass', edges: 'F', section: 'ALL', loft, ops: w.ops })
      if (backType === 'perSection') {
        kit.backGroove(w.ops, partL, { face: 'TOP', shift: bayShift(k) })
        kit.backGroove(w.ops, partL, { face: 'BOTTOM', shift: bayShift(k + 1) })
      }
      return w
    })
    local.forEach((b) => box({ kind: 'carcass', x: b - T / 2, y: partY, z: pz, w: T, h: partL, d: pD }))
    const walls = bayWalls(loft)
    gb.forEach((bay, j) => {
      walls[g.i0 + j] = {
        left: j === 0 ? { w: leftSide, face: 'TOP' } : { w: parts[j - 1], face: 'BOTTOM' },
        right: j === n - 1 ? { w: rightSide, face: 'TOP' } : { w: parts[j], face: 'TOP' },
      }
    })
    const panel = (name, a, b, y) => {
      const ops = opList()
      part({ name, L: b - a, W: D, T, qty: 1, material: 'Carcass', edges: 'F', section: 'ALL', loft, ops })
      if (grooved) {
        gb.forEach((bay, j) => {
          const segA = Math.max(a, j === 0 ? -Infinity : local[j - 1])
          const segB = Math.min(b, j === n - 1 ? Infinity : local[j])
          if (segB - segA > 0.01) kit.backGroove(ops, b - a, { shift: bayShift(g.i0 + j), x0: segA - a, x1: segB - a })
        })
      }
      box({ kind: 'carcass', x: a, y, z: 0, w: r1(b - a), h: T, d: D })
      return ops
    }
    const ends = [[y0 + h - T, y0 + h - T / 2, 'RIGHT'], [y0, y0 + T / 2, 'LEFT']]
    if (partFull) {
      gb.forEach((bay, j) => {
        const wl = walls[g.i0 + j]
        ends.forEach(([py, absY, wallEnd]) => {
          const ops = panel(py === y0 ? 'Bottom' : 'Top', bay.left, bay.left + bay.innerW, py)
          const L = bay.innerW
          if (j === 0 && !sidesFull) kit.over(ops, T / 2, leftSide, wallEnd, { length: D })
          else kit.join(wl.left.w, wl.left.face, ops, 'LEFT', { absY, frontZ: D, length: wl.left.w.partition ? pD : D, panelLength: L })
          if (j === n - 1 && !sidesFull) kit.over(ops, L - T / 2, rightSide, wallEnd, { length: D })
          else kit.join(wl.right.w, wl.right.face, ops, 'RIGHT', { absY, frontZ: D, length: wl.right.w.partition ? pD : D, panelLength: L })
        })
      })
      addHw('confirmat', 4 * confirmatPerJoint(D) + 4 * (n - 1) * confirmatPerJoint(pD))
    } else {
      const a = sidesFull ? g.xa + T : g.xa
      const b = sidesFull ? g.xb - T : g.xb
      if (b - a > std.sheetL + 0.01) warnOnce('panelTooLong', { part: 'Top', max: std.sheetL })
      ends.forEach(([py, absY, wallEnd]) => {
        const ops = panel(py === y0 ? 'Bottom' : 'Top', a, b, py)
        const L = b - a
        if (sidesFull) {
          kit.join(leftSide, 'TOP', ops, 'LEFT', { absY, frontZ: D, length: D, panelLength: L })
          kit.join(rightSide, 'TOP', ops, 'RIGHT', { absY, frontZ: D, length: D, panelLength: L })
        } else {
          kit.over(ops, T / 2, leftSide, wallEnd, { length: D })
          kit.over(ops, L - T / 2, rightSide, wallEnd, { length: D })
        }
        local.forEach((bd, j) => kit.over(ops, bd - a, parts[j], wallEnd, { length: pD }))
      })
      addHw('confirmat', 4 * confirmatPerJoint(D) + 2 * local.length * confirmatPerJoint(pD))
    }
    const backH = h - 2 * T + backGrow
    if (backType === 'full') {
      const maxW = backH <= std.sheetW ? std.sheetL : std.sheetW
      if (backH > std.sheetL) warnOnce('panelTooLong', { part: 'Back', max: std.sheetL })
      const { pieces, tooLong } = splitRun(g.xa + T, g.xb - T, local, maxW - backGrow)
      if (tooLong) warnOnce('panelTooLong', { part: 'Back', max: maxW })
      pieces.forEach(([pa, pb], k) => {
        const grow = (k === 0 ? backGrow / 2 : 0) + (k === pieces.length - 1 ? backGrow / 2 : 0)
        part({ name: 'Back', L: backH, W: pb - pa + grow, T: std.backT, qty: 1, material: 'Back', edges: '', section: 'ALL', loft })
        box({ kind: 'back', x: pa, y: y0 + T, z: std.grooveSetback, w: r1(pb - pa), h: h - 2 * T, d: std.backT })
      })
    } else if (backType === 'perSection') {
      gb.forEach((bay, j) => {
        const i = g.i0 + j
        part({ name: 'Back', L: backH, W: bay.innerW + backGrow, T: std.backT, qty: 1, material: 'Back', edges: '', section: `S${i + 1}`, loft })
        box({ kind: 'back', x: bay.left, y: y0 + T, z: std.grooveSetback + bayShift(i), w: bay.innerW, h: h - 2 * T, d: std.backT })
      })
    } else {
      gb.forEach((bay, j) => backRails(`S${g.i0 + j + 1}`, g.i0 + j, bay.left, bay.innerW, y0, h, loft))
    }
    return { leftSide, rightSide }
  }

  const sharedCarcass = (y0, h, loft) => {
    const built = groups.map((g) => sharedGroup(y0, h, loft, g))
    built.slice(0, -1).forEach((left, k) => {
      const right = built[k + 1]
      const n = kit.connect(left.rightSide, right.leftSide)
      addHw('carcassConnector', n)
    })
  }

  const customFronts = (section, si, x, w, fronts, zones) => {
    const y0 = std.plinthH
    const { rows, overflow, fixedSum } = resolveFrontRows(fronts, bodyH)
    if (overflow) warn('frontsTooTall', { section, h: fixedSum, max: r1(bodyH) }, 'error')
    const walls = bayWalls(false)[si]
    const hingeShift = shared && si % 2 === 1 ? std.hingeStagger : 0
    const base = y0 + T
    const supports = [[y0, y0 + T], [y0 + bodyH - T, y0 + bodyH]]
      .concat(zones.slice(0, -1).map((z) => [base + z.bottom - T, base + z.bottom]))
    const supported = (edge) => supports.some(([a, b]) => edge >= a - std.doorGap - 0.01 && edge <= b + std.doorGap + 0.01)
    let doors = 0
    let fixed = 0
    rows.forEach((row, ri) => {
      if (row.h < std.minFrontH) warn('frontRowTooSmall', { section, h: row.h, min: std.minFrontH })
      const n = row.items.length
      const itemW = w / n - std.doorGap
      const itemH = row.h - std.doorGap
      const rowBottom = y0 + row.bottom
      if (itemH <= 0 || itemW <= 0) return
      row.items.forEach((item, k) => {
        const gx = x + k * (w / n) + std.doorGap / 2
        const gy = rowBottom + std.doorGap / 2
        if (item.type === 'door') {
          const hinge = frontItemHinge(row.items, k)
          doors += 1
          if (itemW > std.maxDoorW) warn('doorTooWide', { section, w: r1(itemW), max: std.maxDoorW })
          addHw('hinge', getHingeCount(itemH))
          addHw('handle', 1)
          const ops = opList()
          const wl = hinge === 'left' ? walls.left : walls.right
          const centres = kit.hingeCentres(itemH, gy, base, hingeShift, sectionGrid(si))
          kit.hingeCups(ops, centres, gy, itemW, hinge)
          part({ name: 'Door', L: itemH, W: itemW, T: FT, qty: 1, material: 'Front', edges: EDGE_ALL, section, loft: false, ops, face: 'BOTTOM' })
          if (wl) centres.forEach((c) => kit.hingePlate(wl.w, wl.face, c))
          box({ kind: 'door', section: si, loft: false, hinge, row: ri, x: gx, y: gy, z: D, w: r1(itemW), h: r1(itemH), d: FT })
        } else if (item.type === 'fixed') {
          fixed += 1
          part({ name: 'Fixed front', L: itemH, W: itemW, T: FT, qty: 1, material: 'Front', edges: EDGE_ALL, section, loft: false })
          if (!supported(rowBottom) && !supported(rowBottom + row.h)) warn('fixedFrontNoSupport', { section, h: r1(row.h) })
          box({ kind: 'fixedFront', section: si, loft: false, row: ri, x: gx, y: gy, z: D, w: r1(itemW), h: r1(itemH), d: FT })
        }
      })
    })
    return { doors, fixed }
  }

  const hingedDoors = (section, si, x, w, y0, h, n, loft, singleHinge = 'left') => {
    const doorW = w / n - std.doorGap
    const doorH = h - std.doorGap
    if (!loft && doorW > std.maxDoorW) warn('doorTooWide', { section, w: r1(doorW), max: std.maxDoorW })
    addHw('hinge', getHingeCount(doorH) * n)
    addHw('handle', n)
    const walls = bayWalls(loft)[si]
    const doorBottom = y0 + std.doorGap / 2
    const hingeShift = shared && si % 2 === 1 ? std.hingeStagger : 0
    const sideOf = (k) => (n === 1 ? singleHinge : k < n / 2 ? 'left' : 'right')
    ;['left', 'right'].forEach((side) => {
      const ks = Array.from({ length: n }, (_, k) => k).filter((k) => sideOf(k) === side)
      if (!ks.length) return
      const ops = opList()
      const wl = side === 'left' ? walls.left : walls.right
      const centres = kit.hingeCentres(doorH, doorBottom, y0 + T, hingeShift, sectionGrid(si))
      kit.hingeCups(ops, centres, doorBottom, doorW, side)
      part({ name: 'Door', L: doorH, W: doorW, T: FT, qty: ks.length, material: 'Front', edges: EDGE_ALL, section, loft, ops, face: 'BOTTOM' })
      if (wl) centres.forEach((c) => kit.hingePlate(wl.w, wl.face, c))
    })
    for (let k = 0; k < n; k++) {
      const hinge = sideOf(k)
      box({ kind: 'door', section: si, loft, hinge, x: x + k * (w / n) + std.doorGap / 2, y: y0 + std.doorGap / 2, z: D, w: r1(doorW), h: r1(doorH), d: FT })
    }
  }

  if (shared) {
    sharedCarcass(std.plinthH, bodyH, false)
    if (loftH > 0) sharedCarcass(std.plinthH + bodyH, loftH, true)
  }

  design.sections.forEach((s, si) => {
    const loss = bayShift(si)
    const bayUsable = usableDepth - loss
    const bayFixedShelf = fixedShelfDepth - loss
    const bayShelf = shelfDepth - loss
    const bayRunner = runnerDepth - loss
    const bayPins = { frontY: pinColumns.frontY, backY: pinColumns.backY - loss }
    const w = widths[si]
    const { x, left, innerW } = bays[si]
    const section = `S${si + 1}`
    if (w < std.minSectionW) warn('sectionTooNarrow', { section, w, min: std.minSectionW }, 'error')
    if (w > std.maxSectionW) warn('sectionTooWide', { section, w, max: std.maxSectionW })
    if (innerW > std.maxShelfSpan) warn('shelfSpan', { section, w: r1(innerW), max: std.maxShelfSpan })
    const splitSides = hasCustomFronts(s) || s.hinge != null
    if (!shared) carcass(section, si, x, w, std.plinthH, bodyH, false, splitSides)

    const { zones, autoH } = resolveZones(s.zones, innerH, std)
    if (autoH < 100) warn('zonesOverflow', { section, h: autoH }, autoH < 0 ? 'error' : 'warn')
    const base = std.plinthH + T
    const walls = bayWalls(false)[si]
    zones.forEach((z, zi) => {
      const yb = base + z.bottom
      const yt = base + z.top
      if (zi < zones.length - 1) {
        const fsOps = opList()
        part({ name: 'Fixed shelf', L: innerW, W: bayFixedShelf, T, qty: 1, material: 'Carcass', edges: 'F', section, ops: fsOps })
        addHw('confirmat', 2 * confirmatPerJoint(bayFixedShelf))
        kit.join(walls.left.w, walls.left.face, fsOps, 'LEFT', { absY: yb - T / 2, frontZ: front, length: bayFixedShelf, panelLength: innerW })
        kit.join(walls.right.w, walls.right.face, fsOps, 'RIGHT', { absY: yb - T / 2, frontZ: front, length: bayFixedShelf, panelLength: innerW })
        box({ kind: 'shelf', x: left, y: yb - T, z: front - bayFixedShelf, w: innerW, h: T, d: bayFixedShelf })
      }
      if (z.type === 'shelves' && z.n > 0) {
        const gap = (z.h - z.n * T) / (z.n + 1)
        if (gap < std.minShelfGap) warn('shelvesTooClose', { section, gap: r1(gap), min: std.minShelfGap })
        part({ name: 'Shelf', L: innerW - 2 * std.shelfSideClearance, W: bayShelf, T, qty: z.n, material: 'Carcass', edges: 'F', section })
        addHw('shelfPin', 4 * z.n)
        for (let k = 1; k <= z.n; k++) {
          const shelfBottom = yb + k * gap + (k - 1) * T
          ;[walls.left, walls.right].forEach((wl) => kit.pins(wl.w, wl.face, shelfBottom, bayPins, base, sectionGrid(si)))
          box({ kind: 'shelf', x: left + std.shelfSideClearance, y: yb + k * gap + (k - 1) * T, z: front - std.shelfFrontSetback - bayShelf, w: innerW - 2 * std.shelfSideClearance, h: T, d: bayShelf })
        }
      }
      if (z.type === 'hang' || z.type === 'hang2') {
        if (bayUsable < std.minHangDepth) warn('hangDepth', { section, d: r1(bayUsable), min: std.minHangDepth })
        const rails = z.type === 'hang2' ? [yt - std.railDrop, yb + z.h / 2 - std.railDrop] : [yt - std.railDrop]
        if (z.type === 'hang' && z.h < std.minLongHangH) warn('hangShort', { section, h: z.h, min: std.minLongHangH })
        if (z.type === 'hang2' && z.h < std.minDoubleHangH) warn('doubleHangShort', { section, h: z.h, min: std.minDoubleHangH })
        const railLen = innerW - std.railDeduction
        const socketShift = shared && si % 2 === 1 ? std.railSocketStagger : 0
        const railZ = front - bayUsable / 2 - socketShift
        rails.forEach((ry) => {
          railMm += railLen
          addHw('rail', 1)
          addHw('railBracket', 2)
          ;[walls.left, walls.right].forEach((wl) => kit.railSocket(wl.w, wl.face, ry, D - railZ))
          box({ kind: 'rail', x: left + std.railDeduction / 2, y: ry, z: railZ, w: railLen, h: std.railDiameter, d: std.railDiameter })
        })
      }
      if (z.type === 'drawers' && externalDrawers) {
        const coverBottom = zi === zones.length - 1 ? T : T / 2
        const coverTop = zi === 0 ? T : T / 2
        const pitch = (z.h + coverTop + coverBottom) / z.n
        const opening = z.h / z.n
        const runner = runnerLengthFor(bayRunner, std)
        const frontW = w - std.doorGap
        const frontH = pitch - std.drawerFrontGap
        const boxW = innerW - 2 * runnerClear
        const boxH = opening - std.drawerBoxHDeduction
        if (boxH < std.minDrawerBoxH) warn('drawersDontFit', { section, h: z.h, need: z.n * (std.minDrawerBoxH + std.drawerBoxHDeduction) })
        part({ name: 'Drawer front', L: frontW, W: frontH, T: FT, qty: z.n, material: 'Front', edges: EDGE_ALL, section })
        part({ name: 'Drawer side', L: runner, W: boxH, T: std.drawerBoxT, qty: 2 * z.n, material: 'Drawer box', edges: 'F', section })
        part({ name: 'Drawer front/back', L: boxW - 2 * std.drawerBoxT, W: boxH, T: std.drawerBoxT, qty: 2 * z.n, material: 'Drawer box', edges: 'F', section })
        part({ name: 'Drawer bottom', L: runner, W: boxW, T: std.drawerBottomT, qty: z.n, material: 'Back', edges: '', section })
        addHw('runnerPair', z.n)
        addHw('drawerHandle', z.n)
        const fy = yb - coverBottom
        const runnerShift = shared && si % 2 === 1 ? std.runnerStagger : 0
        for (let k = 0; k < z.n; k++) {
          ;[walls.left, walls.right].forEach((wl) => kit.runnerHoles(wl.w, wl.face, yb + k * opening + runnerPattern.line, D - front, runner, runnerPattern, runnerShift))
          box({ kind: 'drawerBox', x: left + runnerClear, y: r1(yb + k * opening + 10), z: front - runner, w: boxW, h: boxH, d: runner })
          box({ kind: 'drawerFront', x: x + std.doorGap / 2, y: r1(fy + k * pitch + std.drawerFrontGap / 2), z: D, w: r1(frontW), h: r1(frontH), d: FT })
        }
      } else if (z.type === 'drawers') {
        const need = z.n * std.drawerH
        if (z.h + 0.5 < need) warn('drawersDontFit', { section, h: z.h, need })
        const spacerDepth = bayUsable - 1
        const sp = std.drawerSpacerT
        const runner = runnerLengthFor(bayRunner, std)
        const frontW = innerW - 2 * sp - 4
        const frontH = std.drawerH - std.drawerFrontGap
        const boxW = innerW - 2 * sp - 2 * runnerClear
        const boxH = std.drawerH - std.drawerBoxHDeduction
        const spacer = kit.wall(yb, z.h, { frontZ: front })
        for (let k = 0; k < z.n; k++) kit.runnerHoles(spacer, 'TOP', yb + k * std.drawerH + runnerPattern.line, FT, runner, runnerPattern)
        part({ name: 'Drawer spacer', L: z.h, W: spacerDepth, T: sp, qty: 2, material: 'Carcass', edges: 'F', section, ops: spacer.ops })
        part({ name: 'Drawer front', L: frontW, W: frontH, T: FT, qty: z.n, material: 'Front', edges: EDGE_ALL, section })
        part({ name: 'Drawer side', L: runner, W: boxH, T: std.drawerBoxT, qty: 2 * z.n, material: 'Drawer box', edges: 'F', section })
        part({ name: 'Drawer front/back', L: boxW - 2 * std.drawerBoxT, W: boxH, T: std.drawerBoxT, qty: 2 * z.n, material: 'Drawer box', edges: 'F', section })
        part({ name: 'Drawer bottom', L: runner, W: boxW, T: std.drawerBottomT, qty: z.n, material: 'Back', edges: '', section })
        addHw('runnerPair', z.n)
        addHw('drawerHandle', z.n)
        box({ kind: 'spacer', x: left, y: yb, z: front - spacerDepth, w: sp, h: z.h, d: spacerDepth })
        box({ kind: 'spacer', x: left + innerW - sp, y: yb, z: front - spacerDepth, w: sp, h: z.h, d: spacerDepth })
        for (let k = 0; k < z.n; k++) {
          const dy = yb + k * std.drawerH + std.drawerFrontGap / 2
          box({ kind: 'drawerBox', x: left + sp + runnerClear, y: dy + 10, z: front - FT - runner, w: boxW, h: boxH, d: runner })
          box({ kind: 'drawerFront', x: left + sp + 2, y: dy, z: front - FT, w: frontW, h: frontH, d: FT })
        }
      }
    })

    let doors = 0
    let fixedFronts = 0
    const singleHinge = s.hinge === 'right' ? 'right' : 'left'
    if (hinged && hasCustomFronts(s)) {
      const out = customFronts(section, si, x, w, s.fronts, zones)
      doors = out.doors
      fixedFronts = out.fixed
    } else if (hinged) {
      doors = hingedDoorCount(s, w, std)
      hingedDoors(section, si, x, w, std.plinthH, bodyH, doors, false, singleHinge)
    }
    let loftDoors = 0
    if (loftH > 0) {
      if (!shared) carcass(section, si, x, w, std.plinthH + bodyH, loftH, true, splitSides)
      if (design.doorType !== 'none') {
        loftDoors = hinged ? hingedDoorCount(s, w, std) : hingedDoorCount({}, w, std)
        hingedDoors(section, si, x, w, std.plinthH + bodyH, loftH, loftDoors, true, singleHinge)
      }
    }
    if (!shared) addHw('leg', std.legsPerSection)
    sectionsOut.push({ section, w: r1(w), x: r1(x), bayX: left, innerW: r1(innerW), zones, doors, loftDoors, autoH, ...(fixedFronts ? { fixedFronts } : {}) })
  })
  if (shared) addHw('leg', Math.ceil(std.legsPerSection / 2) * (design.sections.length + 1 + doubles.length))

  let slidingCount = 0
  let doorMirrorM2 = 0
  if (sliding) {
    const n = Math.max(2, Math.ceil(cw / std.maxSlidingDoorW))
    slidingCount = n
    const doorW = (cw + (n - 1) * std.slidingOverlap) / n
    const doorH = bodyH - std.slidingHDeduction
    if (doorW > std.maxSlidingDoorW) warn('slidingDoorTooWide', { w: r1(doorW), max: std.maxSlidingDoorW })
    const sd = design.slidingDoors || {}
    const layouts = Array.from({ length: n }, (_, k) => doorLayout(slidingStyle(design, k), doorW, doorH, sd, std))
    const plain = layouts.filter((l) => !l.framed).length
    part({ name: 'Sliding door', L: doorH, W: doorW, T: FT, qty: plain, material: 'Front', edges: EDGE_ALL, section: 'ALL' })
    layouts.forEach((l) => {
      if (!l.framed) return
      addHw('slidingFrameM', l.frameM)
      l.panels.forEach((p) => {
        if (p.kind === 'mirror') {
          part({ name: 'Mirror', L: p.h, W: l.insertW, T: std.mirrorT, qty: 1, material: 'Mirror', edges: '', section: 'ALL' })
          if (p.h > 0 && l.insertW > 0) doorMirrorM2 += (p.h * l.insertW) / 1e6
        } else {
          part({ name: 'Sliding door panel', L: p.h, W: l.insertW, T: std.slidingInsertT, qty: 1, material: 'Front', edges: '', section: 'ALL' })
        }
      })
      if (l.mid != null && l.mid <= 0) warn('slidingMirrorTooSmall', { h: l.mid })
    })
    addHw('slidingKit', n)
    addHw('slidingTrack', 2)
    const step = doorW - std.slidingOverlap
    const zFront = D - FT - 10
    const zBack = zFront - FT - 15
    for (let k = 0; k < n; k++) {
      const backTrack = k % 2 === 0
      const openDx = backTrack ? (k < n - 1 ? step : -step) : 0
      const l = layouts[k]
      box({ kind: 'slidingDoor', x: k * step, y: std.plinthH + std.slidingHDeduction / 2, z: backTrack ? zBack : zFront, w: r1(doorW), h: r1(doorH), d: FT, openDx, ...(l.framed ? { style: slidingStyle(design, k), frame: num(std.slidingFrameDeduct), panels: l.panels, transoms: l.transoms, rail: num(std.slidingTransomH) } : {}) })
    }
  }

  const sheetPieces = []
  for (let left = cw; left > 0; left -= std.sheetL) sheetPieces.push(Math.min(left, std.sheetL))
  sheetPieces.forEach((L) => part({ name: 'Plinth', L, W: std.plinthH, T: FT, qty: 1, material: 'Front', edges: '', section: 'ALL' }))
  if (cw > 0) box({ kind: 'plinth', x: 0, y: 0, z: D - std.plinthSetback - FT, w: cw, h: std.plinthH, d: FT })

  const H = num(design.height)
  if (num(design.fillerLeft) > 0) {
    part({ name: 'Filler', L: H, W: num(design.fillerLeft), T: FT, qty: 1, material: 'Front', edges: 'F', section: 'L' })
    box({ kind: 'filler', x: -num(design.fillerLeft), y: 0, z: D - FT, w: num(design.fillerLeft), h: H, d: FT })
  }
  if (num(design.fillerRight) > 0) {
    part({ name: 'Filler', L: H, W: num(design.fillerRight), T: FT, qty: 1, material: 'Front', edges: 'F', section: 'R' })
    box({ kind: 'filler', x: cw, y: 0, z: D - FT, w: num(design.fillerRight), h: H, d: FT })
  }
  if (topFiller > 0) {
    part({ name: 'Top filler', L: cw, W: topFiller, T: FT, qty: 1, material: 'Front', edges: 'F', section: 'ALL' })
    box({ kind: 'filler', x: 0, y: H - topFiller, z: D - FT, w: cw, h: topFiller, d: FT })
  }

  const doorCount = sectionsOut.reduce((a, s) => a + s.doors + s.loftDoors, 0) + slidingCount
  const acc = design.accessories || {}
  if (acc.led) addHw('ledMeters', (cw / 1000) * Math.max(1, Math.round(num(acc.ledRows, 1))))
  if (acc.doorSensors) addHw('doorSensor', doorCount)
  const mirrors = Array.isArray(acc.mirrors) ? acc.mirrors : []
  mirrors.forEach((m) => part({ name: 'Mirror', L: num(m.h), W: num(m.w), T: std.mirrorT, qty: 1, material: 'Mirror', edges: '', section: 'ALL' }))
  const mirrorM2 = mirrors.reduce((a, m) => a + (num(m.h) * num(m.w)) / 1e6, 0) + doorMirrorM2
  if (mirrorM2 > 0) hardware.mirrorM2 = Math.round(mirrorM2 * 100) / 100

  const parts = aggregate(rawParts).map((p) => ({ ...p, nameAr: PART_NAMES_AR[p.name] || '' }))
  const { materials, edgeBanding } = summarizeParts(parts, std)
  if (railMm > 0) hardware.railMeters = Math.round(railMm / 100) / 10

  const summary = {
    construction,
    backType,
    carcassW: r1(cw),
    bodyH: r1(bodyH),
    innerH: r1(innerH),
    loftH,
    usableDepth: r1(usableDepth),
    sectionCount: design.sections.length,
    doorCount,
    fixedFrontCount: sectionsOut.reduce((a, s) => a + (s.fixedFronts || 0), 0),
    partCount: parts.reduce((a, p) => a + p.qty, 0),
  }

  return { parts, rawParts, hardware, geometry, warnings, summary, sections: sectionsOut, materials, edgeBanding }
}

export function cutListCsv(result, partLabel = (p) => p.name, materialLabel = (p) => p.material) {
  const rows = [['#', 'Part', 'Arabic', 'Section', 'L', 'W', 'T', 'Qty', 'Material', 'Edges']]
  result.parts.forEach((p, i) => rows.push([i + 1, partLabel(p), p.nameAr, p.sections.join(' ') + (p.loft ? ' loft' : ''), p.L, p.W, p.T, p.qty, materialLabel(p), p.edges]))
  return rows.map((r) => r.map((c) => {
    const s = String(c ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }).join(',')).join('\n')
}
