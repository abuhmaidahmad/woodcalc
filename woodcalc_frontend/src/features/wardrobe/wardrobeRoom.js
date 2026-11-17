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

export function materialSnapshot(picked = {}) {
  const out = {}
  Object.entries(picked).forEach(([role, m]) => {
    if (m?.sku) out[role] = { sku: m.sku, name: m.name || m.sku, thickness: Number(m.board_thickness) || null }
  })
  return out
}

export function buildWardrobePlannerData({ design, std, price, result, picked }) {
  return {
    kind: WARDROBE_DATA_KIND,
    version: 1,
    design,
    standard: std,
    materials: materialSnapshot(picked),
    grandTotal: round2(price.grandTotal),
    summary: {
      mode: design.mode === 'closet' ? 'closet' : 'wardrobe',
      construction: result.summary.construction,
      backType: result.summary.backType,
      width: design.mode === 'closet' ? design.closet.width : design.width,
      height: design.mode === 'closet' ? design.closet.height : design.height,
      depth: design.mode === 'closet' ? design.closet.roomDepth : design.depth,
      sheets: price.sheetCount,
      parts: result.summary.partCount,
    },
  }
}

export function contractRows(design, result, widths, t, carcassName) {
  if (result.mode === 'closet') {
    const runs = result.runs.map((r) => ({
      id: r.id,
      label: `${t(`wardrobe.closet.wall.${r.id}`)} · ${t('wardrobe.closet.sectionsCount', { count: r.design.sections.length })}`,
      width: Math.round(r.place.length),
      height: r.design.height,
      depth: r.design.depth,
      material: carcassName,
      doorStyle: t(`wardrobe.doorTypes.${r.design.doorType}`),
    }))
    if (!result.island) return runs
    const isl = design.closet.island
    return runs.concat([{
      id: 'I',
      label: `${t('wardrobe.closet.wall.I')} · ${t('wardrobe.closet.islandDrawers', { count: isl.bays * isl.drawers * (isl.doubleSided ? 2 : 1) })}`,
      width: isl.width,
      height: isl.height,
      depth: isl.depth,
      material: carcassName,
      doorStyle: t('wardrobe.zone.drawers'),
    }])
  }
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
