import { groove } from '../schema';
import { toPart } from '../parts';

const T = 18;

export function ledGrooveRule(parts, { cfg, config, layout }) {
  const g = cfg.ledGroove;
  // Shelf LEDs: a groove the full length of each wood shelf's underside, so the
  // profile sits flush with the board.
  if (config.ledStripShelves && config.subtype === 'Open Shelf' && config.shelfMaterial === 'wood') {
    parts.filter(p => p.source === 'Shelf (18mm)' && p.frame).forEach(p => {
      const [, y] = toPart(p, [p.box.x0, p.box.y0 + g.shelfFrontDistance, p.box.z1]);
      p.machining_ops.push(groove({ face: 'BOTTOM', x: 0, y, x2: p.length, y2: y, width: g.width, depth: g.depth, rule: 'led_groove' }));
    });
  }
  if (!config.ledStripInterior) return;
  const yCab = layout.backInnerY - g.backDistance;
  parts.filter(p => (p.id === 'side-left' || p.id === 'side-right') && p.frame).forEach(p => {
    const [, y] = toPart(p, [p.box.x0, yCab, p.box.z0]);
    p.machining_ops.push(groove({ face: 'TOP', x: T, y, x2: p.length - T, y2: y, width: g.width, depth: g.depth, rule: 'led_groove' }));
  });
}
