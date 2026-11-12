// Turns one calculateCabinet() result into the individual parts the machining
// rules work on (a qty-2 'Side panel' becomes a left and a right side, which are
// mirror images once drilled), each with its size in the schema's part
// coordinates and -- for carcass panels -- a frame placing it in the cabinet.
//
// Cabinet coordinates (mm): x from the left side's outer face to the right
// (0..W), y from the carcass front (0) to the back (D), z up from the underside
// of the carcass (0..carcass height).
//
// A part's frame maps its own (x, y, z) -- see schema.js -- into the cabinet:
// cabinet point = origin + x * xAxis + y * yAxis + z * zAxis, where zAxis points
// into the board from its TOP face. Parts with no fixed place in the box (doors,
// pieces no rule places yet) carry frame: null.

const T = 18;

const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

// Frames for each way a panel sits in the box. In every one, part X x Y is the
// TOP face's outward normal and zAxis is its opposite.
const FRAMES = {
  // Left side: TOP is the inner face (x = T); laid inner face up with its front
  // edge towards you, the cabinet's top end is on the left.
  sideLeft: (b) => ({ origin: [b.x1, b.y0, b.z1], xAxis: [0, 0, -1], yAxis: [0, 1, 0], zAxis: [-1, 0, 0] }),
  // Right side: TOP is the inner face (x = W - T); the cabinet's bottom end is on the left.
  sideRight: (b) => ({ origin: [b.x0, b.y0, b.z0], xAxis: [0, 0, 1], yAxis: [0, 1, 0], zAxis: [1, 0, 0] }),
  // Horizontal panel, TOP = its upper face (bottom panel, rails, shelves).
  horizUp: (b) => ({ origin: [b.x0, b.y0, b.z1], xAxis: [1, 0, 0], yAxis: [0, 1, 0], zAxis: [0, 0, -1] }),
  // Horizontal panel, TOP = its lower (inner) face (top panel); cabinet right is part LEFT.
  horizDown: (b) => ({ origin: [b.x1, b.y0, b.z0], xAxis: [-1, 0, 0], yAxis: [0, 1, 0], zAxis: [0, 0, 1] }),
  // Upright panel across the box (back, sink bottom rail), TOP = its front face,
  // X along the cabinet's width, Y up the cabinet.
  upright: (b) => ({ origin: [b.x0, b.y0, b.z0], xAxis: [1, 0, 0], yAxis: [0, 0, 1], zAxis: [0, 1, 0] }),
};

function sizeFor(kind, b) {
  const dx = r2(b.x1 - b.x0), dy = r2(b.y1 - b.y0), dz = r2(b.z1 - b.z0);
  if (kind === 'sideLeft' || kind === 'sideRight') return { length: dz, width: dy, thickness: dx };
  if (kind === 'upright') return { length: dx, width: dz, thickness: dy };
  return { length: dx, width: dy, thickness: dz };
}

function placed(id, source, kind, box, visibleFace, extra = {}) {
  return {
    id, source, ...sizeFor(kind, box), visibleFace,
    frame: FRAMES[kind](box), box, machining_ops: [], ...extra,
  };
}

function loose(id, source, length, width, thickness, visibleFace, extra = {}) {
  return { id, source, length, width, thickness, visibleFace, frame: null, machining_ops: [], ...extra };
}

// Underside height (from the carcass bottom) of each adjustable shelf: the
// cabinet's own shelfHeights when it has them, else spread evenly between the
// bottom and the top like the 3D view draws them (KitchenPlanner3D HollowGlassCarcass).
export function shelfPlannedHeights(n, carcassH, shelfHeights) {
  if (Array.isArray(shelfHeights) && shelfHeights.length >= n) return shelfHeights.slice(0, n).map(r2);
  const usable = carcassH - 2 * T;
  return Array.from({ length: n }, (_, i) => r2(T + (usable * (i + 1)) / (n + 1) - T / 2));
}

// Hinge side of each door in calculateCabinet()'s door order, matching the 3D
// view's doorHinge(): a single column opens on the cabinet's hingeSide (a blind
// corner's on its blindSide); side-by-side doors alternate left/right. A tall
// split cabinet lists each column's lower then upper door.
export function doorHingeSides(doors, config) {
  if (config.subtype === 'Blind') return doors.map(() => (config.blindSide === 'right' ? 'right' : 'left'));
  const single = config.hingeSide === 'right' ? 'right' : 'left';
  if (doors.length === 0) return [];
  // Doors in one column are the cabinet's full width less the 3mm gap.
  const columns = Math.max(1, Math.round(Number(config.width) / (doors[0].width + 3)));
  if (columns === 1) return doors.map(() => single);
  // Tall split: lower/upper pairs of the same width but different heights.
  const tallSplit = doors.length === 2 * columns
    && doors.every((d, i) => i % 2 === 0 || (d.width === doors[i - 1].width && d.height !== doors[i - 1].height));
  return doors.map((_, i) => ((tallSplit ? Math.floor(i / 2) : i) % 2 === 0 ? 'left' : 'right'));
}

