// MACHINING_CONFIG -- every dimension the machining rules use, in mm. Rules read
// only from here (merged with any per-call overrides, see buildMachining), so a
// workshop's drilling standards change in one place.
export const MACHINING_CONFIG = {};

// Merges overrides one level deep: { hinge: { cupDiameter: 26 } } changes just
// that value and keeps the rest of the hinge section.
export function mergeConfig(base, overrides = {}) {
  const out = { ...base };
  Object.entries(overrides || {}).forEach(([k, v]) => {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object'
      ? { ...base[k], ...v } : v;
  });
  return out;
}
