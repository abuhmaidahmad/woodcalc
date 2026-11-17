import { MACHINING_CONFIG } from '../kitchen_planner/machining/config'
import { getHingeCount } from '../kitchen_planner/formulaEngine'

export const ZONE_TYPES = ['shelves', 'hang', 'hang2', 'drawers', 'open']
export const PRESET_IDS = ['longHang', 'doubleHang', 'shelves', 'hangDrawers', 'shelvesDrawers']
export const DOOR_TYPES = ['hinged', 'sliding', 'none']

export const PART_NAMES_AR = {
  'Side': 'جانب',
  'Top': 'سقف',
  'Bottom': 'قاعدة',
  'Back': 'ظهر',
  'Fixed shelf': 'رف ثابت',
  'Shelf': 'رف متحرك',
  'Door': 'باب',
  'Sliding door': 'باب جرار',
  'Drawer spacer': 'تسميكة',
  'Drawer front': 'وجه درج',
  'Drawer side': 'جانب درج',
  'Drawer front/back': 'ظهر/وجه علبة الدرج',
  'Drawer bottom': 'قاعدة درج',
  'Plinth': 'بانيل',
  'Filler': 'سدة',
  'Top filler': 'سدة علوية',
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

export function hingedDoorCount(section, w, std) {
  const forced = Math.round(num(section.doors))
  return forced > 0 ? forced : Math.max(1, Math.ceil(w / std.maxDoorW))
}

export function runnerLengthFor(depth, std) {
  const fits = std.runnerLengths.filter((l) => l <= depth - 20)
  return fits.length ? fits[fits.length - 1] : std.runnerLengths[0]
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

  const sliding = design.doorType === 'sliding'
  const hinged = design.doorType === 'hinged'
  const D = num(design.depth)
  const cw = carcassWidth(design)
  const loftH = design.loft ? num(design.loftH) : 0
  const topFiller = num(design.topFiller)
  const bodyH = num(design.height) - std.plinthH - topFiller - loftH
  const innerH = bodyH - 2 * T
  const front = D - (sliding ? std.slidingTrackDepth : 0)
  const usableDepth = front - std.grooveSetback - std.backT
  const fixedShelfDepth = usableDepth - 1
  const shelfDepth = usableDepth - std.shelfBackClearance - std.shelfFrontSetback
  const backGrow = 2 * (std.grooveDepth - std.backClearance)
  const widths = sectionWidths(design)
  const sectionsOut = []
  let railMm = 0

  if (bodyH < 400 || innerH < 200) {
    warn('heightTooSmall', { h: r1(bodyH) }, 'error')
    return { parts: [], hardware, geometry, warnings, summary: { bodyH: r1(bodyH), carcassW: cw }, sections: [], materials: [], edgeBanding: [] }
  }
  if (bodyH > std.maxCarcassH) warn('bodyTooTall', { h: r1(bodyH), max: std.maxCarcassH })
  if (design.loft && loftH < std.minLoftH) warn('loftTooSmall', { h: loftH, min: std.minLoftH })
  const widthSum = r1(widths.reduce((a, w) => a + w, 0))
  if (Math.abs(widthSum - cw) > 0.5) warn('widthMismatch', { sum: widthSum, total: cw }, 'error')

  const carcass = (section, x, w, y0, h, loft) => {
    const innerW = w - 2 * T
    part({ name: 'Side', L: h, W: D, T, qty: 2, material: 'Carcass', edges: 'F', section, loft })
    part({ name: 'Top', L: innerW, W: D, T, qty: 1, material: 'Carcass', edges: 'F', section, loft })
    part({ name: 'Bottom', L: innerW, W: D, T, qty: 1, material: 'Carcass', edges: 'F', section, loft })
    part({ name: 'Back', L: h - 2 * T + backGrow, W: innerW + backGrow, T: std.backT, qty: 1, material: 'Back', edges: '', section, loft })
    addHw('confirmat', 4 * confirmatPerJoint(D))
    box({ kind: 'carcass', x, y: y0, z: 0, w: T, h, d: D })
    box({ kind: 'carcass', x: x + w - T, y: y0, z: 0, w: T, h, d: D })
    box({ kind: 'carcass', x: x + T, y: y0, z: 0, w: innerW, h: T, d: D })
    box({ kind: 'carcass', x: x + T, y: y0 + h - T, z: 0, w: innerW, h: T, d: D })
    box({ kind: 'back', x: x + T, y: y0 + T, z: std.grooveSetback, w: innerW, h: h - 2 * T, d: std.backT })
  }

  const hingedDoors = (section, si, x, w, y0, h, n, loft) => {
    const doorW = w / n - std.doorGap
    const doorH = h - std.doorGap
    if (!loft && doorW > std.maxDoorW) warn('doorTooWide', { section, w: r1(doorW), max: std.maxDoorW })
    part({ name: 'Door', L: doorH, W: doorW, T: FT, qty: n, material: 'Front', edges: EDGE_ALL, section, loft })
    addHw('hinge', getHingeCount(doorH) * n)
    addHw('handle', n)
    for (let k = 0; k < n; k++) {
      const hinge = n === 1 ? 'left' : k < n / 2 ? 'left' : 'right'
      box({ kind: 'door', section: si, loft, hinge, x: x + k * (w / n) + std.doorGap / 2, y: y0 + std.doorGap / 2, z: D, w: r1(doorW), h: r1(doorH), d: FT })
    }
  }

  let x = 0
  design.sections.forEach((s, si) => {
    const w = widths[si]
    const section = `S${si + 1}`
    const innerW = w - 2 * T
    if (w < std.minSectionW) warn('sectionTooNarrow', { section, w, min: std.minSectionW }, 'error')
    if (w > std.maxSectionW) warn('sectionTooWide', { section, w, max: std.maxSectionW })
    if (innerW > std.maxShelfSpan) warn('shelfSpan', { section, w: r1(innerW), max: std.maxShelfSpan })
    carcass(section, x, w, std.plinthH, bodyH, false)

    const { zones, autoH } = resolveZones(s.zones, innerH, std)
    if (autoH < 100) warn('zonesOverflow', { section, h: autoH }, autoH < 0 ? 'error' : 'warn')
    const base = std.plinthH + T
    zones.forEach((z, zi) => {
      const yb = base + z.bottom
      const yt = base + z.top
      if (zi < zones.length - 1) {
        part({ name: 'Fixed shelf', L: innerW, W: fixedShelfDepth, T, qty: 1, material: 'Carcass', edges: 'F', section })
        addHw('confirmat', 2 * confirmatPerJoint(fixedShelfDepth))
        box({ kind: 'shelf', x: x + T, y: yb - T, z: front - fixedShelfDepth, w: innerW, h: T, d: fixedShelfDepth })
      }
      if (z.type === 'shelves' && z.n > 0) {
        const gap = (z.h - z.n * T) / (z.n + 1)
        if (gap < std.minShelfGap) warn('shelvesTooClose', { section, gap: r1(gap), min: std.minShelfGap })
        part({ name: 'Shelf', L: innerW - 2 * std.shelfSideClearance, W: shelfDepth, T, qty: z.n, material: 'Carcass', edges: 'F', section })
        addHw('shelfPin', 4 * z.n)
        for (let k = 1; k <= z.n; k++) {
          box({ kind: 'shelf', x: x + T + std.shelfSideClearance, y: yb + k * gap + (k - 1) * T, z: front - std.shelfFrontSetback - shelfDepth, w: innerW - 2 * std.shelfSideClearance, h: T, d: shelfDepth })
        }
      }
      if (z.type === 'hang' || z.type === 'hang2') {
        if (usableDepth < std.minHangDepth) warn('hangDepth', { section, d: r1(usableDepth), min: std.minHangDepth })
        const rails = z.type === 'hang2' ? [yt - std.railDrop, yb + z.h / 2 - std.railDrop] : [yt - std.railDrop]
        if (z.type === 'hang' && z.h < std.minLongHangH) warn('hangShort', { section, h: z.h, min: std.minLongHangH })
        if (z.type === 'hang2' && z.h < std.minDoubleHangH) warn('doubleHangShort', { section, h: z.h, min: std.minDoubleHangH })
        const railLen = innerW - std.railDeduction
        rails.forEach((ry) => {
          railMm += railLen
          addHw('rail', 1)
          addHw('railBracket', 2)
          box({ kind: 'rail', x: x + T + std.railDeduction / 2, y: ry, z: front - usableDepth / 2, w: railLen, h: std.railDiameter, d: std.railDiameter })
        })
      }
      if (z.type === 'drawers') {
        const need = z.n * std.drawerH
        if (z.h + 0.5 < need) warn('drawersDontFit', { section, h: z.h, need })
        const spacerDepth = usableDepth - 1
        const sp = std.drawerSpacerT
        const runner = runnerLengthFor(usableDepth, std)
        const frontW = innerW - 2 * sp - 4
        const frontH = std.drawerH - std.drawerFrontGap
        const boxW = innerW - 2 * sp - 2 * std.runnerClearance
        const boxH = std.drawerH - std.drawerBoxHDeduction
        part({ name: 'Drawer spacer', L: z.h, W: spacerDepth, T: sp, qty: 2, material: 'Carcass', edges: 'F', section })
        part({ name: 'Drawer front', L: frontW, W: frontH, T: FT, qty: z.n, material: 'Front', edges: EDGE_ALL, section })
        part({ name: 'Drawer side', L: runner, W: boxH, T: std.drawerBoxT, qty: 2 * z.n, material: 'Drawer box', edges: 'F', section })
        part({ name: 'Drawer front/back', L: boxW - 2 * std.drawerBoxT, W: boxH, T: std.drawerBoxT, qty: 2 * z.n, material: 'Drawer box', edges: 'F', section })
        part({ name: 'Drawer bottom', L: runner, W: boxW, T: std.drawerBottomT, qty: z.n, material: 'Back', edges: '', section })
        addHw('runnerPair', z.n)
        addHw('drawerHandle', z.n)
        box({ kind: 'spacer', x: x + T, y: yb, z: front - spacerDepth, w: sp, h: z.h, d: spacerDepth })
        box({ kind: 'spacer', x: x + w - T - sp, y: yb, z: front - spacerDepth, w: sp, h: z.h, d: spacerDepth })
        for (let k = 0; k < z.n; k++) {
          const dy = yb + k * std.drawerH + std.drawerFrontGap / 2
          box({ kind: 'drawerBox', x: x + T + sp + std.runnerClearance, y: dy + 10, z: front - FT - runner, w: boxW, h: boxH, d: runner })
          box({ kind: 'drawerFront', x: x + T + sp + 2, y: dy, z: front - FT, w: frontW, h: frontH, d: FT })
        }
      }
    })

    let doors = 0
    if (hinged) {
      doors = hingedDoorCount(s, w, std)
      hingedDoors(section, si, x, w, std.plinthH, bodyH, doors, false)
    }
    let loftDoors = 0
    if (loftH > 0) {
      carcass(section, x, w, std.plinthH + bodyH, loftH, true)
      if (design.doorType !== 'none') {
        loftDoors = hinged ? doors : Math.max(1, Math.ceil(w / std.maxDoorW))
        hingedDoors(section, si, x, w, std.plinthH + bodyH, loftH, loftDoors, true)
      }
    }
    addHw('leg', std.legsPerSection)
    sectionsOut.push({ section, w: r1(w), innerW: r1(innerW), zones, doors, loftDoors, autoH })
    x += w
  })

  let slidingCount = 0
  if (sliding) {
    const n = Math.max(2, Math.ceil(cw / std.maxSlidingDoorW))
    slidingCount = n
    const doorW = (cw + (n - 1) * std.slidingOverlap) / n
    const doorH = bodyH - std.slidingHDeduction
    if (doorW > std.maxSlidingDoorW) warn('slidingDoorTooWide', { w: r1(doorW), max: std.maxSlidingDoorW })
    part({ name: 'Sliding door', L: doorH, W: doorW, T: FT, qty: n, material: 'Front', edges: EDGE_ALL, section: 'ALL' })
    addHw('slidingKit', n)
    addHw('slidingTrack', 2)
    const step = doorW - std.slidingOverlap
    const zFront = D - FT - 10
    const zBack = zFront - FT - 15
    for (let k = 0; k < n; k++) {
      const backTrack = k % 2 === 0
      const openDx = backTrack ? (k < n - 1 ? step : -step) : 0
      box({ kind: 'slidingDoor', x: k * step, y: std.plinthH + std.slidingHDeduction / 2, z: backTrack ? zBack : zFront, w: r1(doorW), h: r1(doorH), d: FT, openDx })
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

  const parts = aggregate(rawParts).map((p) => ({ ...p, nameAr: PART_NAMES_AR[p.name] || '' }))

  const matMap = new Map()
  const edgeMap = new Map()
  parts.forEach((p) => {
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
  if (railMm > 0) hardware.railMeters = Math.round(railMm / 100) / 10

  const summary = {
    carcassW: r1(cw),
    bodyH: r1(bodyH),
    innerH: r1(innerH),
    loftH,
    usableDepth: r1(usableDepth),
    sectionCount: design.sections.length,
    doorCount: sectionsOut.reduce((a, s) => a + s.doors + s.loftDoors, 0) + slidingCount,
    partCount: parts.reduce((a, p) => a + p.qty, 0),
  }

  return { parts, hardware, geometry, warnings, summary, sections: sectionsOut, materials, edgeBanding }
}

export function cutListCsv(result, partLabel = (p) => p.name) {
  const rows = [['#', 'Part', 'Arabic', 'Section', 'L', 'W', 'T', 'Qty', 'Material', 'Edges']]
  result.parts.forEach((p, i) => rows.push([i + 1, partLabel(p), p.nameAr, p.sections.join(' ') + (p.loft ? ' loft' : ''), p.L, p.W, p.T, p.qty, p.material, p.edges]))
  return rows.map((r) => r.map((c) => {
    const s = String(c ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }).join(',')).join('\n')
}
