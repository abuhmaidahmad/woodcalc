import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { authFetch } from '../api/auth'
import KitchenPlannerModule from '../features/kitchen_planner/KitchenPlannerModule'
import { useTranslation } from '../i18n/LanguageContext'

const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

export default function LeadDesignView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [lead, setLead] = useState(null)
  const [loading, setLoading] = useState(true)
  const { t } = useTranslation()

  useEffect(() => {
    authFetch(API + `/api/crm/leads/${id}/`)
      .then(r => {
        if (r.status === 401) { navigate('/login'); return null }
        return r.json()
      })
      .then(data => { if (data) setLead(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#bbb' }}>{t('leadDesignView.loading')}</div>
  if (!lead) return <div style={{ padding: 40, textAlign: 'center', color: '#bbb' }}>{t('leadDesignView.notFound')}</div>

  return (
    <KitchenPlannerModule
      initialData={lead.design_snapshot}
      roomName={t('leadDesignView.roomName', { name: lead.name })}
      onBack={() => navigate('/leads')}
    />
  )
}
