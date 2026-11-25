export function forceHttps(url) {
  if (!url) return url
  return url.replace(/^http:\/\//i, 'https://')
}

export function textureMapFrom(materials) {
  const map = {}
  ;(materials || []).forEach((t) => {
    if (t?.sku) map[t.sku] = { ...t, texture_image: forceHttps(t.texture_image) }
  })
  return map
}
