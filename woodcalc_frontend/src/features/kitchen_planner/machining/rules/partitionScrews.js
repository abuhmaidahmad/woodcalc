import { edgeHole, hole } from '../schema';
import { toCabinet, toPart } from '../parts';
import { confirmatPositions } from './confirmat';

export function partitionScrewRule(parts, { cfg }) {
  const c = cfg.confirmat;
  const fixed = parts.filter(p => p.source === 'Fixed panel' && p.frame);
  if (fixed.length === 0) return;
  parts.filter(p => p.screwedToFixedPanels && p.frame).forEach(partition => {
    const ys = confirmatPositions(partition.width, c);
    [['LEFT', 0], ['RIGHT', partition.length]].forEach(([edge, x]) => {
      const z = partition.thickness / 2;
      const zCab = toCabinet(partition, x, 0, z)[2];
      const panel = fixed.find(f => Math.abs(f.box.z1 - zCab) < 0.5 || Math.abs(f.box.z0 - zCab) < 0.5);
      if (!panel) return;
      const below = Math.abs(panel.box.z1 - zCab) < 0.5;
      ys.forEach(y => {
        partition.machining_ops.push(edgeHole({ face: edge, x, y, z, diameter: c.edgeDiameter, depth: c.edgeDepth, rule: 'confirmat' }, partition.thickness));
        const [px, py] = toPart(panel, toCabinet(partition, x, y, z));
        panel.machining_ops.push(hole({ face: below ? 'BOTTOM' : 'TOP', x: px, y: py, diameter: c.faceDiameter, depth: panel.thickness, through: true, rule: 'confirmat' }));
      });
    });
  });
}
