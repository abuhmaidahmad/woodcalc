import { useCallback, useEffect, useRef, useState } from 'react'

export function sameSnapshot(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every(k => Object.is(a[k], b[k]))
}

function sameContent(a, b) {
  if (sameSnapshot(a, b)) return true
  try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
}

export function createHistory(initial, limit = 100) {
  const h = { baseline: initial, past: [], future: [] }
  h.commit = current => {
    if (sameSnapshot(current, h.baseline)) return false
    if (sameContent(current, h.baseline)) { h.baseline = current; return false }
    h.past.push(h.baseline)
    if (h.past.length > limit) h.past.shift()
    h.future = []
    h.baseline = current
    return true
  }
  h.undo = current => {
    h.commit(current)
    if (!h.past.length) return null
    h.future.push(h.baseline)
    h.baseline = h.past.pop()
    return h.baseline
  }
  h.redo = current => {
    if (h.commit(current)) return null
    if (!h.future.length) return null
    h.past.push(h.baseline)
    h.baseline = h.future.pop()
    return h.baseline
  }
  h.reset = current => {
    h.baseline = current
    h.past = []
    h.future = []
  }
  return h
}

export function useDesignHistory(snapshot, apply, { disabled = false, settleMs = 300, limit = 100, absorbMs = 1500 } = {}) {
  const histRef = useRef(null)
  if (!histRef.current) histRef.current = createHistory(snapshot, limit)
  const currentRef = useRef(snapshot)
  currentRef.current = snapshot
  const applyRef = useRef(apply)
  applyRef.current = apply
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled
  const timerRef = useRef(null)
  const pointerDownRef = useRef(false)
  const absorbUntilRef = useRef(Date.now() + absorbMs)
  const [flags, setFlags] = useState({ canUndo: false, canRedo: false })

  const sync = useCallback(() => {
    const h = histRef.current
    const canUndo = h.past.length > 0 || !sameSnapshot(currentRef.current, h.baseline)
    const canRedo = h.future.length > 0
    setFlags(f => (f.canUndo === canUndo && f.canRedo === canRedo) ? f : { canUndo, canRedo })
  }, [])

  const commitNow = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = null
    if (pointerDownRef.current) return
    const h = histRef.current
    if (Date.now() < absorbUntilRef.current) h.baseline = currentRef.current
    else h.commit(currentRef.current)
    sync()
  }, [sync])

  const schedule = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(commitNow, settleMs)
  }, [commitNow, settleMs])

  useEffect(() => {
    const h = histRef.current
    if (Date.now() < absorbUntilRef.current) { h.baseline = snapshot; return }
    if (sameSnapshot(snapshot, h.baseline)) return
    sync()
    if (!pointerDownRef.current) schedule()
  })

  useEffect(() => {
    const down = () => { pointerDownRef.current = true }
    const up = () => {
      pointerDownRef.current = false
      if (!sameSnapshot(currentRef.current, histRef.current.baseline)) schedule()
    }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', up, true)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', up, true)
      clearTimeout(timerRef.current)
    }
  }, [schedule])

  const undo = useCallback(() => {
    if (disabledRef.current) return
    clearTimeout(timerRef.current)
    const snap = histRef.current.undo(currentRef.current)
    sync()
    if (snap) applyRef.current(snap)
  }, [sync])

  const redo = useCallback(() => {
    if (disabledRef.current) return
    clearTimeout(timerRef.current)
    const snap = histRef.current.redo(currentRef.current)
    sync()
    if (snap) applyRef.current(snap)
  }, [sync])

  const resetHistory = useCallback(() => {
    clearTimeout(timerRef.current)
    absorbUntilRef.current = Date.now() + absorbMs
    histRef.current.reset(currentRef.current)
    sync()
  }, [absorbMs, sync])

  return { undo, redo, resetHistory, canUndo: !disabled && flags.canUndo, canRedo: !disabled && flags.canRedo }
}

export function isTypingTarget(tgt) {
  if (!tgt) return false
  return tgt.isContentEditable || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT' ||
    (tgt.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'range', 'color'].includes(tgt.type))
}
