import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import KitchenPlannerModule from '../features/kitchen_planner/KitchenPlannerModule'
import WardrobeBuilder from './WardrobeBuilder'
import { isWardrobeRoom } from '../features/wardrobe/wardrobeRoom'
import { authFetch } from '../api/auth'
import { useRoomShare } from '../features/rooms/useRoomShare'
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
  const { shareView, revokeShareView, shareBusy, shareMsg } = useRoomShare(id, room, setRoom)

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

  const roomAction = async (name, body = {}) => {
    const res = await authFetch(API + `/api/crm/rooms/${id}/${name}/`, { method: 'POST', body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    if (res.ok && name === 'request_change') navigate(`/rooms/${data.id}`)
    else if (res.ok) setRoom(r => ({ ...r, ...data }))
    return { ok: res.ok, status: res.status, data }
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

  const lock = {
    isLocked: room.is_locked,
    revisionNumber: room.revision_number,
    revisionStatus: room.revision_status,
    parentRevision: room.parent_revision,
    rejectionReason: room.rejection_reason,
    isVariant: room.is_variant,
    sourceRoomName: room.source_room_name,
    sourceRoomRevision: room.source_room_revision,
    constructionSettings: room.construction_settings,
  }

  if (isWardrobeRoom(room)) {
    return (
      <WardrobeBuilder
        key={room.id}
        roomId={id}
        room={room}
        lock={lock}
        onRoomAction={roomAction}
        onBack={() => navigate(`/projects/${room.project}`)}
        onSaved={(patch) => setRoom((r) => ({ ...r, ...patch }))}
        shareToken={room.share_token}
        shareBusy={shareBusy}
        shareMsg={shareMsg}
        onShare={shareView}
        onRevokeShare={revokeShareView}
      />
    )
  }

  return (
    <KitchenPlannerModule
      key={room.id}
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
      lock={lock}
      onRoomAction={roomAction}
    />
  )
}
