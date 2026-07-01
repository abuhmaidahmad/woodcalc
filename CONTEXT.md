# WoodCalc — Project Context
> Drop this file in `~/woodcalc/` root. At the start of any Claude Code / VS Code / new chat session say: **"read CONTEXT.md"** to restore full context.

---

## Project Overview
**WoodCalc** — kitchen cabinet configurator + ERP SaaS platform.
- **Market:** Jordan + broader Middle East
- **Owner:** Ahmad Abu Hmaid (`ahmadabuhmaid@hotmail.com`) — cabinet manufacturing domain expert
- **Live prototype:** woodcalc-seven.vercel.app / woodcalc-production.up.railway.app
- **Repo:** `abuhmaidahmad/woodcalc` | Local: `~/woodcalc`

---

## Tech Stack
| Layer | Tech |
|---|---|
| Backend | Django + DRF, PostgreSQL — Railway |
| Frontend | React + Vite — Vercel |
| 3D Planner | React Three Fiber (R3F) + drei + Three.js |
| Mobile | React Native (planned) |
| Auth | JWT (access 24hr, refresh 30 days), `authFetch` helper with auto-refresh |
| Media | Railway persistent Volume at `/app/media` (Pillow, ephemeral FS workaround) |

---

## Django Apps
- `crm` — Customer, Project, Room, Payment models; full CRM pipeline
- `inventory` — MaterialTexture model (supplier FK, `code`, `material_type`, `fallback_hex`, `roughness`, `metalness`, `board_width`, `board_height`, `texture_physical_width_mm`, `texture_physical_height_mm`, ImageField auto-resize 2048px JPEG 85). API: `/api/inventory/textures/`
- `manufacturing` — WorkOrder, WorkOrderItem cut list, 8 production stations (Cutting → Delivery), station log, back-order support

---

## User Types (Multi-sided Marketplace)
| Type | Description |
|---|---|
| End Customer | Designs kitchen, prices it, picks manufacturer |
| Architect/Designer | Multi-project, tiered discounts |
| Manufacturer | Full ERP — CNC/CIX export, cut lists, manufacturing UI |
| Supplier | Lists materials (marketplace model) |

Ahmad's account: `user_type: manufacturer`

---

## CRM Flow
Dashboard → Customers → CustomerDetail → ProjectDetail → RoomDetail → KitchenPlannerModule

Kitchen Planner saves/restores: walls, elements, cabinets, `baseHeight`, `projectDefaults`, `grandTotal` → backend `Room` model via PATCH.

---

## Kitchen Planner 3D — Current State

### What's built
- CAD-style 2D wall drawing (Select/Draw modes, Fusion 360-style input, endpoint snapping, undo 20 steps, inline dimension editing)
- Architectural elements: windows, doors, electric, water, drain, gas, column — embedded into walls with elevation fields
- Full cabinet catalog: 7 categories (Base, Wall, Tall, Vanity, Corner, Specialty, Accessories)
- Project setup modal: base height, door style, Gola color, handle position, **search bar for material/color selection**
- `KitchenPlanner3D.jsx`: PBR rendering, MeshPhysicalMaterial, Gola L-profile geometry
- Real brand countertop materials: Silestone, Caesarstone, Dekton, Egger
- Full laminate library: Egger, Kronospan, Sonae Arauco, Finsa, Cleaf, ATG — shared between `MaterialLibrary` (door fronts) and `CountertopPicker` (worktops)
- **`materialData.js`** — single source of truth for `MATERIAL_DB` (6 laminate brands) and `COUNTERTOP_MATERIALS` (25 built-in stone/quartz). Exports: `MATERIAL_DB`, `COUNTERTOP_MATERIALS`, `COUNTERTOP_CATEGORIES`, `COUNTERTOP_BRANDS`, `lamToCt`, `ctToLam`
- Procedural wood grain texture + `PhotoTexturedBox`/`PhotoPanelMaterial` for real supplier textures
- **`useMaterialTextureMap()`** — fetches all catalog `MaterialTexture` records, keys by `t.code`, includes all model fields (incl. `texture_physical_width_mm/height_mm`)
- Floor tile presets, camera bounding box from wall coordinates
- Glass door cabinets with `meshPhysicalMaterial` transmission
- Floating shelves at 1400mm elevation
- Countertop thickness selector (16/20/30mm, default 30mm)
- Sink cabinet with 4-piece countertop + cutout + stainless bowl + faucet meshes
- **Countertop texture rendering** — `Countertop` component uses `textureMap` lookup + `mat.textureUrl` fallback; clearcoat 0.05 + envMapIntensity 0.6 for photo-textured surfaces (so grain is visible), clearcoat 0.8 + envMapIntensity 1.8 for solid stone/quartz
- **Physically correct texture tiling** — `repeatU = panelWidth / (texture_physical_width_mm / 1000)` in both `DoorPanel` and `Countertop`; default 600×600 mm tile, override per texture in Django admin
- `frontMaterialCode` threaded: `onConfirm` → `projectDefaults` → `addCabinet` → `CabinetDoors` → `DoorPanel`
- Cabinet leg height: derived from `cab.baseHeight` (720→150mm leg, 800→80mm leg)
- Skirting board system: global material picker, per-cabinet side selection, adjacency detection (15mm tolerance), seamless panel extension, BOM linear meters + corner elbows
- Interior Layout `ZonePresetPicker` scoped to Drawers/2Drw+Door subtypes

