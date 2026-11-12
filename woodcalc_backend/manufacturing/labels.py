"""Part labels for the workshop: one label per cut piece, printed in the order
the pieces come off the saw (each job's sheets in order, and on each sheet the
order the optimizer placed them), so the operator peels the next label for the
next piece.

Each label carries the piece ID as text and as a Code128 barcode, the cabinet,
the part name (English and Arabic), the cut size, the material and the edge
banding. Pages are label-sized (100 x 50 mm by default) for a roll label printer.
"""

import io

from reportlab.graphics.barcode import code128
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from .cutting_export import ARABIC_FONT, _fit, _split_label

LABEL_SIZE_MM = (100, 50)


def label_placements(jobs):
    """(job, layout, placement) for every piece, in cutting order."""
    out = []
    for job in jobs:
        for layout in sorted(job.layouts.all(), key=lambda l: l.sheet_index):
            for placement in sorted(layout.placements.all(), key=lambda p: p.id):
                out.append((job, layout, placement))
    return out


def edge_banding_text(eb):
    """{'T': 'Oak', 'B': 'None', 'L': 'White', 'R': 'Oak'} -> 'T+R Oak · L White'."""
    by_band = {}
    for side in ('T', 'B', 'L', 'R'):
        band = (eb or {}).get(side)
        if band and band != 'None':
            by_band.setdefault(band, []).append(side)
    return ' · '.join(f"{'+'.join(sides)} {band}" for band, sides in by_band.items()) or 'None'


def _num(d):
    return f'{float(d):g}'


def export_labels(jobs, size_mm=LABEL_SIZE_MM) -> bytes:
    w, h = size_mm[0] * mm, size_mm[1] * mm
    pad = 3 * mm
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=(w, h))
    c.setTitle('Part labels')
    placements = label_placements(jobs)
    sheets_per_job = {job.id: len(job.layouts.all()) for job in jobs}
    for job, layout, placement in placements:
        part = placement.part
        inner = w - 2 * pad
        y = h - pad - 10

        # Piece ID: the line the operator reads, and its barcode for scanning.
        c.setFont('Helvetica-Bold', 11)
        c.drawString(pad, y, _fit(c, part.piece_id or part.label or 'Part', 'Helvetica-Bold', 11, inner))
        y -= 3 + 11 * mm
        if part.piece_id:
            bar_h = 10 * mm
            barcode = code128.Code128(part.piece_id, barHeight=bar_h, barWidth=1, quiet=False)
            bar_w = min(1.0, inner / barcode.width)
            barcode = code128.Code128(part.piece_id, barHeight=bar_h, barWidth=bar_w, quiet=False)
            barcode.drawOn(c, pad, y)
        y -= 13

        english, arabic = _split_label(part.label or '')
        c.setFont('Helvetica-Bold', 9)
        name = _fit(c, english, 'Helvetica-Bold', 9, inner * 0.6)
        c.drawString(pad, y, name)
        if arabic:
            c.setFont(ARABIC_FONT, 9)
            c.drawRightString(w - pad, y, _fit(c, arabic, ARABIC_FONT, 9, inner * 0.4, shape=True))
        y -= 10

        c.setFont('Helvetica', 7.5)
        if part.cabinet:
            c.drawString(pad, y, _fit(c, f'Cabinet: {part.cabinet}', 'Helvetica', 7.5, inner))
            y -= 9
        c.setFont('Helvetica-Bold', 9)
        c.drawString(pad, y, f'{_num(part.width)} x {_num(part.height)} x {_num(job.thickness)} mm')
        c.setFont('Helvetica', 7.5)
        c.drawRightString(w - pad, y, f'Sheet {layout.sheet_index}/{sheets_per_job[job.id]}')
        y -= 9
        c.drawString(pad, y, _fit(c, f'Material: {job.material.sku} {job.material.name}'.strip(), 'Helvetica', 7.5, inner))
        y -= 9
        c.drawString(pad, y, _fit(c, f'Edge: {edge_banding_text(part.edge_banding)}', 'Helvetica', 7.5, inner))
        c.showPage()
    if not placements:
        c.setFont('Helvetica', 9)
        c.drawString(pad, h / 2, 'No optimized pieces.')
        c.showPage()
    c.save()
    return buffer.getvalue()
