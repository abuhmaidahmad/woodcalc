# Walk-in closet mode upgrade: fillers, obstacles, free pieces, dressing table, accessories

## Why

Real walk-in closets are not three clean runs on a rectangle. The job that drove this spec (master bedroom, room 2500 × 1870 × 2400):

- A 2500 wall with a wardrobe run: 40 mm filler at the side wall, sections 510 / 600 / 600 / 600, and a 150 mm door frame at the other end that the run must stop before.
- A pillar 335 wide × 450 deep standing against the entrance side, 530 from the side wall.
- The 530 × 450 pocket between the side wall and the pillar holds a separate unit facing the wardrobe: a shoe cabinet below 750 and a lit open niche above.
- A dressing table 820 long × 530 deep (top at 750, two drawers, knee space, backlit mirror) on the side wall between the wardrobe and that unit.

Today closet mode can only make one rectangle with runs on walls A/B/C and an island. This spec adds what's missing so a job like this is one design: one plan, one 3D, one cut list, one price, and (with `docs/wardrobe-share-view-spec.md`) one customer link.

## What exists today

`features/wardrobe/closetEngine.js` (`closetLayout`, `runDesign`, `computeCloset`, `wallFrames` with walls A back / B left / C right / E entrance, coordinates in mm with A along y = 0), `ClosetEditor.jsx`, `ClosetPlan.jsx`, `Closet3D.jsx` (`Placed` with origin + angle around `RunGeometry`). `runDesign` hard-codes `fillerLeft: 0, fillerRight: 0`. Shapes are `straight` (A), `L` (B + A), `U` (B + A + C).

## Build it in four phases, one PR each

Every phase must leave existing saved closets byte-for-byte identical (parts, raw parts, hardware, machining ops, geometry, warnings, pricing, work-order pieces). Record a baseline on `main` first, as done for the fronts layer, and add a permanent regression test.

### Phase 1 — Run fillers and shapes

- Each run gets `fillerStart` and `fillerEnd` (mm, default 0), passed through `runDesign` as `fillerLeft` / `fillerRight` so the wardrobe engine builds them exactly like wardrobe mode. Keep `endGap` as is (empty space, no part); fillers are front parts.
- Add shape `L-right` (A + C) next to `L` (B + A).
- Editor: filler fields per run; plan shows fillers as thin front strips with their width.

### Phase 2 — Obstacles

- `closet.obstacles: [{ id, type: 'pillar' | 'box' | 'door' | 'window', x, y, w, d, h, sill?, swing? }]` in the closet's plan coordinates.
- Pillar/box: solid block floor to `h` (default room height). Door: an opening on a wall side with an optional swing arc (`swing: 'in-left' | 'in-right' | 'out' | null`). Window: opening with sill height.
- Plan: draw them with dimensions and the door swing arc. 3D: pillars and boxes as wall-coloured blocks; doors and windows as openings in the transparent walls.
- Checks (`ChecksCard`): error when a run, piece, desk or island overlaps an obstacle in plan and height; warning when a door swing arc overlaps any furniture; walkway checks also measure to obstacles.
- Editor: "Obstacles" card with add/remove, type, position and size fields, plus click-to-select in the plan.

### Phase 3 — Free pieces and the dressing table

**Free pieces.** `closet.pieces: [{ id, x, y, rotation: 0 | 90 | 180 | 270, design }]` where `design` is a full wardrobe-mode design (width, height, depth, fillers, loft, doorType, construction, backType, sections with zones and `fronts` from PR #16). Computed with `computeWardrobe`, relabelled `P1`, `P2`… like runs, placed in plan and 3D with `Placed`. The editor reuses the run editing UI (dimensions, sections, `SectionEditor`) when a piece is selected. Pieces can stand against walls, obstacles or nothing.

**Dressing table / desk element.** `closet.desks: [{ id, x, y, rotation, w, d, h: 750, topT, drawers: 0–3, drawerH, ends: 'panels' | 'none', fascia, mirror: { w, h, backlit } | null }]`.
- Parts: top (Front material, edges F/L/R, or all edges when free-standing), end panels when `ends: 'panels'`, fascia rail, drawer fronts and boxes through the same drawer-system code as wardrobe drawers (runners from the selected `DrawerSystem`).
- Knee space stays open; warn if a drawer row leaves less than 600 knee height.
- A desk may butt onto a run or piece: when its end meets a carcass, drop that end panel and let the top rest on the carcass (no duplicate part), with a check that the carcass side is at least as deep as the desk.
- 3D and plan like other elements; contract rows get a "Dressing table" line.

### Phase 4 — Accessories

- `accessories` on runs, pieces and desks: `led` (per shelf row or under the top shelf, length in metres from the section widths), `mirror` (on a desk wall, or inside or outside a door, size in mm), `doorSensor` (count).
- Prices in the wardrobe standard (`priceLedPerM`, `priceMirrorPerM2`, `priceDoorSensor`), editable in the standard editor, flowing into `wardrobePricing.js` and the price tab like hinges.
- 3D: LED as a thin emissive strip (never `castShadow` on per-strip lights), mirrors as reflective panels.

## Acceptance job (end of Phase 4)

Build the master bedroom job above as one closet design:

- Room width 2500 (wall A), depth 1870, height 2400, shape straight.
- Run A: depth 600, filler start 40, end gap 150 for the door frame, hinged, loft 300, sections 510 / 600 / 600 / 600 (corner shelves over shoes with the fronts layout from PR #16, drawers + shelves, double hang, long hang).
- Pillar obstacle 335 × 450 against the entrance side, 530 from wall B.
- Piece P1 in the pocket between wall B and the pillar, rotated to face wall A: 530 × 450 × 2400, hinged, fronts: Open (fill) above, Door about 600 at the bottom; LED under each niche shelf.
- Desk on wall B between run A and P1: 820 × 530, top 750, 2 drawers, both ends butting onto the run and P1, backlit mirror 600 × 900.

Expected: no overlap errors, the plan and 3D match the drawings in `docs/screenshots/` if provided, and the cut list, hardware and price include the desk, the piece, the fillers and the accessories.

## Working rules

- Start after PR #16 is merged. Branches `claude/closet-fillers-shapes`, `claude/closet-obstacles`, `claude/closet-pieces-desk`, `claude/closet-accessories`, each from `main` after the previous one is merged.
- No code comments. `npm test` and `npm run build` in `woodcalc_frontend` before each commit; Django tests if the backend is touched (it shouldn't need to be: `planner_data` is JSON).
- Each PR: summary, the regression baseline result, and screenshots of plan and 3D.
