import { describe, it, expect } from 'vitest'
import { needsFlip, cabTextLayout, placeBadges, layoutPlan, cabLocalToWorld, circleHitsPoly, isDarkFill, BADGE_R } from './badgeLayout'

const SCALE = 0.16

// A corner (walls along the top and left, faces at y=0 / x=0) holding an oven tower
// with tall side panels on both sides and a thin panel along its front, plus a
// freestanding fridge with a wall cabinet above it flanked by wall side panels.
function cornerKitchen() {
  const base = { rotation: 0, frontMaterialThickness: 18, elevation: 0 }
  return [
    { ...base, id: 1, label: 'Side Panel Tall', subtype: 'Side Panel', category: 'accessories', width: 18, depth: 581, x: 0, y: 0 },
    { ...base, id: 2, label: 'Oven Tower 600', subtype: 'Oven Tower', category: 'tall', width: 600, depth: 560, x: 18, y: 0 },
    { ...base, id: 3, label: 'Side Panel Tall', subtype: 'Side Panel', category: 'accessories', width: 18, depth: 581, x: 618, y: 0 },
    { ...base, id: 4, label: 'Panel', subtype: 'Panel', category: 'accessories', width: 636, depth: 18, x: 0, y: 581 },
    { ...base, id: 5, label: 'Freestanding Fridge 700', subtype: 'Freestanding Fridge', category: 'accessories', width: 700, depth: 700, x: 1000, y: 0 },
    { ...base, id: 6, label: 'Side Panel Wall', subtype: 'Side Panel', category: 'accessories', width: 18, depth: 321, x: 982, y: 0, elevation: 1450 },
    { ...base, id: 7, label: 'Wall 700', subtype: 'Standard', category: 'wall', width: 700, depth: 300, x: 1000, y: 0, elevation: 1450 },
    { ...base, id: 8, label: 'Side Panel Wall', subtype: 'Side Panel', category: 'accessories', width: 18, depth: 321, x: 1700, y: 0, elevation: 1450 },
  ]
}
const cornerWalls = () => [
  [[-120, -120], [2000, -120], [2000, 0], [-120, 0]],
  [[-120, -120], [0, -120], [0, 1500], [-120, 1500]],
]

// Rotates the whole layout (cabinets and walls) by `deg` about the origin, the way a
// kitchen drawn against angled walls ends up.
function rotated(deg) {
  const r = deg * Math.PI / 180
  const rot = ([x, y]) => [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)]
  const cabs = cornerKitchen().map(c => {
    const [cx, cy] = rot([c.x + c.width / 2, c.y + c.depth / 2])
    return { ...c, x: cx - c.width / 2 + 3000, y: cy - c.depth / 2 + 3000, rotation: deg }
  })
  const walls = cornerWalls().map(P => P.map(p => rot(p)).map(([x, y]) => [(x + 3000) * SCALE, (y + 3000) * SCALE]))
  return { cabs, walls }
}

// Every label line's box in canvas coords, at the position layoutPlan gave it.
const labelPolys = (cabs, plan) => cabs.flatMap(c => cabTextLayout(c, SCALE, true, plan.labels.get(c.id).pivot, plan.labels.get(c.id).fontScale).boxes
  .map(b => b.map(([x, y]) => cabLocalToWorld(c, SCALE, x, y))))
// Separating-axis overlap test for two convex quads.
function quadsOverlap(A, B) {
  for (const P of [A, B]) for (let i = 0; i < 4; i++) {
    const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % 4], nx = y1 - y2, ny = x2 - x1
    const pa = A.map(([x, y]) => x * nx + y * ny), pb = B.map(([x, y]) => x * nx + y * ny)
    if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false
  }
  return true
}

describe('needsFlip', () => {
  it('flips text that would read right-to-left or top-to-bottom', () => {
    expect([0, 30, 89, 270, 300, 359, -90].map(needsFlip)).toEqual([false, false, false, false, false, false, false])
    expect([90, 120, 180, 210, 269, -180].map(needsFlip)).toEqual([true, true, true, true, true, true])
  })
})

describe('cabTextLayout', () => {
  it('runs a side panel label along its depth, reading bottom-to-top', () => {
    const sp = cornerKitchen()[0]
    expect(cabTextLayout(sp, SCALE, true).transform).toMatch(/rotate\(-90\)$/)
    expect(cabTextLayout({ ...sp, rotation: 180 }, SCALE, true).transform).toMatch(/rotate\(90\)$/)
    expect(cabTextLayout(sp, SCALE, true).lines).toHaveLength(1)
  })
  it('turns labels 180° on cabinets rotated between 90° and 270°', () => {
    const cab = cornerKitchen()[1]
    for (const [rotation, angle] of [[0, 0], [45, 0], [90, 180], [180, 180], [269, 180], [270, 0]]) {
      expect(cabTextLayout({ ...cab, rotation }, SCALE, true).transform).toMatch(new RegExp(`rotate\\(${angle}\\)$`))
    }
  })
  it('keeps every label inside its own item across the item’s long axis', () => {
    for (const cab of cornerKitchen()) {
      const { boxes } = cabTextLayout(cab, SCALE, true)
      const w = cab.width * SCALE, h = cab.depth * SCALE
      const along = h > w ? 'x' : 'y'
      for (const box of boxes) for (const [x, y] of box) {
        if (along === 'y') expect(x).toBeGreaterThanOrEqual(-0.01), expect(x).toBeLessThanOrEqual(w + 0.01)
        else expect(y).toBeGreaterThanOrEqual(-0.01), expect(y).toBeLessThanOrEqual(h + 0.01)
      }
    }
  })
})

