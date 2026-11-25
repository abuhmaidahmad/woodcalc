import { useState } from 'react'
import { authFetch } from '../../api/auth'
import { useTranslation } from '../../i18n/LanguageContext'

const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

export function shareUrl(token, origin = window.location.origin) {
  return `${origin}/view/${token}`
}

export function useRoomShare(roomId, room, setRoom) {
  const { t } = useTranslation()
  const [shareBusy, setShareBusy] = useState(false)
  const [shareMsg, setShareMsg] = useState('')

  const flash = (msg) => {
    setShareMsg(msg)
    setTimeout(() => setShareMsg(''), 2000)
  }

  const shareView = async () => {
    if (room?.share_token) {
      try { await navigator.clipboard.writeText(shareUrl(room.share_token)) } catch {}
      flash(t('roomDetail.shareViewCopied'))
      return
    }
    setShareBusy(true)
    setShareMsg(t('roomDetail.shareViewGenerating'))
    try {
      const res = await authFetch(API + `/api/crm/rooms/${roomId}/share_link/`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setRoom((r) => ({ ...r, share_token: data.share_token }))
        try { await navigator.clipboard.writeText(shareUrl(data.share_token)) } catch {}
        flash(t('roomDetail.shareViewCopied'))
      } else {
        setShareMsg('')
      }
    } catch { setShareMsg('') }
    setShareBusy(false)
  }

  const revokeShareView = async () => {
    if (!window.confirm(t('roomDetail.shareViewRevokeConfirm'))) return
    try {
      await authFetch(API + `/api/crm/rooms/${roomId}/share_link/`, { method: 'DELETE' })
      setRoom((r) => ({ ...r, share_token: null }))
      setShareMsg('')
    } catch {}
  }

  return { shareView, revokeShareView, shareBusy, shareMsg }
}
