import { useMemo } from 'react'
import { priceWardrobe, pickMaterials } from './wardrobePricing'
import { pricingPicks } from './wardrobeMaterials'

export function usePricing(design, std, materials, result) {
  const settings = design.pricing || {}
  const picksKey = JSON.stringify(pricingPicks(design))
  const picked = useMemo(() => pickMaterials(JSON.parse(picksKey), materials, std), [picksKey, materials, std])
  const labourPct = settings.labourPct ?? std.labourPct
  const marginPct = settings.marginPct ?? std.marginPct
  const opts = useMemo(() => ({ picked, labourPct, marginPct }), [picked, labourPct, marginPct])
  const price = useMemo(() => priceWardrobe(result, std, opts), [result, std, opts])
  return { price, picked, opts }
}
