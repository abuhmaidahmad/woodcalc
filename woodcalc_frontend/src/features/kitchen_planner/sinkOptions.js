export const SINK_KINDS = ['single', 'double', 'single_drainer', 'one_half']

export const SINK_FINISHES = {
  stainless: { hex: '#b9bdc1', roughness: 0.28, metalness: 0.9 },
  black: { hex: '#232323', roughness: 0.55, metalness: 0.05 },
  white: { hex: '#f1f0ec', roughness: 0.35, metalness: 0.0 },
}

export const SINK_SUBTYPES = ['Sink', 'Single Sink', 'Double Sink']

export function resolveSink(cab) {
  const kind = SINK_KINDS.includes(cab.sinkKind)
    ? cab.sinkKind
    : (cab.subtype === 'Double Sink' || cab.sinkCavityCount === 2 ? 'double' : 'single')
  const finish = SINK_FINISHES[cab.sinkFinish] ? cab.sinkFinish : null
  const f = finish ? SINK_FINISHES[finish] : null
  return {
    kind,
    finish,
    side: cab.sinkBowlSide === 'right' ? 'right' : 'left',
    colorHex: f ? f.hex : cab.sinkColorHex,
    roughness: f ? f.roughness : cab.sinkRoughness,
    metalness: f ? f.metalness : cab.sinkMetalness,
  }
}

export function sinkRenderProps(cab) {
  if (!SINK_SUBTYPES.includes(cab.subtype)) return { sinkType: null }
  const r = resolveSink(cab)
  return { sinkType: r.kind, sinkColorHex: r.colorHex, sinkRoughness: r.roughness, sinkMetalness: r.metalness, sinkBowlSide: r.side }
}
