// Cabinets whose cut sizes are pinned in __fixtures__/surfaceCutSizes.json:
// the cut list as it was before backConstruction existed, which 'surface'
// must keep reproducing exactly.
const b = { cabinetType: 'base', doorStyle: 'Handle' }
export const SURFACE_CABINETS = {
  base600_1shelf: { ...b, width: 600, height: 720, depth: 560, subtype: 'Single Door', shelves: 1 },
  base800_gola: { ...b, width: 800, height: 800, depth: 600, subtype: 'Double Door', doorStyle: 'Gola', doorCount: 2 },
  base_drawers: { ...b, width: 600, height: 720, depth: 560, subtype: 'Drawers', zonePreset: { zones: [{ type: 'drawer', h: 360 }, { type: 'drawer', h: 360 }] } },
  base_sink: { ...b, width: 900, height: 720, depth: 560, subtype: 'Sink', doorCount: 2 },
  base_blind: { ...b, width: 1000, height: 720, depth: 560, subtype: 'Blind' },
  base_open: { ...b, width: 600, height: 720, depth: 560, subtype: 'Open Shelf' },
  wall600: { width: 600, height: 720, depth: 350, cabinetType: 'wall', subtype: 'Single Door', doorStyle: 'Handle', shelves: 2 },
  wall_gola: { width: 800, height: 720, depth: 350, cabinetType: 'wall', subtype: 'Double Door', doorStyle: 'Gola', doorCount: 2, shelves: 1 },
  tall_pantry: { width: 600, height: 2100, depth: 560, cabinetType: 'tall', subtype: 'Pantry', doorStyle: 'Handle', doorCount: 2, baseHeight: 800 },
  tall_oven: { width: 600, height: 2100, depth: 560, cabinetType: 'tall', subtype: 'Oven Tower', doorStyle: 'Handle', baseHeight: 800 },
}

export const cutSizes = (r) => ({
  panels: r.panels.map(p => [p.name, p.qty, p.width, p.depth, p.thickness]),
  doors: r.doors.map(d => [d.width, d.height]),
  drawerFronts: r.drawerFronts.map(d => [d.width, d.height]),
})
