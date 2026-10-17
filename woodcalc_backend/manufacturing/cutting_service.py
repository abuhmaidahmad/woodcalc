"""
Guillotine cutting-stock optimizer.

Pure packing logic lives in `pack_parts()` and has no Django dependency,
so it can be unit tested standalone. `optimize_job()` is the thin Django-facing
wrapper that reads a CuttingJob's parts + matching stock sheets and persists
the result as CuttingLayout / PartPlacement rows.
"""

import math
import random
import time
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


def _best_fit_rect(free_rects, w: Decimal, h: Decimal, fit_rule: str = "area"):
    """Index of the free rect (w, h) fits best, or None. 'area' leaves the least
    area over; 'short_side' leaves the thinnest sliver on one side, so the part
    hugs the rect's edge."""
    best_idx = None
    best_score = None
    for i, r in enumerate(free_rects):
        if _fits(r, w, h):
            if fit_rule == "short_side":
                score = (min(r.width - w, r.height - h), max(r.width - w, r.height - h))
            else:
                score = (r.area - (w * h),)
            if best_score is None or score < best_score:
                best_score = score
                best_idx = i
    return best_idx


def _split_guillotine(rect: FreeRect, w: Decimal, h: Decimal, kerf: Decimal,
                      split_rule: str = "leftover_axis"):
    """
    Place (w, h) at rect's top-left corner, split the remaining L-shaped space
    into two guillotine-legal rects (straight cuts through the full remaining
    width or height), each shrunk by the kerf. The first cut runs either down
    (the right offcut keeps the rect's full height) or across (the bottom offcut
    keeps its full width); split_rule decides which:
      leftover_axis      down when more is left over to the right than below
      leftover_axis_rev  the opposite
      max_area           whichever leaves the biggest single offcut
      min_area           whichever leaves the two offcuts closest in size
    """
    right_w = rect.width - w - kerf
    bottom_h = rect.height - h - kerf

    if split_rule == "leftover_axis_rev":
        cut_down = right_w < bottom_h
    elif split_rule in ("max_area", "min_area"):
        down_big = max(right_w * rect.height, bottom_h * w)
        across_big = max(bottom_h * rect.width, right_w * h)
        cut_down = down_big >= across_big if split_rule == "max_area" else down_big < across_big
    else:
        cut_down = right_w >= bottom_h

    results = []
    if cut_down:
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


def _part_can_ever_fit(part, sheet_width: Decimal, sheet_height: Decimal,
                        trim_top: Decimal, trim_left: Decimal) -> bool:
    usable_w = sheet_width - trim_left
    usable_h = sheet_height - trim_top
    if part.width <= usable_w and part.height <= usable_h:
        return True
    if not part.grain_locked and part.height <= usable_w and part.width <= usable_h:
        return True
    return False


# Orders the parts are packed in. Biggest-first is the usual best, but a few
# long thin strips can strand themselves on a sheet of their own, so the
# alternatives get a go too.
_SORT_KEYS = (
    lambda p: (p.width * p.height, max(p.width, p.height)),
    lambda p: (max(p.width, p.height), min(p.width, p.height)),
    lambda p: (p.width + p.height, max(p.width, p.height)),
    lambda p: (p.width, p.height),
    lambda p: (p.height, p.width),
)
_SPLIT_RULES = ("leftover_axis", "leftover_axis_rev", "max_area", "min_area")
_FIT_RULES = ("area", "short_side")
_SEARCH_SECONDS = 1.5


def _pack_once(remaining, sheet_width, sheet_height, kerf, trim_top, trim_left, split_rule, fit_rule):
    """One greedy pass: fills a sheet with whatever still fits, then starts the next."""
    sheets = []
    while remaining:
        free_rects = [FreeRect(trim_left, trim_top, sheet_width - trim_left, sheet_height - trim_top)]
        placements = []
        still_unplaced = []

        for part in remaining:
            candidates = [(part.width, part.height, False)]
            if not part.grain_locked:
                candidates.append((part.height, part.width, True))

            best_choice = None
            for w, h, rotated in candidates:
                idx = _best_fit_rect(free_rects, w, h, fit_rule)
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
            free_rects.extend(_split_guillotine(rect, w, h, kerf, split_rule))

        if not placements:
            return sheets, still_unplaced
        sheets.append(placements)
        remaining = still_unplaced
    return sheets, []


