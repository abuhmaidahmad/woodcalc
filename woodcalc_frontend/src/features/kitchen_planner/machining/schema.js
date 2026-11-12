// Machining operation schema -- shared by generated ops (this module's rules) and
// ops imported from CAD/CAM files (ImportedPart.machining_ops on the backend), so
// one exporter serves both. A part's machining_ops is a plain list of these objects.
//
// Part coordinate system (see CONTEXT.md, "Machining layer"):
//   origin = front-left corner of the part's TOP face
//   X      = along the part's length (the cut list's first dimension)
//   Y      = along the part's width  (the cut list's second dimension), Y = 0 on the FRONT edge
//   Z      = depth measured down from the TOP face (0 = TOP face, thickness = BOTTOM face)
// Edges: LEFT is x = 0, RIGHT is x = length, FRONT is y = 0, BACK is y = width.
// Which face is on show is a property of the part (part.visibleFace), not of an op.
//
// HOLE       { type, face: 'TOP'|'BOTTOM', x, y, diameter, depth, through, rule }
//            drilled into a face at (x, y); depth from that face's surface.
//            through: true for a hole right through the board (depth = thickness).
// EDGE_HOLE  { type, face: 'FRONT'|'BACK'|'LEFT'|'RIGHT', x, y, z, diameter, depth, rule }
//            (x, y) is the entry point on the edge; z is the height across the
//            thickness measured from the BOTTOM face (default thickness / 2).
//            depth runs into the part, perpendicular to the edge.
// GROOVE     { type, face: 'TOP'|'BOTTOM', x, y, x2, y2, width, depth, rule }
//            straight groove whose centreline runs (x, y) -> (x2, y2); width is
//            measured across the centreline, depth from the face's surface.
// rule names the rule that generated the op ('hinge', 'confirmat', ...) or the
// import source; it is for tracing only.

export const OP_TYPES = Object.freeze({ HOLE: 'HOLE', EDGE_HOLE: 'EDGE_HOLE', GROOVE: 'GROOVE' });
export const FACES = Object.freeze(['TOP', 'BOTTOM', 'FRONT', 'BACK', 'LEFT', 'RIGHT']);
export const BOARD_FACES = Object.freeze(['TOP', 'BOTTOM']);
export const EDGE_FACES = Object.freeze(['FRONT', 'BACK', 'LEFT', 'RIGHT']);

const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

export function hole({ face = 'TOP', x, y, diameter, depth, through = false, rule }) {
  return { type: OP_TYPES.HOLE, face, x: r2(x), y: r2(y), diameter, depth: r2(depth), through: !!through, rule };
}

export function edgeHole({ face, x, y, z, diameter, depth, rule }, thickness) {
  const zz = z ?? (thickness != null ? thickness / 2 : undefined);
  return { type: OP_TYPES.EDGE_HOLE, face, x: r2(x), y: r2(y), z: zz == null ? zz : r2(zz), diameter, depth, rule };
}

export function groove({ face = 'TOP', x, y, x2, y2, width, depth, rule }) {
  return { type: OP_TYPES.GROOVE, face, x: r2(x), y: r2(y), x2: r2(x2), y2: r2(y2), width, depth, rule };
}

const EPS = 0.01;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const near = (a, b) => Math.abs(a - b) <= EPS;

// Returns a list of problems with one op (empty when valid). With a part
// ({ length, width, thickness }) it also checks the op fits inside the board.
export function validateOp(op, part) {
  const errs = [];
  const need = (k) => { if (!isNum(op[k])) errs.push(`${k} must be a number`); };
  if (!op || !Object.values(OP_TYPES).includes(op.type)) return [`unknown op type ${op?.type}`];
  if (op.type === OP_TYPES.EDGE_HOLE) {
    if (!EDGE_FACES.includes(op.face)) errs.push(`EDGE_HOLE face must be one of ${EDGE_FACES.join('/')}`);
    ['x', 'y', 'z', 'diameter', 'depth'].forEach(need);
  } else {
    if (!BOARD_FACES.includes(op.face)) errs.push(`${op.type} face must be TOP or BOTTOM`);
    if (op.type === OP_TYPES.HOLE) {
      ['x', 'y', 'diameter', 'depth'].forEach(need);
      if (typeof op.through !== 'boolean') errs.push('through must be a boolean');
    } else {
      ['x', 'y', 'x2', 'y2', 'width', 'depth'].forEach(need);
    }
  }
  ['diameter', 'depth', 'width'].forEach(k => { if (isNum(op[k]) && op[k] <= 0) errs.push(`${k} must be positive`); });
  if (errs.length || !part) return errs;

  const { length: L, width: Wd, thickness: Th } = part;
  const inX = (x) => x >= -EPS && x <= L + EPS;
  const inY = (y) => y >= -EPS && y <= Wd + EPS;
  if (op.type === OP_TYPES.HOLE) {
    if (!inX(op.x) || !inY(op.y)) errs.push(`hole (${op.x}, ${op.y}) is off the part`);
    if (op.through && !near(op.depth, Th)) errs.push(`through hole depth ${op.depth} != thickness ${Th}`);
    if (!op.through && op.depth >= Th - EPS) errs.push(`blind hole depth ${op.depth} reaches the other face; set through`);
  } else if (op.type === OP_TYPES.GROOVE) {
    if (!inX(op.x) || !inX(op.x2) || !inY(op.y) || !inY(op.y2)) errs.push('groove runs off the part');
    if (op.depth >= Th - EPS) errs.push(`groove depth ${op.depth} cuts through ${Th}mm board`);
  } else {
    const onEdge = { LEFT: near(op.x, 0), RIGHT: near(op.x, L), FRONT: near(op.y, 0), BACK: near(op.y, Wd) }[op.face];
    if (!onEdge) errs.push(`edge hole entry (${op.x}, ${op.y}) is not on the ${op.face} edge`);
    if (!inX(op.x) || !inY(op.y)) errs.push('edge hole entry is off the part');
    if (op.z < op.diameter / 2 - EPS || op.z > Th - op.diameter / 2 + EPS) errs.push(`edge hole z ${op.z} breaks out of ${Th}mm board`);
    const reach = op.face === 'LEFT' || op.face === 'RIGHT' ? L : Wd;
    if (op.depth > reach + EPS) errs.push('edge hole is deeper than the part');
  }
  return errs;
}

// Problems with a whole part and its ops.
export function validatePart(part) {
  const errs = [];
  ['length', 'width', 'thickness'].forEach(k => { if (!isNum(part[k]) || part[k] <= 0) errs.push(`${part.id}: ${k} must be positive`); });
  if (!BOARD_FACES.includes(part.visibleFace)) errs.push(`${part.id}: visibleFace must be TOP or BOTTOM`);
  if (!Array.isArray(part.machining_ops)) errs.push(`${part.id}: machining_ops must be a list`);
  if (errs.length) return errs;
  part.machining_ops.forEach((op, i) => validateOp(op, part).forEach(e => errs.push(`${part.id} op ${i} (${op.type}): ${e}`)));
  return errs;
}
