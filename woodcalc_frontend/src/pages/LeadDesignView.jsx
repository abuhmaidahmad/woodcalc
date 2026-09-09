import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { authFetch } from '../api/auth'
import KitchenPlannerModule from '../features/kitchen_planner/KitchenPlannerModule'

const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

export default function LeadDesignView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [lead, setLead] = useState(null)
  const [loading, setLoading] = useState(true)

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

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#bbb' }}>Loading...</div>
  if (!lead) return <div style={{ padding: 40, textAlign: 'center', color: '#bbb' }}>Lead not found</div>

  return (
    <KitchenPlannerModule
      initialData={lead.design_snapshot}
      roomName={`${lead.name}'s design`}
      onBack={() => navigate('/leads')}
    />
  )
}
