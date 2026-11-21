# Wardrobe builder: custom door layout per section (fronts layer)

## Why

Today every section gets 1–2 full-height doors from the plinth to the loft, and the hinge side is decided automatically (`sideOf` in `hingedDoors`, `wardrobeEngine.js`). Real jobs need more than that. Example from a real walk-in closet: the section next to a dressing table needs a shoe door at the bottom, a fixed strip at table height, and a second door above the table, all hinged on the wall side.

Professional tools (PolyBoard, Chief Architect) treat the doors as a separate layer from the interior: the front of a section is split into rows, and each piece is a door, a fixed panel or open. This spec adds that layer to WoodCalc without changing anything for existing designs.

## Scope (v1)

- Hinged-door runs only (`doorType === 'hinged'`), body only. Loft doors stay automatic.
- Works in both Wardrobe mode and Walk-in closet mode (closet runs go through `runDesign` → `computeWardrobe`, so the section data must pass through untouched).
- Sliding doors, island drawers and external drawer fronts are not touched.

## Data model

Add two optional fields to a section:

```
section.hinge   // 'left' | 'right' — only used in auto mode when the section has 1 door. Default 'left' (today's behaviour).
section.fronts  // null | Row[] — null means auto (today's behaviour).
```

```
Row  = { h: number | null, items: Item[] }      // rows listed top → bottom, same order as zones
Item = { type: 'door' | 'fixed' | 'open', hinge?: 'left' | 'right' }
```

Rules:
- Exactly one row may have `h: null` ("Fill rest"), like zones. Row heights are front-opening heights; their sum must equal the body front height used today (`bodyH` from `std.plinthH`).
- A row has 1 or 2 items (`MAX_DOORS_PER_SECTION` stays 2). With 2 items they split the width equally.
- Hinge plates can only go on the section's left/right walls (`bayWalls`). So in a 2-item row the left door hinges left and the right door hinges right (enforce it, don't offer a choice). In a 1-item row the user picks left or right.
- Designs saved before this change have no `fronts` and no `hinge` → output must be byte-for-byte identical to today (parts, hardware, machining ops, geometry, warnings, pricing).

## Engine (`wardrobeEngine.js`)

When `section.fronts` is a non-empty array and the run is hinged:
1. Resolve row heights bottom-up from `std.plinthH` across `bodyH` (fill row takes the remainder). Warn `frontsTooTall` (error) if fixed rows exceed `bodyH`, and `frontRowTooSmall` (warn) for any row under a minimum (add `minFrontH`, default 100, to the standard and the standard editor's `sizes` group).
2. For each row and item compute width/height with `std.doorGap` exactly like `hingedDoors` does today (gap on every edge of every front).
3. `door`: emit a `Door` part (Front material, `EDGE_ALL`), hinge count `getHingeCount(doorH)` per door, hinge cups through `kit.hingeCups` using that row's `doorBottom`, and hinge plate holes through `kit.hingePlate` on the matching side wall only. Keep the existing `hingeStagger`/`sectionGrid` behaviour. Add `handle` hardware per door.
4. `fixed`: emit a new part `Fixed front` (Front material, `EDGE_ALL`). Warn `fixedFrontNoSupport` if neither its top nor bottom edge lines up (± `std.doorGap`) with a fixed shelf from the zone boundaries, so the workshop knows to add a rail behind it.
5. `open`: no part.
6. Geometry: `door` → `{ kind: 'door', hinge, ... }` per door (same shape as today so `HingedDoor` in `Wardrobe3D.jsx` keeps working). `fixed` → new kind `fixedFront`, rendered like a closed door that never opens, and hidden together with the doors in "No doors" mode.
7. `summary.doorCount` counts doors only. Add `summary.fixedFrontCount`.

In auto mode with 1 door, use `section.hinge` instead of always `'left'`.

Add `'Fixed front'` to `PART_NAMES_AR` (Arabic: لوح أمامي ثابت) and a short code in `wardrobePieces.js` (e.g. `FXF`) so work orders and the cutting optimizer pick it up. Check `wardrobePricing.js` prices fixed fronts with the same front material area as doors and that the hinge total comes from hardware.

## UI

`SectionEditor.jsx`, shown only when the run is hinged:
- Auto mode: when the section has 1 door, a Left/Right hinge toggle.
- A "Door layout" card with Auto / Custom.
- Custom: list of rows top → bottom (same look as zones): height field with "Fill rest" radio, 1 or 2 items, per item a type select (Door / Fixed / Open) and, for a single door, a hinge Left/Right toggle. Row up/down/remove, "Add row".
- "Match zones" button: build one row per zone using the zone heights (computed heights from `result.sections[si].zones`), all doors, hinge from `section.hinge`.
- Switching back to Auto sets `fronts: null`.

`WardrobeElevation.jsx` (front view): draw the front outlines per row and the standard hinge mark (two lines from the free edge meeting at the hinge side). Fixed fronts get a light hatch. Clicking a row selects it in the editor.

`Wardrobe3D.jsx` / `Closet3D.jsx`: render `fixedFront`; doors open on their own hinge side (already supported by `g.hinge`).

All new labels in `i18n/en.json` and `i18n/ar.json`.

## Tests (vitest)

- Existing `wardrobeEngine.test.js`, `wardrobeMachining.test.js`, `wardrobePieces.test.js`, `wardrobePricing.test.js`, `closetEngine.test.js` pass unchanged.
- Regression: default wardrobe and default closet designs produce identical results with and without the new code paths (no `fronts`, no `hinge`).
- Custom 3-row section (top → bottom: door fill hinge left, fixed 185, door 490 hinge left): 2 `Door` parts at the right heights, 1 `Fixed front`, hinge count = `getHingeCount(h_top) + getHingeCount(h_bottom)`, hinge plate holes only on the left wall at the hinge centres of both doors, 2 door geometry boxes with `hinge: 'left'` and 1 `fixedFront`.
- 2-item row: hinges forced left/right regardless of input.
- Rows taller than the body → `frontsTooTall` error.
- Fixed front with no fixed shelf at either edge → `fixedFrontNoSupport` warning.
- Auto mode single door with `hinge: 'right'` → door geometry and hinge plates on the right wall.

## Acceptance check with the real job

Wardrobe mode, width 2500, height 2400, depth 600, filler left 40, hinged, loft on (300), 4 sections, section 1 width 510, the others auto.
Section 1 zones top → bottom: Shelves (fill rest), Shelves h 680 with 1 shelf.
Section 1 fronts top → bottom: Door fill hinge left; Fixed 185; Door 490 hinge left.
Expected: front view and 3D show the shoe door, the fixed strip and the upper door, both doors hinged on the left (wall side); cut list has the two doors and the fixed front; hinge count and price update.

## Working rules

- New branch `claude/wardrobe-fronts-layer` from `main`.
- No code comments.
- Run `npm test` and `npm run build` in `woodcalc_frontend` before each commit; small commits; open a PR at the end with a short summary and screenshots of the front view and 3D for the acceptance job.
- No backend change should be needed (`planner_data` is stored as JSON); confirm that and say so in the PR.
