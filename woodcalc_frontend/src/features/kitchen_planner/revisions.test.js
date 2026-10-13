import { describe, it, expect } from 'vitest'
import { revisionChains, activeTotal } from './revisions'

const room = (id, rev, status, parent = null, total = 0) => ({
  id, revision_number: rev, revision_status: status, parent_revision: parent, grand_total: String(total),
})

describe('revisionChains', () => {
  it('groups revisions under their root and picks the approved one as active', () => {
    const rooms = [
      room(3, 3, 'draft', 2, 300),
      room(1, 1, 'superseded', null, 100),
      room(2, 2, 'approved', 1, 200),
      room(9, 1, 'draft', null, 50),
    ]
    const chains = revisionChains(rooms)
    expect(chains).toHaveLength(2)
    const kitchen = chains.find(c => c.revisions[0].id === 1)
    expect(kitchen.revisions.map(r => r.id)).toEqual([1, 2, 3])
    expect(kitchen.active.id).toBe(2)
    expect(activeTotal(rooms)).toBe(250)
  })

  it('falls back to the latest revision when none is approved', () => {
    const chains = revisionChains([room(1, 1, 'draft'), room(2, 2, 'pending_approval', 1)])
    expect(chains[0].active.id).toBe(2)
  })
})
