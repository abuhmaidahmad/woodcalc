import { computeWardrobe, PART_NAMES_AR } from './wardrobeEngine'

const num = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
const r1 = (n) => Math.round(n * 10) / 10

export const DESK_SIDES = ['left', 'right', 'none']

export function defaultDeskDesign(std) {
  return {
    width: 1200,
    depth: 500,
    height: num(std.deskTopH, 750),
    drawers: 3,
    drawerW: 450,
    drawerSide: 'right',
    endLeft: true,
    endRight: true,
    drawerSystem: null,
    mirror: { enabled: false, w: 800, h: 1000, elevation: 1000 },
  }
}

export function pedestalDesign(desk, std) {
  const n = Math.max(1, Math.round(num(desk.drawers, 1)))
  return {
    width: num(desk.drawerW),
    height: num(desk.height) - std.frontT,
    depth: num(desk.depth),
    fillerLeft: 0,
    fillerRight: 0,
    topFiller: 0,
    loft: false,
    loftH: 0,
    doorType: 'none',
    drawerStyle: 'external',
    drawerSystem: desk.drawerSystem || null,
    construction: 'boxes',
    backType: 'full',
    sections: [{ preset: null, zones: [{ type: 'drawers', n, h: n * std.drawerH, auto: true }], w: null, doors: null }],
  }
}

export function computeDesk(desk, std) {
  const W = num(desk.width)
  const D = num(desk.depth)
  const H = num(desk.height)
  const FT = std.frontT
  const T = std.carcassT
  const left = desk.endLeft ? FT : 0
  const right = desk.endRight ? FT : 0
  const parts = []
  const geometry = []
  const warnings = []
  const add = (p) => { if (p.L > 0 && p.W > 0 && p.qty > 0) parts.push({ ...p, L: r1(p.L), W: r1(p.W) }) }

  add({ name: 'Desk top', L: W, W: D, T: FT, qty: 1, material: 'Front', edges: 'F,L,R' })
  geometry.push({ kind: 'deskTop', x: 0, y: H - FT, z: 0, w: W, h: FT, d: D })
  const ends = (desk.endLeft ? 1 : 0) + (desk.endRight ? 1 : 0)
  add({ name: 'Desk end panel', L: H - FT, W: D, T: FT, qty: ends, material: 'Front', edges: 'F' })
  if (desk.endLeft) geometry.push({ kind: 'deskEnd', x: 0, y: 0, z: 0, w: FT, h: H - FT, d: D })
  if (desk.endRight) geometry.push({ kind: 'deskEnd', x: W - FT, y: 0, z: 0, w: FT, h: H - FT, d: D })
  const modH = Math.min(num(std.deskModestyH), H - FT)
  add({ name: 'Desk modesty panel', L: W - left - right, W: modH, T, qty: 1, material: 'Carcass', edges: '' })
  geometry.push({ kind: 'carcass', x: left, y: H - FT - modH, z: 0, w: W - left - right, h: modH, d: T })

  let pedestal = null
  const drawers = Math.round(num(desk.drawers))
  const side = DESK_SIDES.includes(desk.drawerSide) ? desk.drawerSide : 'right'
  if (drawers > 0 && side !== 'none') {
    const design = pedestalDesign(desk, std)
    const result = computeWardrobe(design, std)
    const x = side === 'left' ? left : W - right - design.width
    pedestal = { design, result, x }
    result.geometry.forEach((g) => geometry.push({ ...g, x: g.x + x }))
  }

  const pedW = pedestal ? pedestal.design.width : 0
  const knee = r1(W - left - right - pedW)
  if (knee < num(std.minKneeW)) warnings.push({ code: 'deskKneeNarrow', level: knee <= 0 ? 'error' : 'warn', params: { w: knee, min: num(std.minKneeW) } })

  const hardware = {}
  const m = desk.mirror || {}
  if (m.enabled && num(m.w) > 0 && num(m.h) > 0) {
    add({ name: 'Mirror', L: num(m.h), W: num(m.w), T: std.mirrorT, qty: 1, material: 'Mirror', edges: '' })
    geometry.push({ kind: 'mirror', x: (W - num(m.w)) / 2, y: num(m.elevation, H + 150), z: -std.mirrorT - 2, w: num(m.w), h: num(m.h), d: std.mirrorT })
    hardware.mirrorM2 = Math.round(((num(m.w) * num(m.h)) / 1e6) * 100) / 100
  }

  return {
    parts: parts.map((p) => ({ ...p, nameAr: PART_NAMES_AR[p.name] || '' })),
    geometry,
    warnings,
    hardware,
    pedestal,
    knee,
  }
}
