// CNC export of one work order: a ZIP with one DXF per piece, named by its
// piece ID (the ID on its label and in the cutting layout), plus parts.csv --
// part ID, cabinet, part name, L x W x T, material and how many machining ops.
// Pieces the CNC doesn't drill still get a DXF (their outline), so every piece
// in the cut list has a file. errors lists buildMachining's problems, piece by
// piece, so they can be shown before anything is sent to the machine.
import { workOrderPieces } from './pieces';
import { partToDxf } from './dxf';
import { makeZip } from './zip';

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function partsCsv(pieces) {
  const rows = [['Part ID', 'Cabinet', 'Part name', 'L x W x T (mm)', 'Material', 'Ops']];
  pieces.forEach(p => rows.push([
    p.id, p.cabinet, p.name, `${p.length} x ${p.width} x ${p.thickness}`, p.sku || p.materialName,
    p.part ? p.part.machining_ops.length : 0,
  ]));
  // The byte-order mark makes Excel read it as UTF-8.
  return '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function pieceDxf(p) {
  const part = p.part || { length: p.length, width: p.width, thickness: p.thickness, visibleFace: 'TOP', machining_ops: [] };
  return partToDxf({ ...part, id: p.id });
}

// { pieces, errors: [{ id, message }], files: [{ name, data }] }
export function cncExport(workOrder, room) {
  const pieces = workOrderPieces(workOrder, room);
  const errors = pieces.flatMap(p => p.errors.map(message => ({ id: p.id, message })));
  const files = [
    ...pieces.map(p => ({ name: `${p.id}.dxf`, data: pieceDxf(p) })),
    { name: 'parts.csv', data: partsCsv(pieces) },
  ];
  return { pieces, errors, files };
}

export function cncZip(files) {
  return makeZip(files);
}
