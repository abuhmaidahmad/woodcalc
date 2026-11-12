// Back panel groove: with a grooved back (calculateCabinet's backGroove, set by
// the company's backConstruction) one GROOVE on the inner face of each side,
// the top and the bottom, running the panel's full length. Width is the back's
// thickness plus clearance; the rear wall of the groove is setback from the
// panel's back edge. Cabinets without one (surface backs, open boxes, sinks) get none.
import { groove } from '../schema';
import { toPart } from '../parts';

const GROOVED = ['side-left', 'side-right', 'top', 'bottom'];

export function backGrooveRule(parts, { result }) {
  const g = result.backGroove;
  if (!g) return;
  const side = parts.find(p => p.id === 'side-left');
  if (!side) return;
  // Centreline in cabinet space, then into each panel's own Y.
  const yCab = side.box.y1 - g.setback - g.width / 2;
  parts.filter(p => GROOVED.includes(p.id) && p.frame).forEach(p => {
    const [, y] = toPart(p, [p.box.x0, yCab, p.box.z0]);
    p.machining_ops.push(groove({ face: 'TOP', x: 0, y, x2: p.length, y2: y, width: g.width, depth: g.depth, rule: 'back_groove' }));
  });
}
