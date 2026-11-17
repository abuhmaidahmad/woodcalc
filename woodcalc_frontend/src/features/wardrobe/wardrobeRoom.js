export const WARDROBE_ROOM_TYPES = ['wardrobe', 'closet']
export const WARDROBE_DATA_KIND = 'wardrobe'

export function isWardrobeRoom(room) {
  const data = room?.planner_data || {}
  if (data.kind === WARDROBE_DATA_KIND) return true
  const hasCabinets = Array.isArray(data.cabinets) && data.cabinets.length > 0
  return WARDROBE_ROOM_TYPES.includes(room?.room_type) && !hasCabinets
}

export function savedWardrobe(room) {
  const data = room?.planner_data
  if (!data || data.kind !== WARDROBE_DATA_KIND || !data.design || typeof data.design !== 'object') return null
  return { design: data.design, standard: data.standard || null }
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

export function buildWardrobePlannerData({ design, std, price, result }) {
  return {
    kind: WARDROBE_DATA_KIND,
    version: 1,
    design,
    standard: std,
    grandTotal: round2(price.grandTotal),
    summary: {
      mode: design.mode || 'wardrobe',
      construction: result.summary.construction,
      backType: result.summary.backType,
      width: design.width,
      height: design.height,
      depth: design.depth,
      sheets: price.sheetCount,
      parts: result.summary.partCount,
    },
  }
}

export function contractRows(design, widths, t, carcassName) {
  return design.sections.map((s, i) => ({
    id: `S${i + 1}`,
    label: `${t('wardrobe.sectionTitle', { n: i + 1 })} · ${(s.zones || []).map((z) => t(`wardrobe.zone.${z.type}`)).join(' + ')}`,
    width: widths[i],
    height: design.height,
    depth: design.depth,
    material: carcassName,
    doorStyle: t(`wardrobe.doorTypes.${design.doorType}`),
  }))
}
