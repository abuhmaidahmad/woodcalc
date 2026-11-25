import { describe, it, expect } from 'vitest'
import { createHistory, sameSnapshot } from './designHistory'

const snap = (cabinets, walls = []) => ({ cabinets, walls })

describe('createHistory', () => {
  it('undoes and redoes committed steps in order', () => {
    const s0 = snap([])
    const s1 = snap([{ id: 1 }])
    const s2 = snap([{ id: 1 }, { id: 2 }])
    const h = createHistory(s0)
    expect(h.commit(s1)).toBe(true)
    expect(h.commit(s2)).toBe(true)
    expect(h.undo(s2)).toBe(s1)
    expect(h.undo(s1)).toBe(s0)
    expect(h.undo(s0)).toBe(null)
    expect(h.redo(s0)).toBe(s1)
    expect(h.redo(s1)).toBe(s2)
    expect(h.redo(s2)).toBe(null)
  })

  it('commits pending edits before undoing so the latest change is undone first', () => {
    const s0 = snap([])
    const s1 = snap([{ id: 1 }])
    const h = createHistory(s0)
    expect(h.undo(s1)).toBe(s0)
    expect(h.redo(s0)).toBe(s1)
  })

  it('drops redo after a new edit', () => {
    const s0 = snap([])
    const s1 = snap([{ id: 1 }])
    const s2 = snap([{ id: 9 }])
    const h = createHistory(s0)
    h.commit(s1)
    h.undo(s1)
    expect(h.redo(s2)).toBe(null)
    expect(h.future).toHaveLength(0)
    expect(h.undo(s2)).toBe(s0)
  })

  it('ignores new references with identical content', () => {
    const s0 = snap([{ id: 1, w: 600 }])
    const h = createHistory(s0)
    expect(h.commit(snap([{ id: 1, w: 600 }]))).toBe(false)
    expect(h.past).toHaveLength(0)
  })

  it('caps the number of steps', () => {
    const h = createHistory(snap([]), 3)
    for (let i = 1; i <= 5; i++) h.commit(snap([{ id: i }]))
    expect(h.past).toHaveLength(3)
  })

  it('compares snapshots field by field', () => {
    const c = [{ id: 1 }]
    expect(sameSnapshot(snap(c), snap(c))).toBe(false)
    const w = []
    expect(sameSnapshot({ cabinets: c, walls: w }, { cabinets: c, walls: w })).toBe(true)
  })
})
