// DXF export of one part and its machining_ops (schema.js) -- generated or
// imported, the same writer serves both. ASCII DXF R12, millimetres, drawn
// looking at the part's TOP face: the outline is length x width with the
// origin at the front-left corner (DXF Y up = part Y towards the BACK edge).
//
// Each op goes on a layer whose name carries what the CNC needs to map it to
// a tool, so one layer = one tool + depth:
//   HOLE       CIRCLE at (x, y)                 HOLE_<face>_D<diameter>_Z<depth> | _THRU
//   GROOVE     LINE along the centreline         GROOVE_<face>_W<width>_Z<depth>
//   EDGE_HOLE  LINE from the entry point, depth  EDGE_HOLE_<face>_D<diameter>_Z<depth>_H<z>
//              long, into the part
// BOTTOM-face ops are drawn in the same TOP-face coordinates (seen through the
// board) and are told apart by their layer name. The outline is on OUTLINE.

const num = (v) => String(Math.round(v * 1000) / 1000).replace(/^-0$/, '0');
const tag = (v) => num(v).replace('.', '_').replace('-', 'M');

export function opLayer(op) {
  if (op.type === 'HOLE') return `HOLE_${op.face}_D${tag(op.diameter)}_${op.through ? 'THRU' : `Z${tag(op.depth)}`}`;
  if (op.type === 'GROOVE') return `GROOVE_${op.face}_W${tag(op.width)}_Z${tag(op.depth)}`;
  return `EDGE_HOLE_${op.face}_D${tag(op.diameter)}_Z${tag(op.depth)}_H${tag(op.z)}`;
}

// Unit vector pointing into the part from each edge.
const INTO = { LEFT: [1, 0], RIGHT: [-1, 0], FRONT: [0, 1], BACK: [0, -1] };

function entities(part) {
  const out = [];
  const line = (layer, x1, y1, x2, y2) => out.push(['LINE', layer, [10, x1], [20, y1], [30, 0], [11, x2], [21, y2], [31, 0]]);
  const { length: L, width: W } = part;
  line('OUTLINE', 0, 0, L, 0); line('OUTLINE', L, 0, L, W); line('OUTLINE', L, W, 0, W); line('OUTLINE', 0, W, 0, 0);
  part.machining_ops.forEach(op => {
    const layer = opLayer(op);
    if (op.type === 'HOLE') out.push(['CIRCLE', layer, [10, op.x], [20, op.y], [30, 0], [40, op.diameter / 2]]);
    else if (op.type === 'GROOVE') line(layer, op.x, op.y, op.x2, op.y2);
    else {
      const [dx, dy] = INTO[op.face];
      line(layer, op.x, op.y, op.x + dx * op.depth, op.y + dy * op.depth);
    }
  });
  return out;
}

export function partToDxf(part) {
  const ents = entities(part);
  const layers = [...new Set(ents.map(e => e[1]))];
  const g = [];
  const put = (code, value) => g.push(String(code), typeof value === 'number' ? num(value) : String(value));
  put(999, `WoodCalc part ${part.id || ''} ${part.length} x ${part.width} x ${part.thickness} mm, visible face ${part.visibleFace || 'TOP'}`);
  put(0, 'SECTION'); put(2, 'HEADER');
  put(9, '$ACADVER'); put(1, 'AC1009');
  put(9, '$INSUNITS'); put(70, 4);
  put(9, '$EXTMIN'); put(10, 0); put(20, 0); put(30, 0);
  put(9, '$EXTMAX'); put(10, part.length); put(20, part.width); put(30, part.thickness);
  put(0, 'ENDSEC');
  put(0, 'SECTION'); put(2, 'TABLES');
  put(0, 'TABLE'); put(2, 'LAYER'); put(70, layers.length);
  layers.forEach((name, i) => { put(0, 'LAYER'); put(2, name); put(70, 0); put(62, (i % 6) + 1); put(6, 'CONTINUOUS'); });
  put(0, 'ENDTAB'); put(0, 'ENDSEC');
  put(0, 'SECTION'); put(2, 'ENTITIES');
  ents.forEach(([type, layer, ...pairs]) => { put(0, type); put(8, layer); pairs.forEach(([c, v]) => put(c, v)); });
  put(0, 'ENDSEC'); put(0, 'EOF');
  return g.join('\n') + '\n';
}

// One line of text per op, for lists like the CAD/CAM import screen. Older
// imports stored plain strings; those pass through unchanged.
export function formatOp(op) {
  if (op == null || typeof op !== 'object') return String(op ?? '');
  const at = `(${num(op.x)}, ${num(op.y)})`;
  if (op.type === 'HOLE') return `Hole Ø${num(op.diameter)} ${op.through ? 'through' : `× ${num(op.depth)}`} at ${at} on ${op.face}`;
  if (op.type === 'GROOVE') return `Groove ${num(op.width)} × ${num(op.depth)} from ${at} to (${num(op.x2)}, ${num(op.y2)}) on ${op.face}`;
  if (op.type === 'EDGE_HOLE') return `Edge hole Ø${num(op.diameter)} × ${num(op.depth)} at ${at}, z ${num(op.z)} on ${op.face} edge`;
  return JSON.stringify(op);
}
