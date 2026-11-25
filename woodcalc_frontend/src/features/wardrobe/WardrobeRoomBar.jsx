import React, { useState } from 'react'
import { useTranslation } from '../../i18n/LanguageContext'
import { roomLockState, useRoomLockActions } from '../rooms/useRoomLockActions'
import RoomHistoryPanel from '../kitchen_planner/RoomHistoryPanel'

const ACCENT = '#C8902A'
const LOCK_KEYS = {
  confirmLockPrompt: 'wardrobe.room.confirmLockPrompt',
  variantConfirmPrompt: 'wardrobe.room.variantConfirmPrompt',
  unlockPrompt: 'wardrobe.room.unlockPrompt',
  sendNewRevisionNotice: 'wardrobe.room.sendNewRevisionNotice',
}
const bar = { padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', borderRadius: 6, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }

export default function WardrobeRoomBar({ roomId, lock, onRoomAction, onSave, saving, savedMsg, canSave, onSend, sending, sentMsg, shareToken, shareBusy, shareMsg, onShare, onRevokeShare }) {
  const { t } = useTranslation()
  const [showHistory, setShowHistory] = useState(false)
  const st = roomLockState(lock)
  const actions = useRoomLockActions({ roomId, lock, onRoomAction, save: onSave, keys: LOCK_KEYS })
  const accent = { ...bar, color: ACCENT, borderColor: ACCENT }
  return (
    <>
      {!st.locked && !st.isRevision && !st.auditor && st.canConfirm && (
        <button onClick={actions.confirmAndLock} disabled={saving || !canSave} style={accent}>{t('kitchenPlannerModule.confirmLock')}</button>
      )}
      {st.locked && lock.revisionStatus === 'approved' && !st.auditor && onSend && (
        <button onClick={onSend} disabled={sending} style={{ ...bar, color: '#2AC87A', borderColor: '#2AC87A' }}>
          {sending ? t('kitchenPlannerModule.sending') : sentMsg || t('kitchenPlannerModule.sendToManufacturing')}
        </button>
      )}
      {st.locked && lock.revisionStatus === 'approved' && !st.auditor && (
        <button onClick={actions.requestChange} style={accent}>{t('kitchenPlannerModule.requestChange')}</button>
      )}
      {st.isRevision && !st.locked && !st.auditor && (
        <button onClick={actions.submitRevision} disabled={saving || !canSave} style={accent}>{t('kitchenPlannerModule.submitForApproval')}</button>
      )}
      {lock?.revisionStatus === 'pending_approval' && st.role === 'owner' && (
        <>
          <button onClick={actions.approveRevision} style={{ ...bar, color: '#2AC87A', borderColor: '#2AC87A' }}>{t('kitchenPlannerModule.approve')}</button>
          <button onClick={actions.rejectRevision} style={{ ...bar, color: '#E74C3C' }}>{t('kitchenPlannerModule.reject')}</button>
        </>
      )}
      {st.locked && lock.revisionStatus === 'approved' && st.role === 'owner' && (
        <button onClick={actions.unlockRoom} style={{ ...bar, color: '#E74C3C' }}>{t('kitchenPlannerModule.unlock')}</button>
      )}
      {onShare && !st.auditor && (
        <button onClick={onShare} disabled={shareBusy} style={{ ...bar, color: shareToken ? ACCENT : bar.color }} title={t('wardrobe.room.shareNote')}>
          {shareMsg || (shareToken ? t('roomDetail.shareViewCopyLink') : t('roomDetail.shareView'))}
        </button>
      )}
      {onRevokeShare && !st.auditor && shareToken && (
        <button onClick={onRevokeShare} style={{ ...bar, color: '#E74C3C' }}>{t('wardrobe.room.stopSharing')}</button>
      )}
      {st.canSeeHistory && <button onClick={() => setShowHistory(true)} style={bar}>{t('roomHistory.open')}</button>}
      {st.locked ? (
        <span title={t('wardrobe.room.lockedTip')} style={{ ...bar, cursor: 'default', color: lock.revisionStatus === 'approved' ? '#2AC87A' : '#888', borderColor: lock.revisionStatus === 'approved' ? '#2AC87A' : '#888' }}>
          {t(`kitchenPlannerModule.badge_${lock.revisionStatus}`, { rev: lock.revisionNumber })}
        </span>
      ) : st.auditor ? (
        <span style={{ ...accent, cursor: 'default' }}>{t('kitchenPlannerModule.viewOnly')}</span>
      ) : (
        <button onClick={onSave} disabled={saving || !canSave} style={{ ...bar, background: ACCENT, color: '#fff', border: 'none', fontWeight: 700 }}>
          {saving ? t('kitchenPlannerModule.saving') : savedMsg || t('kitchenPlannerModule.save')}
        </button>
      )}
      {showHistory && <RoomHistoryPanel roomId={roomId} onClose={() => setShowHistory(false)} />}
    </>
  )
}
