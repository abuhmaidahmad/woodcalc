"""
Export a CuttingJob's optimized layout to:
  - CSV parts list (per placement, per sheet) - for spreadsheets / manual cutting
  - Excel workbook for several jobs at once (a work order's materials) - opens
    in Excel, Google Sheets, Numbers and LibreOffice
  - PDF cutting diagram - one page per sheet, parts drawn to scale with labels

Both read straight from CuttingLayout / PartPlacement rows created by
manufacturing.cutting_service.optimize_job(), so run that first.
"""

import csv
import io
from pathlib import Path

import arabic_reshaper
from bidi.algorithm import get_display
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

# Part labels carry an Arabic name after the English one ("Side panel / جانب");
# Helvetica has no Arabic glyphs, so that half is drawn in Amiri.
ARABIC_FONT = "Amiri"
pdfmetrics.registerFont(TTFont(ARABIC_FONT, str(Path(__file__).parent / "fonts" / "Amiri-Regular.ttf")))


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


def _sheet_title(name, used):
    """Excel tab names: at most 31 chars, none of []:*?/\\, unique in the book."""
    base = "".join("-" if ch in '[]:*?/\\' else ch for ch in name)[:31] or "Material"
    title, n = base, 2
    while title.lower() in used:
        suffix = f" ({n})"
        title, n = base[:31 - len(suffix)] + suffix, n + 1
    used.add(title.lower())
    return title


def export_xlsx(jobs) -> bytes:
    """Returns .xlsx bytes for optimized cutting jobs: a Summary tab (sheets
    needed per material), one cut-list tab per material, and a Layouts tab with
    every placement for the saw."""
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    from openpyxl.utils import get_column_letter

    bold = Font(bold=True)
    header_fill = PatternFill("solid", fgColor="ECF0F1")

    def header(ws, cols):
        ws.append(cols)
        for cell in ws[ws.max_row]:
            cell.font = bold
            cell.fill = header_fill
        ws.freeze_panes = f"A{ws.max_row + 1}"  # a string: ws.cell() would add an empty row

    def autosize(ws):
        for i, col in enumerate(ws.columns, start=1):
            longest = max((len(str(c.value)) for c in col if c.value is not None), default=0)
            ws.column_dimensions[get_column_letter(i)].width = min(max(longest + 2, 8), 50)

    def num(d):
        return float(d) if d is not None else None

    wb = Workbook()
    summary = wb.active
    summary.title = "Summary"
    header(summary, ["Material code", "Material", "Thickness (mm)", "Sheet size (mm)", "Pieces", "Sheets"])
    layouts_rows = []
    used_titles = {"summary", "layouts"}
    total_sheets = 0

    for job in jobs:
        layouts = sorted(job.layouts.all(), key=lambda l: l.sheet_index)
        placements = [(l, p) for l in layouts for p in l.placements.all()]
        first_sheet = layouts[0].sheet if layouts else None
        size = f"{num(first_sheet.width):g} x {num(first_sheet.height):g}" if first_sheet else ""
        summary.append([job.material.sku, job.material.name, num(job.thickness), size, len(placements), len(layouts)])
        total_sheets += len(layouts)

        # Cut list: identical parts on one line, as a workshop reads it.
        cut = {}
        for _, p in placements:
            w, h = num(p.part.width), num(p.part.height)
            key = (p.part.label, w, h, p.part.grain_locked)
            cut[key] = cut.get(key, 0) + 1
        ws = wb.create_sheet(_sheet_title(job.material.sku or job.material.name, used_titles))
        ws.append([f"{job.material.sku} - {job.material.name}", f"{num(job.thickness):g}mm",
                   f"{len(layouts)} sheet(s)"])
        ws[ws.max_row][0].font = bold
        ws.append([])
        header(ws, ["Part", "Width (mm)", "Height (mm)", "Qty", "Grain locked"])
        for (label, w, h, grain), qty in sorted(cut.items(), key=lambda kv: (kv[0][0], -kv[0][1], -kv[0][2])):
            ws.append([label, w, h, qty, "Yes" if grain else "No"])
        autosize(ws)

        for l, p in placements:
            layouts_rows.append([job.material.sku, num(job.thickness), l.sheet_index, num(l.waste_percent),
                                 p.part.label, num(p.width), num(p.height), num(p.x), num(p.y),
                                 "Yes" if p.rotated else "No"])

    summary.append(["Total", None, None, None, None, total_sheets])
    for cell in summary[summary.max_row]:
        cell.font = bold
    autosize(summary)

    ws = wb.create_sheet("Layouts")
    header(ws, ["Material code", "Thickness (mm)", "Sheet #", "Waste %", "Part",
                "Width (mm)", "Height (mm)", "X", "Y", "Rotated"])
    for row in layouts_rows:
        ws.append(row)
    ws.auto_filter.ref = ws.dimensions
    autosize(ws)

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def _split_label(label):
    """'Side panel / جانب' -> ('Side panel', 'جانب'); a label with no Arabic
    half comes back as (label, '')."""
    english, sep, arabic = label.rpartition(" / ")
    if sep and any("\u0600" <= ch <= "\u06ff" for ch in arabic):
        return english, arabic
    return label, ""


def _fit(c, text, font, size, max_w, shape=False):
    """The longest start of text that fits max_w points, shaped and put in
    visual order for Arabic so the letters join and read right to left."""
    def render(t):
        return get_display(arabic_reshaper.reshape(t)) if shape else t
    while text and c.stringWidth(render(text), font, size) > max_w:
        text = text[:-1]
    return render(text.rstrip())


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

        for placement in layout.placements.all():
            x = origin_x + float(placement.x) * mm * scale
            y = origin_y + float(placement.y) * mm * scale
            w = float(placement.width) * mm * scale
            h = float(placement.height) * mm * scale

            c.rect(x, y, w, h)
            english, arabic = _split_label(placement.part.label or "")
            dims = f"{placement.width}x{placement.height}"
            if placement.rotated:
                dims += " (R)"

            # English name, Arabic name, then the size, each line drawn only
            # while it still fits inside the part.
            lines = [(english, "Helvetica", False)]
            if arabic:
                lines.append((arabic, ARABIC_FONT, True))
            lines.append((dims, "Helvetica", False))
            text_x = x + 2
            text_y = y + h - 9
            for text, font, shape in lines:
                if text_y <= y:
                    break
                c.setFont(font, 7)
                c.drawString(text_x, text_y, _fit(c, text, font, 7, w - 4, shape))
                text_y -= 8.5

        c.showPage()

    c.save()
    buffer.seek(0)
    return buffer.getvalue()
