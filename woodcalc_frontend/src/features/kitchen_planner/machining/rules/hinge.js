// Hinge cups: one blind HOLE per hinge on each door's back face (part TOP).
// A door part is cut height x width, so X runs up the door from its bottom edge
// and Y across it from its cabinet-left edge (Y = 0); a left-hinged door's cups
// sit edgeDistance in from Y = 0, a right-hinged door's from Y = width.
// The end hinges are endDistance from the top and bottom; any others are spread
// evenly between them.
import { getHingeCount } from '../../formulaEngine';
import { hole } from '../schema';

export function hingePositions(doorHeight, cfg) {
  const n = getHingeCount(doorHeight);
  const first = cfg.endDistance, last = doorHeight - cfg.endDistance;
  return Array.from({ length: n }, (_, i) => first + ((last - first) * i) / (n - 1));
}

export function hingeRule(parts, { cfg }) {
  const c = cfg.hinge;
  parts.filter(p => p.source === 'Door').forEach(door => {
    const y = door.hingeSide === 'right' ? door.width - c.edgeDistance : c.edgeDistance;
    hingePositions(door.length, c).forEach(x => {
      door.machining_ops.push(hole({ face: 'TOP', x, y, diameter: c.cupDiameter, depth: c.cupDepth, rule: 'hinge' }));
    });
  });
}
