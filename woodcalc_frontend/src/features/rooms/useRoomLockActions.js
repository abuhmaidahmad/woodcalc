import { useNavigate } from 'react-router-dom'
import { authFetch, getRole, isReadOnly } from '../../api/auth'
import { useTranslation } from '../../i18n/LanguageContext'
import { confirmPreviewText } from '../kitchen_planner/confirmPreview'

export function roomLockState(lock, { publicView = false } = {}) {
  const role = getRole()
  const auditor = !publicView && isReadOnly()
  const locked = !!lock?.isLocked
  const isVariant = !!lock?.isVariant
  return {
    role,
    auditor,
    locked,
    isVariant,
    readOnly: auditor || locked,
    canConfirm: role === 'owner' || (role === 'admin' && !isVariant),
    isRevision: !!lock?.parentRevision,
    canSeeHistory: !!lock && ['owner', 'admin', 'auditor'].includes(role),
  }
}

export function useRoomLockActions({ roomId, lock, onRoomAction, save, keys = {} }) {
  const { t } = useTranslation()
  const tk = (key, params) => t(keys[key] || `kitchenPlannerModule.${key}`, params)
  const navigate = useNavigate()
  const isVariant = !!lock?.isVariant
  const saveProject = save

  const reviewConfirmation = async () => {
    const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'
    try {
      const res = await authFetch(API + `/api/crm/rooms/${roomId}/confirm_preview/`)
      if (!res.ok) return true
      const text = confirmPreviewText(await res.json(), t)
      return text ? window.confirm(text) : true
    } catch { return true }
  }

  const runRoomAction = async (name, body) => {
    const result = await onRoomAction(name, body)
    if (!result.ok && result.status !== 409) window.alert(result.data.detail || t('roomDetail.actionFailed'))
    return result
  }

  const confirmAndLock = async () => {
    if (!window.confirm(tk('confirmLockPrompt'))) return
    let body = {}
    if (isVariant) {
      const reason = (window.prompt(tk('variantConfirmPrompt')) || '').trim()
      if (!reason) return
      body = { reason }
    }
    if (!(await saveProject())) return
    if (!(await reviewConfirmation())) return
    await runRoomAction('confirm_lock', body)
  }

  const unlockRoom = async () => {
    const reason = (window.prompt(tk('unlockPrompt')) || '').trim()
    if (!reason) return
    await runRoomAction('unlock', { reason })
  }

  const requestChange = async () => {
    if (!window.confirm(tk('requestChangePrompt', { rev: lock.revisionNumber + 1 }))) return
    const result = await onRoomAction('request_change')
    // A revision is already open: that's where edits belong, so offer to go
    // there rather than leave the user editing this locked one.
    if (!result.ok && result.data.id) {
      if (window.confirm(tk('openRevisionPrompt', { detail: result.data.detail }))) navigate(`/rooms/${result.data.id}`)
    } else if (!result.ok) {
      window.alert(result.data.detail || t('roomDetail.actionFailed'))
    }
  }

  const submitRevision = async () => {
    if (!window.confirm(tk('submitPrompt'))) return
    if (!(await saveProject())) return
    if (!(await reviewConfirmation())) return
    await runRoomAction('submit_revision')
  }

  const approveRevision = async () => {
    if (!window.confirm(tk('approvePrompt', { rev: lock.revisionNumber }))) return
    let result = await runRoomAction('approve_revision')
    if (result.status === 409) {
      const reason = (window.prompt(tk('overridePrompt', { detail: result.data.detail })) || '').trim()
      if (!reason) return
      result = await runRoomAction('approve_revision', { override_reason: reason })
    }
    if (!result.ok) return
    const { cancelled_work_orders: cancelled = [], flagged_work_orders: flagged = [] } = result.data
    const notes = [tk('approvedNotice', { rev: lock.revisionNumber })]
    if (cancelled.length) notes.push(tk('cancelledNotice', { orders: cancelled.join(', ') }))
    if (flagged.length) notes.push(tk('flaggedNotice', { orders: flagged.join(', ') }))
    notes.push(tk('sendNewRevisionNotice'))
    window.alert(notes.join('\n\n'))
  }

  const rejectRevision = async () => {
    const reason = (window.prompt(tk('rejectPrompt')) || '').trim()
    if (!reason) return
    await runRoomAction('reject_revision', { reason })
  }

  return { confirmAndLock, unlockRoom, requestChange, submitRevision, approveRevision, rejectRevision }
}
