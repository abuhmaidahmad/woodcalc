export const CT_OVERHANG_DEFAULTS = { front: 40, back: 0, left: 20, right: 20 }

export const CT_OVERHANG_SIDES = ['front', 'back', 'left', 'right']

export function countertopOverhang(cab) {
  const o = (cab && cab.ctOverhang) || {}
  const pick = k => {
    const v = Number(o[k])
    return o[k] !== '' && o[k] != null && Number.isFinite(v) && v >= 0 ? v : CT_OVERHANG_DEFAULTS[k]
  }
  return { front: pick('front'), back: pick('back'), left: pick('left'), right: pick('right') }
}

export function countertopRunMm(cab) {
  const o = countertopOverhang(cab)
  const extraW = Math.max(0, o.left - CT_OVERHANG_DEFAULTS.left) + Math.max(0, o.right - CT_OVERHANG_DEFAULTS.right)
  const depth = Number(cab.depth) || 560
  const stdD = depth + CT_OVERHANG_DEFAULTS.front + CT_OVERHANG_DEFAULTS.back
  const factor = Math.max(1, (depth + o.front + o.back) / stdD)
  return (cab.width + extraW) * factor
}
