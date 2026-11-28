import { describe, it, expect } from 'vitest'
import { proposalMaterialName } from './ProposalTab'

const mats = { carcassMaterialName: 'white plywood', frontMaterialName: 'cambrian oak', material: 'particleboard' }

describe('proposal Material column', () => {
  it('lists a normal cabinet under its carcass material', () => {
    expect(proposalMaterialName({ ...mats, category: 'base', subtype: 'Standard', width: 600, height: 720, depth: 560 })).toBe('white plywood')
  })
  it('lists an open box with front Box Color under the front material', () => {
    const box = { ...mats, category: 'wall', subtype: 'Open Shelf', width: 1760, height: 1500, depth: 260 }
    expect(proposalMaterialName(box)).toBe('white plywood')
    expect(proposalMaterialName({ ...box, openBoxMaterialSource: 'front' })).toBe('cambrian oak')
  })
  it('lists side panels under the front material', () => {
    expect(proposalMaterialName({ ...mats, category: 'accessories', subtype: 'Side Panel', width: 18, height: 1740, depth: 120 })).toBe('cambrian oak')
  })
})
