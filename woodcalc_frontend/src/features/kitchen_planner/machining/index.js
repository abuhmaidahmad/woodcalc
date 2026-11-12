// Machining layer: drilling/grooving operations for one cabinet's parts.
//
//   buildMachining(cabinetConfig, overrides) -> { parts, errors }
//
// cabinetConfig is calculateCabinet()'s input (formulaEngine cabinetConfig())
// plus what only machining needs: hingeSide / blindSide, shelfHeights
// (underside of each adjustable shelf, mm from the carcass bottom), and
// exposedSides { left, right } for visible end panels.
// Each rule adds schema.js ops to the parts' machining_ops; errors lists any op
// that fails validation (empty when everything fits its board).
import { calculateCabinet } from '../formulaEngine';
import { MACHINING_CONFIG, mergeConfig } from './config';
import { buildParts } from './parts';
import { validatePart } from './schema';
import { hingeRule } from './rules/hinge';

// Rules run in this order; each is (parts, ctx) => void.
export const RULES = [hingeRule];

// Where the carcass pieces calculateCabinet() sizes actually sit.
export function carcassLayout(result, config) {
  const side = result.panels.find(p => p.name === 'Side panel');
  const bottom = result.panels.find(p => p.name === 'Bottom panel');
  const carcassH = side ? side.width : Number(config.height);
  const bottomD = bottom ? bottom.depth : Number(config.depth);
  return {
    carcassH,
    // The back stands right behind the bottom/top panels, 1mm clear of the
    // carcass top and bottom (it is cut carcassH - 2).
    backFrontY: bottomD,
    backBottomZ: 1,
    backRailBackY: bottomD,
    bottomRailBackY: bottomD,
    // A pantry's fixed panel sits behind the lower/upper door joint, at the
    // project's base height.
    fixedPanelZ: (Number(config.baseHeight) || 800) - 18,
  };
}

export function buildMachining(config, overrides = {}, rules = RULES) {
  const cfg = mergeConfig(MACHINING_CONFIG, overrides);
  const result = calculateCabinet(config);
  const layout = carcassLayout(result, config, cfg);
  const { parts, cabinet } = buildParts(result, config, layout);
  const ctx = { config, cfg, result, layout, cabinet };
  rules.forEach(rule => rule(parts, ctx));
  const errors = parts.flatMap(validatePart);
  return { parts, errors, result };
}

export * from './schema';
export { MACHINING_CONFIG, mergeConfig } from './config';
export { hingePositions } from './rules/hinge';
export { toCabinet, toPart, shelfPlannedHeights, doorHingeSides } from './parts';
