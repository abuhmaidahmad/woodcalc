// MACHINING_CONFIG -- every dimension the machining rules use, in mm. Rules read
// only from here (merged with any per-call overrides, see buildMachining), so a
// workshop's drilling standards change in one place.
export const MACHINING_CONFIG = {
  // Concealed hinge cups on the door's back face. The number of hinges per door
  // comes from formulaEngine getHingeCount(door height).
  hinge: {
    cupDiameter: 35,
    cupDepth: 13,
    edgeDistance: 22.5, // cup centre from the door's hinge edge
    endDistance: 100, // first/last cup centre from the door's top/bottom edge
  },
  // 7x50 confirmat screws wherever a panel butts into a side panel (bottom, top,
  // rails, fixed shelves). Face and edge holes come from one position list.
  confirmat: {
    faceDiameter: 7, // through the side panel, from its outer face
    edgeDiameter: 5,
    edgeDepth: 45, // into the mating panel's end edge
    endDistance: 50, // first/last screw from the joint's front and back
    middleOverLength: 400, // joints longer than this always get a middle screw
    maxSpacing: 250, // no two screws further apart than this
    // Visible end panels (cabinet.exposedSides) get no face holes; they are
    // fixed another way so no screw heads show.
    skipFaceHolesOnExposedSides: true,
  },
};

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
