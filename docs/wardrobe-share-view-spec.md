# Share 3D View for wardrobe and walk-in closet rooms

## Why

Kitchen rooms already have a "Share 3D View" link (`/view/:token`) that a customer opens without logging in. Wardrobe and closet rooms don't: the public endpoint only returns kitchen data, `KitchenShareView` only draws the kitchen 3D, and the wardrobe builder has no share button. Manufacturers need to send a customer a 3D link of a wardrobe or walk-in closet the same way, from their own WoodCalc domain.

## What exists today

- `Room.share_token` (UUID), `RoomViewSet.share_link` (POST creates or rotates, DELETE revokes) — works for any room type already.
- `public_room_share_view` in `crm/views.py` returns kitchen fields only (`room`, `walls`, `cabinets`, worktop, backsplash).
- `/view/:token` → `pages/KitchenShareView.jsx`.
- `RoomDetail.jsx` has `shareView` / revoke handlers and passes them to `KitchenPlannerModule`, but not to `WardrobeBuilder`.
- Wardrobe rooms save `planner_data = { kind: 'wardrobe', version, design, standard, materials, grandTotal, summary }` via `buildWardrobePlannerData` (`features/wardrobe/wardrobeRoom.js`). The chosen front colour (`frontColor` in `WardrobeBuilder.jsx`) is not saved.

## Backend

In `public_room_share_view`, when `planner_data.kind == 'wardrobe'` return:

```
{ name, room_type, kind: 'wardrobe', company_name, company_slug, design, standard, frontColor }
```

- `company_name` comes from `room.project.client.tenant.name`.
- Never return `grandTotal`, `materials`, prices, the cut list or anything about the client or project.
- The kitchen response stays exactly as it is today (add `company_name` to it only if it's harmless; don't remove anything).

Tests (in `crm/test_wardrobe_room.py` or a new test file):
- A shared wardrobe room returns `kind`, `design`, `standard`, `company_name`, and none of `grandTotal`, `materials`, `summary`.
- A shared closet room (`design.mode === 'closet'`) returns its full `design.closet`.
- A kitchen room's public response is unchanged.
- A revoked or unknown token returns 404.

## Frontend

1. **Save the front colour.** Add `frontColor` to `buildWardrobePlannerData`, and restore it when the builder loads a saved room (fall back to today's default when missing).
2. **Share page.** `/view/:token` keeps one route. After fetching, if `data.kind === 'wardrobe'` render a new `WardrobeShareView`; otherwise keep `KitchenShareView` exactly as it is.
3. **`WardrobeShareView`** (read-only, no login):
   - Header: company name, room name, overall size (width × height, plus room depth for closets).
   - Body: `computeDesign(design, standard)` (fall back to the default standard if `standard` is missing), then `Closet3D` for closet mode or `Wardrobe3D` for wardrobe mode, using the saved `frontColor`. Reuse the components; don't copy them.
   - Controls: Doors closed / Doors open / No doors, and for closets the Plan view as a second tab.
   - No editing tools, prices, cut list, construction labels or standard settings.
   - Light background like the builder's 3D, full-height on phones, touch orbit, Arabic/English with RTL like the kitchen share page.
   - Same not-found screen as the kitchen page for a revoked link.
4. **Share button in the builder.** Move the `shareView` / revoke logic from `RoomDetail.jsx` into a small hook (e.g. `useRoomShare(roomId, room, setRoom)`) used by both the kitchen and the wardrobe paths. Add "Share 3D View" (copy link) and "Stop sharing" to `WardrobeRoomBar`, hidden for auditors, same permissions as the kitchen button. Show a short note that the link shows the last saved version.

## Tests (vitest)

- `buildWardrobePlannerData` includes `frontColor`; loading a room without it uses the default.
- The share page picks `WardrobeShareView` for `kind: 'wardrobe'` and `KitchenShareView` otherwise.
- `WardrobeShareView` renders without prices or the cut list for a wardrobe design and for a closet design.
- All existing tests pass unchanged.

## Acceptance check

1. Build and save the long-wall closet from `docs/wardrobe-fronts-layer-spec.md` in a client room.
2. Press Share 3D View, open the copied link in a private window on a phone.
3. The page shows the company name, the closet in 3D with the chosen front colour, doors open and close, and no prices or cut list.
4. Press Stop sharing; the link shows the not-found screen.

## Working rules

- Start after PR #16 (wardrobe fronts layer) is merged; new branch `claude/wardrobe-share-view` from `main`.
- No code comments.
- Run `npm test` and `npm run build` in `woodcalc_frontend` and the Django tests for `crm` before each commit; small commits; open a PR with screenshots of the share page on a phone width.
