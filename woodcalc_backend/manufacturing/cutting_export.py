"""
Export a CuttingJob's optimized layout to:
  - CSV parts list (per placement, per sheet) - for spreadsheets / manual cutting
  - PDF cutting diagram - one page per sheet, parts drawn to scale with labels

Both read straight from CuttingLayout / PartPlacement rows created by
manufacturing.cutting_service.optimize_job(), so run that first.
"""

import csv
import io

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


def export_csv(job_id) -> str:
    """Returns CSV text: one row per placed part, grouped by sheet."""
    from manufacturing.models import CuttingJob

    job = CuttingJob.objects.select_related("material").prefetch_related(
        "layouts__placements__part"
    ).get(id=job_id)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "Sheet #", "Part Label", "Width (mm)", "Height (mm)",
        "X", "Y", "Rotated", "Material", "Thickness (mm)",
    ])

    for layout in job.layouts.all().order_by("sheet_index"):
        for placement in layout.placements.all():
            writer.writerow([
                layout.sheet_index,
                placement.part.label,
                placement.width,
                placement.height,
                placement.x,
                placement.y,
                "Yes" if placement.rotated else "No",
                job.material.sku,
                job.thickness,
            ])

    return buffer.getvalue()


def export_pdf(job_id) -> bytes:
    """Returns PDF bytes: one landscape page per sheet, parts drawn to scale."""
    from manufacturing.models import CuttingJob

    job = CuttingJob.objects.select_related("material").prefetch_related(
        "layouts__sheet", "layouts__placements__part"
    ).get(id=job_id)

    buffer = io.BytesIO()
    page_size = landscape(A4)
    page_w, page_h = page_size
    c = canvas.Canvas(buffer, pagesize=page_size)

    margin = 15 * mm
    label_space = 12 * mm
    available_w = page_w - 2 * margin
    available_h = page_h - 2 * margin - label_space

    for layout in job.layouts.all().order_by("sheet_index"):
        sheet_w = float(layout.sheet.width)
        sheet_h = float(layout.sheet.height)

        scale = min(available_w / (sheet_w * mm), available_h / (sheet_h * mm))
        scale = min(scale, 1.0)

        origin_x = margin
        origin_y = margin

        c.setFont("Helvetica-Bold", 11)
        c.drawString(
            margin, page_h - margin + 2 * mm,
            f"Job {job.id} - Sheet {layout.sheet_index} - "
            f"{job.material.sku} {job.thickness}mm - Waste {layout.waste_percent}%",
        )

        c.setLineWidth(1)
        c.rect(origin_x, origin_y, sheet_w * mm * scale, sheet_h * mm * scale)

        c.setFont("Helvetica", 7)
        for placement in layout.placements.all():
            x = origin_x + float(placement.x) * mm * scale
            y = origin_y + float(placement.y) * mm * scale
            w = float(placement.width) * mm * scale
            h = float(placement.height) * mm * scale

            c.rect(x, y, w, h)
            label = f"{placement.part.label}"
            dims = f"{placement.width}x{placement.height}"
            if placement.rotated:
                dims += " (R)"

            text_x = x + 2
            text_y = y + h - 9
            if text_y > y:
                c.drawString(text_x, text_y, label[:20])
                c.drawString(text_x, text_y - 8, dims)

        c.showPage()

    c.save()
    buffer.seek(0)
    return buffer.getvalue()
