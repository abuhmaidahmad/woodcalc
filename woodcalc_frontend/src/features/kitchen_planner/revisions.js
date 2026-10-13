export function revisionChains(rooms) {
  const byId = new Map(rooms.map(r => [r.id, r]))
  const rootOf = room => {
    let current = room
    while (current.parent_revision && byId.has(current.parent_revision)) current = byId.get(current.parent_revision)
    return current
  }
  const chains = new Map()
  rooms.forEach(room => {
    const root = rootOf(room)
    if (!chains.has(root.id)) chains.set(root.id, [])
    chains.get(root.id).push(room)
  })
  return [...chains.values()].map(revisions => {
    revisions.sort((a, b) => a.revision_number - b.revision_number)
    const approved = revisions.filter(r => r.revision_status === 'approved')
    return { revisions, active: approved.length ? approved[approved.length - 1] : revisions[revisions.length - 1] }
  })
}

export function activeTotal(rooms) {
  return revisionChains(rooms).reduce((sum, chain) => sum + parseFloat(chain.active.grand_total || 0), 0)
}
