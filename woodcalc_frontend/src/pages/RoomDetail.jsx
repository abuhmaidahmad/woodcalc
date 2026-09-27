import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import KitchenPlannerModule from '../features/kitchen_planner/KitchenPlannerModule'
import { authFetch } from '../api/auth'
import { useTranslation } from '../i18n/LanguageContext'

const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
})

export default function RoomDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, language } = useTranslation()
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareMsg, setShareMsg] = useState('')

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const res = await authFetch(API + `/api/crm/rooms/${id}/`)
        if (res.status === 401) { navigate('/login'); return }
        const data = await res.json()
        setRoom(data)
      } catch {}
      setLoading(false)
    }
    fetchRoom()
  }, [id])

  const shareView = async () => {
    // Once a link exists, clicking the button again just re-copies it —
    // generating only happens the first time, so a link a customer already
    // has doesn't silently stop working.
    if (room?.share_token) {
      try { await navigator.clipboard.writeText(`${window.location.origin}/view/${room.share_token}`) } catch {}
      setShareMsg(t('roomDetail.shareViewCopied'))
      setTimeout(() => setShareMsg(''), 2000)
      return
    }
    setShareBusy(true)
    setShareMsg(t('roomDetail.shareViewGenerating'))
    try {
      const res = await authFetch(API + `/api/crm/rooms/${id}/share_link/`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        const link = `${window.location.origin}/view/${data.share_token}`
        setRoom(r => ({ ...r, share_token: data.share_token }))
        try { await navigator.clipboard.writeText(link) } catch {}
        setShareMsg(t('roomDetail.shareViewCopied'))
        setTimeout(() => setShareMsg(''), 2000)
      } else {
        setShareMsg('')
      }
    } catch { setShareMsg('') }
    setShareBusy(false)
  }

  const revokeShareView = async () => {
    if (!window.confirm(t('roomDetail.shareViewRevokeConfirm'))) return
    try {
      await authFetch(API + `/api/crm/rooms/${id}/share_link/`, { method: 'DELETE' })
      setRoom(r => ({ ...r, share_token: null }))
      setShareMsg('')
    } catch {}
  }

  if (loading) return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: '#bbb' }}>
      {t('roomDetail.loading')}
    </div>
  )

  if (!room) return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: '#bbb' }}>
      {t('roomDetail.notFound')}
    </div>
  )

  return (
    <KitchenPlannerModule
      roomId={id}
      roomName={room.name}
      roomType={room.room_type}
      projectId={room.project}
      initialData={room.planner_data}
      onBack={() => navigate(`/projects/${room.project}`)}
      shareToken={room.share_token}
      shareBusy={shareBusy}
      shareMsg={shareMsg}
      onShare={shareView}
      onRevokeShare={revokeShareView}
    />
  )
}