// Builds the parts of one cabinet. `layout` carries geometry calculateCabinet()
// doesn't return: carcass height, where the back sits, and the fixed panel's height.
export function buildParts(result, config, layout) {
  const W = Number(config.width);
  const D = Number(config.depth);
  const { carcassH } = layout;
  const parts = [];
  const between = { x0: T, x1: r2(W - T) };
  let shelfIdx = 0;
  const shelfZs = shelfPlannedHeights(
    result.panels.filter(p => p.name === 'Shelf (18mm)').reduce((n, p) => n + p.qty, 0),
    carcassH, config.shelfHeights);

  result.panels.forEach(p => {
    const th = p.thickness ?? T;
    switch (p.name) {
      case 'Side panel':
        parts.push(placed('side-left', p.name, 'sideLeft', { x0: 0, x1: th, y0: 0, y1: p.depth, z0: 0, z1: p.width }, 'BOTTOM', { side: 'left' }));
        parts.push(placed('side-right', p.name, 'sideRight', { x0: r2(W - th), x1: W, y0: 0, y1: p.depth, z0: 0, z1: p.width }, 'BOTTOM', { side: 'right' }));
        break;
      case 'Bottom panel':
        parts.push(placed('bottom', p.name, 'horizUp', { ...between, y0: 0, y1: p.depth, z0: 0, z1: th }, 'TOP', { joinsSides: true }));
        break;
      case 'Top panel':
        parts.push(placed('top', p.name, 'horizDown', { ...between, y0: 0, y1: p.depth, z0: r2(carcassH - th), z1: carcassH }, 'TOP', { joinsSides: true }));
        break;
      case 'Fixed panel':
        parts.push(placed('fixed-panel', p.name, 'horizUp', { ...between, y0: 0, y1: p.depth, z0: r2(layout.fixedPanelZ), z1: r2(layout.fixedPanelZ + th) }, 'TOP', { joinsSides: true }));
        break;
      case 'Front rail':
        parts.push(placed('front-rail', p.name, 'horizUp', { ...between, y0: 0, y1: p.depth, z0: r2(carcassH - th), z1: carcassH }, 'TOP', { joinsSides: true }));
        break;
      case 'Back rail':
        parts.push(placed('back-rail', p.name, 'horizUp', { ...between, y0: r2(layout.backRailBackY - p.depth), y1: layout.backRailBackY, z0: r2(carcassH - th), z1: carcassH }, 'TOP', { joinsSides: true }));
        break;
      case 'Bottom rail':
        // A sink's rail stands on the bottom panel at its back end.
        parts.push(placed('bottom-rail', p.name, 'upright', { ...between, y0: r2(layout.bottomRailBackY - th), y1: layout.bottomRailBackY, z0: T, z1: r2(T + p.depth) }, 'TOP', { joinsSides: true }));
        break;
      case 'Shelf (18mm)':
        for (let i = 0; i < p.qty; i++) {
          const z0 = shelfZs[shelfIdx++];
          parts.push(placed(`shelf-${shelfIdx}`, p.name, 'horizUp', { x0: r2(W / 2 - p.width / 2), x1: r2(W / 2 + p.width / 2), y0: 0, y1: p.depth, z0, z1: r2(z0 + th) }, 'TOP', { adjustable: true, plannedHeight: z0 }));
        }
        break;
      case 'Back panel (HDF)':
        parts.push(placed('back', p.name, 'upright', { x0: r2(W / 2 - p.width / 2), x1: r2(W / 2 + p.width / 2), y0: layout.backFrontY, y1: r2(layout.backFrontY + th), z0: r2(layout.backBottomZ), z1: r2(layout.backBottomZ + p.depth) }, 'TOP'));
        break;
      default:
        for (let i = 0; i < p.qty; i++) {
          const id = `${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}${p.qty > 1 ? `-${i + 1}` : ''}`;
          parts.push(loose(id, p.name, p.width, p.depth, th, 'TOP'));
        }
    }
  });

  const sides = doorHingeSides(result.doors, config);
  result.doors.forEach((d, i) => {
    if (d.glassDoor) return; // bought-in aluminium doors arrive drilled
    // Cut list order: the door's height first, then its width. TOP is the back
    // face (the one that gets drilled); the front is on show.
    parts.push(loose(`door-${i + 1}`, 'Door', d.height, d.width, T, 'BOTTOM', { hingeSide: sides[i], hingeCount: d.hinges }));
  });
  return { parts, cabinet: { W, D, carcassH } };
}

// Cabinet-space position of a point given in a part's coordinates.
export function toCabinet(part, x, y, z = 0) {
  const { origin: o, xAxis: a, yAxis: b, zAxis: c } = part.frame;
  return [0, 1, 2].map(k => r2(o[k] + x * a[k] + y * b[k] + z * c[k]));
}

// Part-space position of a cabinet point (the frame's axes are orthonormal).
export function toPart(part, p) {
  const { origin: o, xAxis: a, yAxis: b, zAxis: c } = part.frame;
  const d = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
  const dot = (u) => r2(u[0] * d[0] + u[1] * d[1] + u[2] * d[2]);
  return [dot(a), dot(b), dot(c)];
}
