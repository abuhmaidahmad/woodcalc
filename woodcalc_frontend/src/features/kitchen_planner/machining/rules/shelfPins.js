// Shelf pin holes: for every adjustable shelf, blind HOLEs on the inner face
// (TOP) of both sides in two columns -- frontDistance from the front edge and
// backDistance in front of the back (the groove's front wall when the back is
// grooved) -- at the shelf's planned height (its underside) and one pitch above
// and below. Positions are worked out in the cabinet and mapped onto each side.
import { hole } from '../schema';
import { toPart } from '../parts';

export function shelfPinRule(parts, { cfg, layout }) {
  const c = cfg.shelfPins;
  const sides = parts.filter(p => p.id === 'side-left' || p.id === 'side-right');
  const shelves = parts.filter(p => p.adjustable && p.plannedHeight != null);
  if (sides.length === 0 || shelves.length === 0) return;
  const columns = [c.frontDistance, layout.backInnerY - c.backDistance];
  shelves.forEach(shelf => {
    [shelf.plannedHeight - c.pitch, shelf.plannedHeight, shelf.plannedHeight + c.pitch].forEach(z => {
      columns.forEach(y => {
        sides.forEach(side => {
          const [x, sy] = toPart(side, [side.box.x0, y, z]);
          side.machining_ops.push(hole({ face: 'TOP', x, y: sy, diameter: c.diameter, depth: c.depth, rule: 'shelf_pin' }));
        });
      });
    });
  });
}
