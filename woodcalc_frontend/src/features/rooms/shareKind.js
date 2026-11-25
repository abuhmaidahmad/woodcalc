export function shareKind(data) {
  return data && data.kind === 'wardrobe' && data.design && typeof data.design === 'object' ? 'wardrobe' : 'kitchen'
}
