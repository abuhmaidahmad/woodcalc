// Machining layer: drilling/grooving operations for one cabinet's parts.
//
//   buildMachining(cabinetConfig, overrides) -> { parts, errors }
//
// cabinetConfig is calculateCabinet()'s input (formulaEngine cabinetConfig())
// plus what only machining needs: hingeSide / blindSide, shelfHeights
// (underside of each adjustable shelf, mm from the carcass bottom), and
// exposedSides { left, right } for visible end panels, and constructionSettings
// (a confirmed room's frozen Room.construction_settings) when it has them.
// Each rule adds schema.js ops to the parts' machining_ops; errors lists any op
// that fails validation (empty when everything fits its board).
import { calculateCabinet, withRoomBackPanel } from '../formulaEngine';
import { MACHINING_CONFIG, mergeConfig } from './config';
import { buildParts } from './parts';
import { validatePart } from './schema';
import { hingeRule } from './rules/hinge';
import { confirmatRule } from './rules/confirmat';
import { backGrooveRule } from './rules/backGroove';
import { shelfPinRule } from './rules/shelfPins';

// Rules run in this order; each is (parts, ctx) => void.
export const RULES = [hingeRule, confirmatRule, backGrooveRule, shelfPinRule];

// Where the carcass pieces calculateCabinet() sizes actually sit.
export function carcassLayout(result, config) {
  const side = result.panels.find(p => p.name === 'Side panel');
  const bottom = result.panels.find(p => p.name === 'Bottom panel');
  const back = result.panels.find(p => p.name === 'Back panel (HDF)');
  const carcassH = side ? side.width : Number(config.height);
  const bottomD = bottom ? bottom.depth : Number(config.depth);
  const fixedPanelZ = (Number(config.baseHeight) || 800) - 18;
  const g = result.backGroove;
  if (g) {
    // Grooved: the back's rear face sits on the groove's rear wall, its lower
    // edge reaching into the bottom groove; the back rail stops at the groove's
    // front wall.
    const D = side ? side.depth : Number(config.depth);
    const grooveRear = D - g.setback;
    return {
      carcassH,
      backFrontY: grooveRear - (back ? back.thickness : 0),
      backBottomZ: 18 - g.backInto,
      backRailBackY: grooveRear - g.width,
      // The face the interior stops at: the groove's front wall.
      backInnerY: grooveRear - g.width,
      bottomRailBackY: bottomD,
      fixedPanelZ,
    };
  }
  return {
    carcassH,
    // The back stands right behind the bottom/top panels, 1mm clear of the
    // carcass top and bottom (it is cut carcassH - 2).
    backFrontY: bottomD,
    backInnerY: bottomD,
    backBottomZ: 1,
    backRailBackY: bottomD,
    bottomRailBackY: bottomD,
    // A pantry's fixed panel sits behind the lower/upper door joint, at the
    // project's base height.
    fixedPanelZ,
  };
}

export function buildMachining(config, overrides = {}, rules = RULES) {
  const cfg = mergeConfig(MACHINING_CONFIG, overrides);
  const calc = () => calculateCabinet({ ...config, backGroove: cfg.backGroove });
  const result = config.constructionSettings ? withRoomBackPanel(config.constructionSettings, calc) : calc();
  const layout = carcassLayout(result, config, cfg);
  const { parts, cabinet } = buildParts(result, config, layout);
  const ctx = { config, cfg, result, layout, cabinet };
  rules.forEach(rule => rule(parts, ctx));
  const errors = parts.flatMap(validatePart);
  return { parts, errors, result };
}

export * from './schema';
export { partToDxf, opLayer, formatOp } from './dxf';
export { MACHINING_CONFIG, mergeConfig } from './config';
export { hingePositions } from './rules/hinge';
export { confirmatPositions } from './rules/confirmat';
export { toCabinet, toPart, shelfPlannedHeights, doorHingeSides } from './parts';
