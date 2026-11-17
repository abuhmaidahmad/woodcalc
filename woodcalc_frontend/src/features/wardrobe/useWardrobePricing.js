import { useMemo } from 'react'
import { priceWardrobe, pickMaterials } from './wardrobePricing'

export function usePricing(design, std, materials, result) {
  const settings = design.pricing || {}
  const picked = useMemo(() => pickMaterials(settings.picks, materials), [settings.picks, materials])
  const labourPct = settings.labourPct ?? std.labourPct
  const marginPct = settings.marginPct ?? std.marginPct
  const opts = useMemo(() => ({ picked, labourPct, marginPct }), [picked, labourPct, marginPct])
  const price = useMemo(() => priceWardrobe(result, std, opts), [result, std, opts])
  return { price, picked, opts }
}
