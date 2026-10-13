import { describe, it, expect } from 'vitest'
import { needsFlip, cabTextLayout, placeBadges, cabLocalToWorld, circleHitsPoly, BADGE_R } from './badgeLayout'

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
      const placed = placeBadges(cabs, SCALE, true, walls)
      expect(placed.size).toBe(cabs.length)
      const pts = cabs.map(c => placed.get(c.id))
      pts.forEach((p, i) => pts.slice(i + 1).forEach(q => {
        expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThanOrEqual(2 * BADGE_R)
      }))
      const texts = cabs.flatMap(c => cabTextLayout(c, SCALE, true).boxes.map(b => b.map(([x, y]) => cabLocalToWorld(c, SCALE, x, y))))
      pts.forEach(p => texts.forEach(P => expect(circleHitsPoly([p.x, p.y], BADGE_R, P)).toBe(false)))
      pts.forEach(p => walls.forEach(P => expect(circleHitsPoly([p.x, p.y], BADGE_R - 2, P)).toBe(false)))
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