def pack_parts(parts, sheet_width: Decimal, sheet_height: Decimal, kerf: Decimal,
               trim_top: Decimal = Decimal("0"), trim_left: Decimal = Decimal("0")):
    """
    parts: list[Part], each already expanded to individual units (qty flattened).
    Returns (list[SheetResult], list[Part]) - the second list is parts that can
    NEVER fit on this sheet size (too large in every allowed orientation), so the
    caller should treat their presence as an error rather than silently dropping them.

    Packs the parts every way in _SORT_KEYS x _SPLIT_RULES x _FIT_RULES, then
    reshuffles the best order for up to _SEARCH_SECONDS, and keeps the layout
    with the fewest sheets; among those, the one that leaves its last sheet
    emptiest, so the offcut worth keeping is as big as it can be.
    """
    impossible = [p for p in parts if not _part_can_ever_fit(p, sheet_width, sheet_height, trim_top, trim_left)]
    packable = [p for p in parts if p not in impossible]

    best = {"score": None}

    def attempt(ordered, split_rule, fit_rule):
        sheets, unplaced = _pack_once(ordered, sheet_width, sheet_height, kerf,
                                      trim_top, trim_left, split_rule, fit_rule)
        last_used = sum(p.width * p.height for p in sheets[-1]) if sheets else 0
        score = (len(unplaced), len(sheets), last_used)
        if best["score"] is None or score < best["score"]:
            best.update(score=score, layout=(sheets, unplaced), order=ordered,
                        split_rule=split_rule, fit_rule=fit_rule)

    for sort_key in _SORT_KEYS:
        ordered = sorted(packable, key=sort_key, reverse=True)
        for split_rule in _SPLIT_RULES:
            for fit_rule in _FIT_RULES:
                attempt(ordered, split_rule, fit_rule)

    # Then keep swapping a few parts in the best order so far, until the layout
    # can't use fewer sheets (the parts' area fills that many) or time's up.
    # Seeded, so the same job always gets the same layout.
    if packable:
        usable_area = (sheet_width - trim_left) * (sheet_height - trim_top)
        min_sheets = math.ceil(sum(p.width * p.height for p in packable) / usable_area)
        rng = random.Random(0)
        deadline = time.monotonic() + _SEARCH_SECONDS
        while best["score"][1] > min_sheets and time.monotonic() < deadline:
            order = list(best["order"])
            for _ in range(rng.randint(1, 8)):
                i, j = rng.randrange(len(order)), rng.randrange(len(order))
                order[i], order[j] = order[j], order[i]
            for split_rule in _SPLIT_RULES:
                attempt(order, split_rule, best["fit_rule"])

    sheets, unplaced = best["layout"] if best["score"] else ([], [])
    impossible.extend(unplaced)

    sheet_area = sheet_width * sheet_height
    results = []
    for i, placements in enumerate(sheets, start=1):
        used_area = sum(p.width * p.height for p in placements)
        waste_pct = Decimal("100") - (used_area / sheet_area * Decimal("100")) if sheet_area else Decimal("0")
        results.append(SheetResult(sheet_index=i, placements=placements, waste_percent=waste_pct.quantize(Decimal("0.01"))))
    return results, impossible


