import { groove } from '../schema';
import { toPart } from '../parts';

const T = 18;

export function ledGrooveRule(parts, { cfg, config, layout }) {
  if (!config.ledStripInterior) return;
  const g = cfg.ledGroove;
  const yCab = layout.backInnerY - g.backDistance;
  parts.filter(p => (p.id === 'side-left' || p.id === 'side-right') && p.frame).forEach(p => {
    const [, y] = toPart(p, [p.box.x0, yCab, p.box.z0]);
    p.machining_ops.push(groove({ face: 'TOP', x: T, y, x2: p.length - T, y2: y, width: g.width, depth: g.depth, rule: 'led_groove' }));
  });
}
