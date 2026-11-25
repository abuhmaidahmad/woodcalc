# Closet planner: drawn walls, placed closets, kitchen materials

This replaces `docs/closet-mode-upgrade-spec.md` (never started). Its dressing-table and accessories parts are Phase 4 here.

## What Ahmad wants

1. Draw the walls in the closet builder, the same way as in the kitchen planner.
2. Put a closet at a specific place, and add another one, for example in front of it.
3. Use the same colours and materials as the kitchens.
4. An option for the front to match the carcass.

## What exists today

- Kitchen planner: `RoomCanvas.jsx` (wall drawing, snapping, typed lengths, corner/length modes, zoom, undo/redo), room elements in `KitchenPlannerModule.jsx` (`window`, `door`, `column`, service points), `Wall3D` in `KitchenPlanner3D.jsx` with real openings, `useMaterialTextureMap(companySlug)`, `MaterialLibrary.jsx` picker, `PhotoTexturedBox` / `PhotoPanelMaterial` with `texture_physical_width_mm` / `texture_physical_height_mm`, cabinet fields `carcassColor`, `frontColor`, `carcassMaterialName`, `frontMaterialName`.
- Wardrobe builder: closet mode is a fixed rectangle (`shape`, `width`, `roomDepth`) with runs on walls A/B/C and an island (`closetEngine.js`); each run is computed by `computeWardrobe`. The 3D uses flat `FRONT_COLORS` swatches. The Price tab picks board materials by role (`settings.picks` in `useWardrobePricing.js`). PR #17 adds Share 3D View and saves `frontColor`.

## Phase 1 — Kitchen materials in the wardrobe builder (wardrobe and closet modes)

- Add `design.materials = { carcass: sku, front: sku, frontMatchesCarcass: boolean }`.
- Design tab: replace the `FRONT_COLORS` swatches with the kitchen's `MaterialLibrary` picker (same catalog, same thumbnails) for Carcass and Front, plus a "Front same as carcass" toggle that hides the Front picker and uses the carcass material for every front.
- 3D (`Wardrobe3D`, `Closet3D`): textured panels through the same path as the kitchen (`useMaterialTextureMap`, `PhotoTexturedBox` / `PhotoPanelMaterial`, physical texture size, grain along the part's length); `fallback_hex` when a material has no photo.
  - Carcass material: sides, partitions, tops, bottoms, shelves, loft carcass, rails' fixing blocks.
  - Front material: doors, drawer fronts, fixed fronts, fillers, plinth, island top.
- One source of truth: the Price tab's Carcass and Front picks read from `design.materials` (no second place to pick them). Back, drawer box and spacer picks stay in the Price tab.
- Cut list, work-order pieces and contract rows show the picked material names (`materialSnapshot` already exists; extend it).
- Saved rooms keep the skus. Rooms without `design.materials` keep today's behaviour (`frontColor` from PR #17, then the default).
- Share view: load the company's materials for anonymous viewers (`PublicOrTenantScopedMixin`, `?company=<slug>`) so the customer sees the real finish. Never expose prices.

## Phase 2 — Draw the room in closet mode

- Closet mode gets a Room step that reuses `RoomCanvas` and the room elements from the kitchen planner (walls, typed lengths, snapping, undo/redo, windows, doors, columns). Reuse, don't fork: make kitchen-only props optional where needed.
- A pillar is a `column` element of any size.
- Save as `closet.room = { walls, elements, room }` in the same shape the kitchen planner saves, so the 2D canvas and `Wall3D` render it unchanged.
- Old closets (`shape`, `width`, `roomDepth`): convert on load to walls A/B/C with an open entrance, with identical cut lists. Keep their runs working until Phase 3 converts them to units.
- 3D: walls with door and window openings via `Wall3D` (light, semi-transparent so the closet stays visible), with a toggle to hide walls.

## Phase 3 — Place closets anywhere

- `closet.units = [{ id, kind: 'wardrobe' | 'island', x, y, rotation, wallIndex, design }]`, where `design` is a full wardrobe-mode design (width, height, depth, filler left/right, top filler, loft, door type, construction, back type, sections with zones and `fronts`).
- Add a closet:
  - Pick a wall: the unit snaps with its back to the wall's inner face, rotated to the wall, length defaulting to the free length along it.
  - Drag along the wall; numeric "distance from wall start / end" fields; snaps to wall ends, corners, other units' sides and opening edges.
  - Or place it free-standing anywhere, rotation snapping in 90° steps: a second closet facing the first, or two back to back. The island becomes a unit kind.
- Edit a selected unit with the existing panels (sizes, fillers, sections, `SectionEditor`, `FrontsEditor`, doors, loft, materials override).
- Checks (`ChecksCard`):
  - Overlap between units, and with walls and columns (error).
  - Unit in front of a door opening or its swing arc, or taller than a window sill in front of it (warning).
  - Walkway between facing units and to walls below `std.minWalkway` (warning).
  - Hinged doors that hit another unit when opened to 90° (warning).
- Inside corners: when two units meet, warn on overlap and offer per pair "this one runs into the corner" or "stop at the other one's face (+ corner gap)", like today's corner rule.
- Engine: compute each unit with `computeWardrobe`, label parts U1, U2… (converted old runs keep A/B/C), merge parts, hardware and price like `computeCloset` does now.
- Plan view: the room canvas with units drawn (section dividers, door swings, labels, dimensions to walls), click to select and drag. 3D places each unit with its position and rotation.

## Phase 4 — Dressing table and accessories

From the old spec: a dressing-table/desk element (top, drawers, knee space, end panels or butting onto units, mirror), and accessories (LED per metre, mirror per m², door sensors) with prices in the wardrobe standard. Desks are placed like units.

## Acceptance jobs

1. Master bedroom (end of Phase 3):
   - Draw: long wall 2500 with a 150 door frame at its right end, side wall 1870, a 335 × 450 column standing 530 from the side wall against the wall opposite the long wall.
   - Unit 1 on the long wall: depth 600, filler left 40, loft 300, hinged, sections 510 / 600 / 600 / 600 (corner shelves over shoes with the custom fronts, drawers + shelves, double hang, long hang), single doors.
   - Unit 2 in the 530 × 450 pocket between the side wall and the column, facing unit 1: 530 × 450 × 2400, fronts Open above, Door at the bottom.
   - Carcass and front from the catalog, "Front same as carcass" on. The 3D, the cut list and the share link all show the same finish.
2. Facing closets: a second 2000 free-standing unit facing unit 1 with 1200 between their fronts gives no warning; at 600 it gives the walkway and door-swing warnings.

## Working rules

- Start after PR #17 (share view) is merged. One PR per phase: `claude/closet-materials`, `claude/closet-room-walls`, `claude/closet-units`, `claude/closet-desk-accessories`, each from `main` after the previous merge.
- Before each phase, record a baseline of parts, raw parts, hardware, machining ops, geometry, warnings, pricing and work-order pieces for existing wardrobe and closet designs, and prove they're unchanged (except new fields).
- No code comments. `npm test` and `npm run build` in `woodcalc_frontend` before each commit; Django tests if the backend is touched.
- Each PR: summary, baseline result, screenshots of plan and 3D on desktop and phone width.
