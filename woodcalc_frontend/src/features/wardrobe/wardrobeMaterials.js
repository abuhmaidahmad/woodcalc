export const CARCASS_COLOR = '#f1ede6'
export const DEFAULT_PHYSICAL_MM = 600

const HEX = /^#[0-9a-fA-F]{6}$/

export function hasDesignMaterials(design) {
  return !!design?.materials && typeof design.materials === 'object'
}

export function materialSkus(design) {
  if (!hasDesignMaterials(design)) return null
  const m = design.materials
  const carcass = m.carcass || null
  return { carcass, front: m.frontMatchesCarcass ? carcass : m.front || null }
}

export function withMaterials(design, patch) {
  const picks = design.pricing?.picks || {}
  const base = hasDesignMaterials(design)
    ? design.materials
    : { carcass: picks.Carcass || null, front: picks.Front || null, frontMatchesCarcass: false }
  return { ...design, materials: { ...base, ...patch } }
}

export function pricingPicks(design) {
  const picks = { ...(design?.pricing?.picks || {}) }
  const skus = materialSkus(design)
  if (skus) {
    picks.Carcass = skus.carcass
    picks.Front = skus.front
  }
  return picks
}

export function finishOf(entry, fallbackHex) {
  if (!entry) return { hex: fallbackHex, imageUrl: null }
  return {
    hex: HEX.test(entry.fallback_hex || '') ? entry.fallback_hex : fallbackHex,
    imageUrl: entry.texture_image || null,
    physW: Number(entry.texture_physical_width_mm) || DEFAULT_PHYSICAL_MM,
    physH: Number(entry.texture_physical_height_mm) || DEFAULT_PHYSICAL_MM,
    finish: entry.finish || 'matt',
    name: entry.name || null,
  }
}

export function materialLook(design, textureMap, frontColor) {
  const skus = materialSkus(design)
  return {
    carcass: finishOf(skus?.carcass ? textureMap?.[skus.carcass] : null, CARCASS_COLOR),
    front: finishOf(skus?.front ? textureMap?.[skus.front] : null, frontColor),
  }
}

export function shareLook(finishes, frontColor) {
  return {
    carcass: finishOf(finishes?.carcass, CARCASS_COLOR),
    front: finishOf(finishes?.front, frontColor),
  }
}

export function grainRepeat(w, h, d, physW = DEFAULT_PHYSICAL_MM, physH = DEFAULT_PHYSICAL_MM) {
  const thin = Math.min(w, h, d)
  const [u, v] = thin === d ? [w, h] : thin === w ? [d, h] : [w, d]
  return v >= u
    ? { repeatU: u / physW, repeatV: v / physH, rotate90: false }
    : { repeatU: v / physW, repeatV: u / physH, rotate90: true }
}

