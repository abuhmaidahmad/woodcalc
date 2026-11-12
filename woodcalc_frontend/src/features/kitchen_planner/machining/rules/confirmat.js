// Confirmat joints: every panel that butts into a side panel (bottom, top,
// rails, fixed shelves -- parts marked joinsSides) is screwed through the side.
// For each joint one list of positions along the joint is worked out; the edge
// holes in the mating panel's end and the through-holes in the side are both
// placed from that list via the cabinet frame, so they always line up.
import { edgeHole, hole } from '../schema';
import { toCabinet, toPart } from '../parts';

const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

// Screw positions along a joint of the given length, from its front end: one
// endDistance from each end, plus evenly spaced middle screws when the joint is
// over middleOverLength or the ends would be more than maxSpacing apart. A
// short joint (up to shortJointMax, e.g. a 100mm rail) gets two screws
// shortJointEndDistance from its edges.
export function confirmatPositions(length, cfg) {
  if (length <= cfg.shortJointMax) return [r2(cfg.shortJointEndDistance), r2(length - cfg.shortJointEndDistance)];
  const span = length - 2 * cfg.endDistance;
  let gaps = Math.max(1, Math.ceil(span / cfg.maxSpacing));
  if (length > cfg.middleOverLength) gaps = Math.max(gaps, 2);
  return Array.from({ length: gaps + 1 }, (_, i) => r2(cfg.endDistance + (span * i) / gaps));
}

export function confirmatRule(parts, { cfg, config }) {
  const c = cfg.confirmat;
  const sides = { left: parts.find(p => p.id === 'side-left'), right: parts.find(p => p.id === 'side-right') };
  if (!sides.left || !sides.right) return;
  const exposed = config.exposedSides || {};

  parts.filter(p => p.joinsSides && p.frame).forEach(panel => {
    // The joint runs along the panel's width (its Y), on both of its ends.
    const ys = confirmatPositions(panel.width, c);
    [['LEFT', 0], ['RIGHT', panel.length]].forEach(([edge, x]) => {
      const z = panel.thickness / 2;
      // Which side this end butts into: the one whose inner face it touches.
      const xCab = toCabinet(panel, x, 0, z)[0];
      const side = Math.abs(xCab - sides.left.box.x1) < Math.abs(xCab - sides.right.box.x0) ? sides.left : sides.right;
      const skipFace = c.skipFaceHolesOnExposedSides && exposed[side.side];
      ys.forEach(y => {
        panel.machining_ops.push(edgeHole({ face: edge, x, y, z, diameter: c.edgeDiameter, depth: c.edgeDepth, rule: 'confirmat' }, panel.thickness));
        if (skipFace) return;
        const [sx, sy] = toPart(side, toCabinet(panel, x, y, z));
        side.machining_ops.push(hole({ face: 'BOTTOM', x: sx, y: sy, diameter: c.faceDiameter, depth: side.thickness, through: true, rule: 'confirmat' }));
      });
    });
  });
}