def optimize_job(job_id):
    """
    Django-facing wrapper: reads CuttingJob + its CuttingPart rows, finds matching
    StockSheet(s) by material+thickness, runs pack_parts(), and persists the
    result as CuttingLayout / PartPlacement rows. Returns the created CuttingLayout queryset.
    """
    from manufacturing.models import CuttingJob, StockSheet, CuttingLayout, PartPlacement

    job = CuttingJob.objects.select_related('material', 'work_order').get(id=job_id)
    sheet_def = StockSheet.objects.filter(material=job.material, thickness=job.thickness).first()
    if sheet_def is None:
        # Materials picked in the planner carry their own board size, so a stock
        # sheet is just that board -- create it rather than make the user set one
        # up in admin before the material can be optimized.
        mat = job.material
        if not mat.board_width or not mat.board_height:
            raise ValueError(f"{mat.sku} has no board size set -- add its board width and height in Inventory.")
        sheet_def = StockSheet.objects.create(
            tenant=job.work_order.tenant, material=mat, thickness=job.thickness,
            width=mat.board_width, height=mat.board_height,
            grain_direction='length' if mat.has_grain else 'none',
        )

    grain_dir = sheet_def.grain_direction
    # The sheet's grain is fixed when it's first created; a material ticked as
    # grained later must not keep cutting from a grainless sheet.
    if grain_dir == 'none' and job.material.has_grain:
        grain_dir = 'length'
    # pack_parts keeps a grain-locked part's width along the sheet's width, so
    # the sheet is turned until its grain runs along that axis. 'length' is the
    # board's long side whichever field holds it (2070x2800 and 2800x2070 are
    # the same board), 'width' its short side.
    long_side_is_height = sheet_def.height > sheet_def.width
    grain_along_height = (grain_dir == 'length' and long_side_is_height) or \
        (grain_dir == 'width' and not long_side_is_height)
    pack_sheet_w, pack_sheet_h = sheet_def.width, sheet_def.height
    swapped = False
    if grain_along_height:
        pack_sheet_w, pack_sheet_h = sheet_def.height, sheet_def.width
        swapped = True

    flat_parts = []
    for cp in job.parts.all():
        effective_grain_locked = cp.grain_locked and grain_dir != 'none'
        for _ in range(cp.quantity):
            flat_parts.append(Part(id=cp.id, width=cp.width, height=cp.height,
                                    grain_locked=effective_grain_locked, label=cp.label))

    results, impossible = pack_parts(
        flat_parts, pack_sheet_w, pack_sheet_h, job.kerf,
        trim_top=job.trim_top, trim_left=job.trim_left,
    )

    if impossible:
        labels = sorted({f"{p.label} ({p.width}x{p.height})" for p in impossible})
        raise ValueError(
            "These parts exceed the stock sheet size and cannot be cut on it: "
            + ", ".join(labels)
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
            x, y, w, h = placement.x, placement.y, placement.width, placement.height
            if swapped:
                x, y, w, h = y, x, h, w
            PartPlacement.objects.create(
                layout=layout, part_id=placement.part.id,
                x=x, y=y, width=w, height=h,
                rotated=placement.rotated,
            )
        created_layouts.append(layout)

    job.status = "OPTIMIZED"
    job.save(update_fields=["status"])
    sync_job_stock(job, len(created_layouts), sheet_def)
    return created_layouts


def job_stock_reference(job):
    return f"CuttingJob #{job.id}"


def _stock_quantity_for_sheets(material, sheet_count, sheet_def):
    """Stock is counted in boards (PCS) or m² -- any other unit (meters, kg, ...)
    isn't a sheet good, so the optimizer leaves its stock alone."""
    if material.unit == "PCS":
        return Decimal(sheet_count)
    if material.unit == "M2":
        area = Decimal(sheet_def.width) * Decimal(sheet_def.height) / Decimal(1_000_000)
        return (area * sheet_count).quantize(Decimal("0.01"))
    return None


def _book_stock(material_id, delta, reference, note):
    """Takes `delta` out of stock (a negative delta puts it back) and logs the
    StockMovement; saving the material re-checks its low-stock alert."""
    from inventory.models import Material, StockMovement

    if delta == 0:
        return
    material = Material.objects.select_for_update().get(id=material_id)
    material.quantity_on_hand -= delta
    material.save(update_fields=["quantity_on_hand"])
    StockMovement.objects.create(
        material=material,
        movement_type="OUT" if delta > 0 else "IN",
        quantity=abs(delta),
        reference=reference,
        note=note,
    )


def booked_by_job(reference):
    """Net quantity already taken out of stock per material for this job."""
    from inventory.models import StockMovement

    booked = {}
    for mv in StockMovement.objects.filter(reference=reference):
        sign = 1 if mv.movement_type == "OUT" else -1 if mv.movement_type == "IN" else 0
        booked[mv.material_id] = booked.get(mv.material_id, Decimal(0)) + sign * mv.quantity
    return booked


def sync_job_stock(job, sheet_count, sheet_def):
    """Takes the sheets this job's layout uses out of stock. Re-optimizing only
    books the difference against what the job already took (and returns stock
    for a material the job no longer uses), so stock is never deducted twice.
    The optimizer page creates a fresh job on every run, so an earlier job for
    the same work order and material is a superseded re-run: its stock goes
    back before this one's is taken."""
    from django.db import transaction
    from manufacturing.models import CuttingJob

    reference = job_stock_reference(job)
    with transaction.atomic():
        earlier = CuttingJob.objects.filter(work_order=job.work_order, material=job.material).exclude(id=job.id)
        for old in earlier:
            old_ref = job_stock_reference(old)
            for material_id, qty in booked_by_job(old_ref).items():
                _book_stock(material_id, -qty, old_ref, f"Superseded by {reference} (work order {job.work_order.order_number})")
        booked = booked_by_job(reference)
        target = {}
        qty = _stock_quantity_for_sheets(job.material, sheet_count, sheet_def)
        if qty is not None:
            target[job.material_id] = qty
        for material_id in set(booked) | set(target):
            delta = target.get(material_id, Decimal(0)) - booked.get(material_id, Decimal(0))
            _book_stock(material_id, delta, reference,
                        f"{sheet_count} sheet(s) for work order {job.work_order.order_number}")


def release_job_stock(job):
    """Puts back everything a cutting job took out of stock (job deleted)."""
    from django.db import transaction

    reference = job_stock_reference(job)
    with transaction.atomic():
        for material_id, qty in booked_by_job(reference).items():
            _book_stock(material_id, -qty, reference, f"Cutting job deleted (work order {job.work_order.order_number})")