describe('placeBadges', () => {
  for (const deg of [0, 90, 180, 270, 30, 210]) {
    it(`gives every item a badge clear of other badges, all text and walls at ${deg}°`, () => {
      const { cabs, walls } = rotated(deg)
      const plan = layoutPlan(cabs, SCALE, true, walls)
      expect(plan.badges.size).toBe(cabs.length)
      const pts = cabs.map(c => plan.badges.get(c.id))
      pts.forEach((p, i) => pts.slice(i + 1).forEach(q => {
        expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThanOrEqual(2 * BADGE_R)
      }))
      const texts = labelPolys(cabs, plan)
      pts.forEach(p => texts.forEach(P => expect(circleHitsPoly([p.x, p.y], BADGE_R, P)).toBe(false)))
      pts.forEach(p => walls.forEach(P => expect(circleHitsPoly([p.x, p.y], BADGE_R - 2, P)).toBe(false)))
      const byCab = cabs.map(c => labelPolys([c], plan))
      byCab.forEach((A, i) => byCab.slice(i + 1).forEach(B => A.forEach(a => B.forEach(b => expect(quadsOverlap(a, b)).toBe(false)))))
    })
  }
  it('falls back to a leader line when every spot near an item is taken', () => {
    // Twelve toe kicks stacked on one footprint: only the first few find a nearby spot.
    const cabs = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, label: 'Toe Kick 600', subtype: 'Toe Kick', category: 'accessories',
      width: 600, depth: 60, x: 1000, y: 1000, rotation: 0, frontMaterialThickness: 18, elevation: 0 }))
    const placed = [...placeBadges(cabs, SCALE, true, []).values()]
    expect(placed.some(p => p.leader)).toBe(true)
    placed.forEach((p, i) => placed.slice(i + 1).forEach(q => {
      expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThanOrEqual(2 * BADGE_R)
    }))
  })
  it('keeps a wall cabinet’s badge off the fridge’s under it', () => {
    const placed = placeBadges(cornerKitchen(), SCALE, true, cornerWalls().map(P => P.map(([x, y]) => [x * SCALE, y * SCALE])))
    const fridge = placed.get(5), wall = placed.get(7)
    expect(Math.hypot(fridge.x - wall.x, fridge.y - wall.y)).toBeGreaterThanOrEqual(2 * BADGE_R)
  })
})

describe('stacked labels', () => {
  // A base cabinet with a wall cabinet over it and a top panel over that, all on one footprint.
  const stack = rotation => [
    { id: 1, label: 'Base 600', subtype: 'Standard', category: 'base', width: 600, depth: 560, x: 0, y: 0, elevation: 0 },
    { id: 2, label: 'Wall 600', subtype: 'Standard', category: 'wall', width: 600, depth: 300, x: 0, y: 0, elevation: 1450 },
    { id: 3, label: 'Top Panel Wall', subtype: 'Top Panel', category: 'accessories', width: 600, depth: 321, x: 0, y: 0, elevation: 2170 },
  ].map(c => ({ ...c, rotation, frontMaterialThickness: 18 }))
  for (const rotation of [0, 210]) {
    it(`moves the upper items' labels clear of the ones below at ${rotation}°`, () => {
      const cabs = stack(rotation)
      const plan = layoutPlan(cabs, SCALE, true, [])
      expect(plan.labels.get(1).pivot).toEqual(cabTextLayout(cabs[0], SCALE, true).defaultPivot)
      const boxes = cabs.map(c => cabTextLayout(c, SCALE, true, plan.labels.get(c.id).pivot, plan.labels.get(c.id).fontScale).boxes
        .map(b => b.map(([x, y]) => cabLocalToWorld(c, SCALE, x, y))))
      for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) {
        for (const A of boxes[a]) for (const B of boxes[b]) expect(quadsOverlap(A, B)).toBe(false)
      }
      for (const p of plan.badges.values()) for (const P of boxes.flat()) expect(circleHitsPoly([p.x, p.y], BADGE_R, P)).toBe(false)
    })
  }
})

describe('isDarkFill', () => {
  it('picks out dark fills for light label text', () => {
    expect(['#2b2b2b', '#000', 'rgb(20, 20, 20)', '#1f3a5f'].map(isDarkFill)).toEqual([true, true, true, true])
    expect(['#FFFFFF', '#d7dadd', '#c9cccf', '#f0e6d2', 'url(#hatch)', undefined].map(isDarkFill)).toEqual([false, false, false, false, false, false])
  })
})

describe('cabTextLayout width line', () => {
  const cab = { label: 'Wall 450', width: 450, depth: 300, x: 0, y: 0 }
  it('skips the width line when the name already shows the width', () => {
    expect(cabTextLayout(cab, 1, true).lines.map(l => l.text)).toEqual(['Wall 450'])
  })
  it('keeps the width line when the name has no width', () => {
    expect(cabTextLayout({ ...cab, label: 'TV Unit' }, 1, true).lines.map(l => l.text)).toEqual(['TV Unit', '450mm'])
  })
})
