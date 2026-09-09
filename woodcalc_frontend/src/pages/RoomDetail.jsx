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
    />
  )
}