### CountertopPicker material sources
1. **My Library** — uploaded `MaterialTexture` records of type `worktop`; carries `textureUrl`, `physical_width_mm`, `physical_height_mm`
2. **Laminate brands** — `MATERIAL_DB` entries converted via `lamToCt()`; shown in brand tabs alongside stone brands
3. **Built-in stone/quartz** — `COUNTERTOP_MATERIALS` (Silestone, Caesarstone, Dekton, Egger)
- `ALL_CT_MATS` (module-level in KitchenPlanner3D) = `COUNTERTOP_MATERIALS` + all laminate mats — enables O(1) lookup by id

### BOM & Pricing
- Per-cabinet and master workshop cut list, 4-side edge banding detail
- ProposalTab: material cost/m², hardware, machining, labor, 30% margin, 16% VAT, JD/USD dual currency
- PDF/CSV export
- ContractTab: signature pad, editable payment schedule, editable T&C
- `grandTotal` lifted to `KitchenPlannerModule` state

---

## Locked Formula Engine Decisions

### Carcass
- Material: 18mm plywood OR particleboard (same formulas)
- Back panel: 8mm HDF always
- Confirmat screws: 7×50mm
- Edge banding: 1mm ABS — exposed edges only
- Plywood: front edges only banded
- Particleboard/MDF: all exposed edges banded, same carcass color
- Door/front face: banded in front color

### Panels (T=18mm)
| Panel | Formula |
|---|---|
| Side panels | H × D × 2 |
| Bottom panel | (W-2T) × (D-30-8) × 1 |
| Front rail | (W-2T) × 100 × 1 |
| Back rail | (W-2T) × 100 × 1 |
| Back panel | (W-2T-3) × (H-T-3) × 1 — 8mm HDF |
| Shelf | (W-2T) × (D-38) × n — 18mm |
| Toe kick | W × toe_kick_H × 1 — 18mm |

### Doors
- Opening height = H - T - 100 (top rail)
- Gola door height = opening - 25 - 3
- Handle/Push door height = opening - 3 - 3
- 1 door width = W-3 | 2 doors each = (W-3)/2
- Under 600mm = 1 door | 600mm = 1 default (user changeable) | over 600mm = 2 doors default
- Hinges Blum: ≤900mm=2, 901–1400=3, 1401–1800=4 per door
- Gola profile: routed into side panels, top front rail, priced per linear meter (W-2T)

### Interior Zones (visual preset picker — no dropdown)
- H720 zone unit = 180mm | H800 zone unit = 200mm
- Cut size = zone_unit - 3mm tolerance
- Valid presets: 4 drawers / 2 drawers+1 door / 2 drawers / 1 full door
- Min drawer zone 150mm | min door zone 300mm | max 4 drawers

### Drawer Box
- Wood Box: sides 12mm, back 12mm, base 8mm HDF, false front 18mm
- Legrabox/Tandembox: no false front (integrated Blum front)
- False front clearance: top-3, bottom-3 (same as doors)
- Legrabox sizes: M=175–200mm, C=380–400mm
- False front only for Wood Box

### Hardware Per Cabinet
| Item | Qty |
|---|---|
| Legs | 4 always |
| Confirmat 7×50 | 10 (3×2 sides→bottom + 1×2 sides→each rail) |
| Dowels | 10 same joints |
| Back screws | ceil((W-2T)/100) × 2 |
| Shelf pins | 4 per shelf, Blum 32mm system, start 37mm from top+bottom |
| Handle | 1 per door/drawer (Handle style only) |
| Tip-On | 1 per door/drawer (Push-to-open only) |
| Legrabox/Tandembox | 1 unit per drawer zone |
| Cam locks | Open/display cabinets only |

### Legs & Toe Kick
- H720: leg 150mm, toe kick 150mm H × 75mm D
- H800: leg 80mm, toe kick 80mm H × 75mm D
- Leg height user-adjustable for floor slope

### Supplier Model
- Supplier sets one price per material
- Customer selects supplier as source
- Door front material follows front color; other exposed sides follow carcass color

### Terminology
- Particleboard = خشب حبيبي (AR) / Particleboard (EN)

---

## 3D/Material Quality To-Do List

1. ~~**Fix wood grain texture scale mismatch**~~ ✅ **DONE** — `texture_physical_width_mm` + `texture_physical_height_mm` added to `MaterialTexture` model (migration 0004). `DoorPanel` and `Countertop` now calculate `repeatU/V = panelSize / (physicalMm / 1000)`. Admin fieldset "3D Render — Physical Texture Scale" documents the meaning. Default 600×600 mm.

2. **Build material upload UI** — replace Django admin with a proper supplier/user-facing UI for uploading material pictures.

3. ~~**Wire textures into Countertop**~~ ✅ **DONE** — `Countertop` component accepts `textureMap` prop, resolves image URL via `textureMap[mat.code || mat.id]?.texture_image || mat.textureUrl`. Clearcoat 0.05 + envMapIntensity 0.6 for photo-textured slabs; clearcoat 0.8 for solid stone.

4. **Upgrade lighting & post-processing** — swap basic lights for HDRI environment maps (`drei <Environment>`); add baked AO + roughness maps to cabinet panels; add contact shadows + subtle bloom/SSR via `@react-three/postprocessing`. Goal: close the gap with top-tier Three.js demo quality.

---

## Dev Workflow
- Ahmad runs Claude Code (VS Code extension or CLI) locally in `~/woodcalc`
- Claude has direct Bash access — can read/write files, run git, etc.
- Commits go to `main` → Vercel auto-deploys frontend, Railway auto-deploys backend + runs migrations
- Full file replacements preferred over partial diffs for large rewrites

---

## Resume Trigger
Say **"let's continue ERP woodworking system"** or **"read CONTEXT.md"** to restore full context in any session.
