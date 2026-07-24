"""
Guillotine cutting-stock optimizer.

Pure packing logic lives in `pack_parts()` and has no Django dependency,
so it can be unit tested standalone. `optimize_job()` is the thin Django-facing
wrapper that reads a CuttingJob's parts + matching stock sheets and persists
the result as CuttingLayout / PartPlacement rows.
"""

from dataclasses import dataclass, field
from decimal import Decimal


@dataclass
class Part:
    id: object          # CuttingPart.id, or any hashable ref
    width: Decimal
    height: Decimal
    grain_locked: bool
    label: str = ""


@dataclass
class FreeRect:
    x: Decimal
    y: Decimal
    width: Decimal
    height: Decimal

    @property
    def area(self):
        return self.width * self.height


@dataclass
class Placement:
    part: Part
    x: Decimal
    y: Decimal
    width: Decimal
    height: Decimal
    rotated: bool


@dataclass
class SheetResult:
    sheet_index: int
    placements: list = field(default_factory=list)
    waste_percent: Decimal = Decimal("0")


def _fits(rect: FreeRect, w: Decimal, h: Decimal) -> bool:
    return w <= rect.width and h <= rect.height


def _best_fit_rect(free_rects, w: Decimal, h: Decimal):
    """Smallest leftover area among rects that fit (w, h). Returns index or None."""
    best_idx = None
    best_leftover = None
    for i, r in enumerate(free_rects):
        if _fits(r, w, h):
            leftover = r.area - (w * h)
            if best_leftover is None or leftover < best_leftover:
                best_leftover = leftover
                best_idx = i
    return best_idx


def _split_guillotine(rect: FreeRect, w: Decimal, h: Decimal, kerf: Decimal):
    """
    Place (w, h) at rect's top-left corner, split the remaining L-shaped space
    into two guillotine-legal rects (straight cuts through the full remaining
    width or height), each shrunk by the kerf.
    Uses the "shorter leftover axis" heuristic to decide split direction.
    """
    right_w = rect.width - w - kerf
    bottom_h = rect.height - h - kerf

    results = []
    if right_w >= bottom_h:
        if right_w > 0:
            results.append(FreeRect(rect.x + w + kerf, rect.y, right_w, rect.height))
        if bottom_h > 0:
            results.append(FreeRect(rect.x, rect.y + h + kerf, w, bottom_h))
    else:
        if bottom_h > 0:
            results.append(FreeRect(rect.x, rect.y + h + kerf, rect.width, bottom_h))
        if right_w > 0:
            results.append(FreeRect(rect.x + w + kerf, rect.y, right_w, h))
    return results


def pack_parts(parts, sheet_width: Decimal, sheet_height: Decimal, kerf: Decimal,
               trim_top: Decimal = Decimal("0"), trim_left: Decimal = Decimal("0")):
    """
    parts: list[Part], each already expanded to individual units (qty flattened).
    Returns list[SheetResult].
    """
    remaining = sorted(parts, key=lambda p: p.width * p.height, reverse=True)
    sheets = []
    sheet_index = 0

    while remaining:
        sheet_index += 1
        usable_w = sheet_width - trim_left
        usable_h = sheet_height - trim_top
        free_rects = [FreeRect(trim_left, trim_top, usable_w, usable_h)]
        placements = []
        still_unplaced = []

        for part in remaining:
            candidates = [(part.width, part.height, False)]
            if not part.grain_locked:
                candidates.append((part.height, part.width, True))

            best_choice = None
            for w, h, rotated in candidates:
                idx = _best_fit_rect(free_rects, w, h)
                if idx is not None:
                    leftover = free_rects[idx].area - (w * h)
                    if best_choice is None or leftover < best_choice[4]:
                        best_choice = (idx, w, h, rotated, leftover)

            if best_choice is None:
                still_unplaced.append(part)
                continue

            idx, w, h, rotated, _ = best_choice
            rect = free_rects.pop(idx)
            placements.append(Placement(part=part, x=rect.x, y=rect.y, width=w, height=h, rotated=rotated))
            free_rects.extend(_split_guillotine(rect, w, h, kerf))

        used_area = sum(p.width * p.height for p in placements)
        sheet_area = sheet_width * sheet_height
        waste_pct = Decimal("100") - (used_area / sheet_area * Decimal("100")) if sheet_area else Decimal("0")

        sheets.append(SheetResult(sheet_index=sheet_index, placements=placements, waste_percent=waste_pct))

        if not placements and still_unplaced:
            break

        remaining = still_unplaced

    return sheets


def optimize_job(job_id):
    """
    Django-facing wrapper: reads CuttingJob + its CuttingPart rows, finds matching
    StockSheet(s) by material+thickness, runs pack_parts(), and persists the
    result as CuttingLayout / PartPlacement rows. Returns the created CuttingLayout queryset.
    """
    from manufacturing.models import CuttingJob, StockSheet, CuttingLayout, PartPlacement

    job = CuttingJob.objects.get(id=job_id)
    sheet_def = StockSheet.objects.filter(material=job.material, thickness=job.thickness).first()
    if sheet_def is None:
        raise ValueError(f"No StockSheet defined for material={job.material} thickness={job.thickness}")

    flat_parts = []
    for cp in job.parts.all():
        for _ in range(cp.quantity):
            flat_parts.append(Part(id=cp.id, width=cp.width, height=cp.height,
                                    grain_locked=cp.grain_locked, label=cp.label))

    results = pack_parts(
        flat_parts, sheet_def.width, sheet_def.height, job.kerf,
        trim_top=job.trim_top, trim_left=job.trim_left,
    )

    job.layouts.all().delete()

    created_layouts = []
    for sheet_result in results:
        layout = CuttingLayout.objects.create(
            job=job, sheet=sheet_def,
            sheet_index=sheet_result.sheet_index,
            waste_percent=sheet_result.waste_percent,
        )
        for placement in sheet_result.placements:
            PartPlacement.objects.create(
                layout=layout, part_id=placement.part.id,
                x=placement.x, y=placement.y,
                width=placement.width, height=placement.height,
                rotated=placement.rotated,
            )
        created_layouts.append(layout)

    job.status = "OPTIMIZED"
    job.save(update_fields=["status"])
    return created_layouts
