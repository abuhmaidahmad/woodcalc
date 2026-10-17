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


def _part_can_ever_fit(part, sheet_width: Decimal, sheet_height: Decimal,
                        trim_top: Decimal, trim_left: Decimal) -> bool:
    usable_w = sheet_width - trim_left
    usable_h = sheet_height - trim_top
    if part.width <= usable_w and part.height <= usable_h:
        return True
    if not part.grain_locked and part.height <= usable_w and part.width <= usable_h:
        return True
    return False


def pack_parts(parts, sheet_width: Decimal, sheet_height: Decimal, kerf: Decimal,
               trim_top: Decimal = Decimal("0"), trim_left: Decimal = Decimal("0")):
    """
    parts: list[Part], each already expanded to individual units (qty flattened).
    Returns (list[SheetResult], list[Part]) - the second list is parts that can
    NEVER fit on this sheet size (too large in every allowed orientation), so the
    caller should treat their presence as an error rather than silently dropping them.
    """
    impossible = [p for p in parts if not _part_can_ever_fit(p, sheet_width, sheet_height, trim_top, trim_left)]
    remaining = sorted(
        (p for p in parts if p not in impossible),
        key=lambda p: p.width * p.height, reverse=True,
    )
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

        if not placements:
            impossible.extend(still_unplaced)
            break

        used_area = sum(p.width * p.height for p in placements)
        sheet_area = sheet_width * sheet_height
        waste_pct = Decimal("100") - (used_area / sheet_area * Decimal("100")) if sheet_area else Decimal("0")
        waste_pct = waste_pct.quantize(Decimal("0.01"))

        sheets.append(SheetResult(sheet_index=sheet_index, placements=placements, waste_percent=waste_pct))
        remaining = still_unplaced

    return sheets, impossible


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
