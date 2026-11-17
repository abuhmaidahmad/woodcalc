import React, { useState, useEffect } from 'react'
import { authFetch } from '../../api/auth'
import { useTranslation } from '../../i18n/LanguageContext'

const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

const ROOM_TYPE_LABELS = {
  kitchen: 'kitchenPlannerModule.roomTypeKitchen',
  closet: 'kitchenPlannerModule.roomTypeCloset',
  bathroom: 'kitchenPlannerModule.roomTypeBathroom',
  wardrobe: 'kitchenPlannerModule.roomTypeWardrobe',
  bedroom: 'projectDetail.roomBedroom',
  other: 'kitchenPlannerModule.roomTypeOther',
}

export default function LinkProjectModal({ onClose, onLinked, defaultRoomName = 'Kitchen', defaultRoomType = 'kitchen', roomTypes = ['kitchen', 'closet', 'bathroom', 'other'], canUseRoom = () => true }) {
  const { t, language } = useTranslation()
  const dir = language === 'ar' ? 'rtl' : 'ltr'
  const [step, setStep] = useState('client') // client -> project -> room
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const [showNewClient, setShowNewClient] = useState(false)
  const [clientForm, setClientForm] = useState({ name: '', phone: '', email: '', address: '', company: '' })

  const [showNewProject, setShowNewProject] = useState(false)
  const [projectForm, setProjectForm] = useState({ name: '', address: '', notes: '', status: 'DRAFT' })

  const [roomForm, setRoomForm] = useState({ name: defaultRoomName, room_type: defaultRoomType, notes: '' })
  const [existingRooms, setExistingRooms] = useState([])
  const [showNewRoom, setShowNewRoom] = useState(false)

  useEffect(() => {
    authFetch(API + '/api/crm/clients/').then(r => r.json()).then(d => setClients(Array.isArray(d) ? d : (d.results || []))).catch(() => {})
  }, [])

  const pickClient = async (client) => {
    setSelectedClient(client)
    setBusy(true); setErr('')
    try {
      const res = await authFetch(API + `/api/crm/projects/?client=${client.id}`)
      const d = await res.json()
      setProjects(Array.isArray(d) ? d : (d.results || []))
      setStep('project')
    } catch { setErr(t('kitchenPlannerModule.errLoadProjects')) }
    setBusy(false)
  }

  const createClient = async () => {
    if (!clientForm.name.trim()) return
    setBusy(true); setErr('')
    try {
      const res = await authFetch(API + '/api/crm/clients/', { method: 'POST', body: JSON.stringify(clientForm) })
      if (res.ok) { const client = await res.json(); setShowNewClient(false); await pickClient(client) }
      else setErr(t('kitchenPlannerModule.errCreateClient'))
    } catch { setErr(t('kitchenPlannerModule.errCreateClient')) }
    setBusy(false)
  }

  const pickProject = async (project) => {
    setSelectedProject(project)
    setBusy(true); setErr('')
    try {
      const res = await authFetch(API + `/api/crm/rooms/?project=${project.id}`)
      const d = await res.json()
      const rooms = Array.isArray(d) ? d : (d.results || [])
      const usable = rooms.filter(canUseRoom)
      setExistingRooms(usable)
      setShowNewRoom(usable.length === 0)
      setStep('room')
    } catch { setErr(t('kitchenPlannerModule.errLoadRooms')); setStep('room') }
    setBusy(false)
  }

  const pickExistingRoom = (room) => { onLinked(selectedProject.id, room.id, room.name) }

  const createProject = async () => {
    if (!projectForm.name.trim()) return
    setBusy(true); setErr('')
    try {
      const res = await authFetch(API + '/api/crm/projects/', { method: 'POST', body: JSON.stringify({ ...projectForm, client: selectedClient.id }) })
      if (res.ok) { const project = await res.json(); setShowNewProject(false); pickProject(project) }
      else setErr(t('kitchenPlannerModule.errCreateProject'))
    } catch { setErr(t('kitchenPlannerModule.errCreateProject')) }
    setBusy(false)
  }

  const createRoomAndLink = async () => {
    if (!roomForm.name.trim()) return
    if (existingRooms.some(r => r.name.trim().toLowerCase() === roomForm.name.trim().toLowerCase())) {
      setErr(t('kitchenPlannerModule.errRoomExists'))
      return
    }
    setBusy(true); setErr('')
    try {
      const res = await authFetch(API + '/api/crm/rooms/', { method: 'POST', body: JSON.stringify({ ...roomForm, project: selectedProject.id }) })
      if (res.ok) { const room = await res.json(); onLinked(selectedProject.id, room.id, room.name) }
      else setErr(t('kitchenPlannerModule.errCreateRoom'))
    } catch { setErr(t('kitchenPlannerModule.errCreateRoom')) }
    setBusy(false)
  }

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
  const box = { background: '#fff', borderRadius: 10, padding: 24, width: 420, maxHeight: '80vh', overflowY: 'auto' }
  const row = { padding: '10px 12px', border: '1px solid #E0DAD4', borderRadius: 6, marginBottom: 8, cursor: 'pointer', fontSize: 13 }
  const input = { width: '100%', padding: '8px 10px', border: '1px solid #E0DAD4', borderRadius: 6, marginBottom: 8, fontSize: 13, boxSizing: 'border-box' }
  const btn = { padding: '8px 14px', borderRadius: 6, border: 'none', background: '#C8902A', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
  const btnGhost = { ...btn, background: '#fff', color: '#555', border: '1px solid #E0DAD4' }

  return (
    <div style={overlay} onClick={onClose}>
      <div dir={dir} style={box} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{t('kitchenPlannerModule.linkTitle')}</h3>
        <p style={{ fontSize: 12, color: '#888', marginTop: -8 }}>{t('kitchenPlannerModule.linkDesc')}</p>
        {err && <div style={{ color: '#c0392b', fontSize: 12, marginBottom: 8 }}>{err}</div>}

        {step === 'client' && !showNewClient && (
          <>
            {clients.map(cl => (
              <div key={cl.id} style={row} onClick={() => pickClient(cl)}>{cl.name}</div>
            ))}
            <button style={{ ...btnGhost, marginTop: 8 }} onClick={() => setShowNewClient(true)}>{t('kitchenPlannerModule.newCustomer')}</button>
          </>
        )}
        {step === 'client' && showNewClient && (
          <>
            <input style={input} placeholder={t('kitchenPlannerModule.customerNamePlaceholder')} value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))} />
            <input style={input} placeholder={t('kitchenPlannerModule.phonePlaceholder')} value={clientForm.phone} onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))} />
            <input style={input} placeholder={t('kitchenPlannerModule.addressPlaceholder')} value={clientForm.address} onChange={e => setClientForm(f => ({ ...f, address: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btn} disabled={busy} onClick={createClient}>{busy ? '...' : t('kitchenPlannerModule.createContinue')}</button>
              <button style={btnGhost} onClick={() => setShowNewClient(false)}>{t('kitchenPlannerModule.cancel')}</button>
            </div>
          </>
        )}

        {step === 'project' && !showNewProject && (
          <>
            {projects.map(pr => (
              <div key={pr.id} style={row} onClick={() => pickProject(pr)}>{pr.name}</div>
            ))}
            <button style={{ ...btnGhost, marginTop: 8 }} onClick={() => setShowNewProject(true)}>{t('kitchenPlannerModule.newProject')}</button>
            <div><button style={{ ...btnGhost, marginTop: 8 }} onClick={() => setStep('client')}>{t('kitchenPlannerModule.back')}</button></div>
          </>
        )}
        {step === 'project' && showNewProject && (
          <>
            <input style={input} placeholder={t('kitchenPlannerModule.projectNamePlaceholder')} value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} />
            <input style={input} placeholder={t('kitchenPlannerModule.addressPlaceholder')} value={projectForm.address} onChange={e => setProjectForm(f => ({ ...f, address: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btn} disabled={busy} onClick={createProject}>{busy ? '...' : t('kitchenPlannerModule.createContinue')}</button>
              <button style={btnGhost} onClick={() => setShowNewProject(false)}>{t('kitchenPlannerModule.cancel')}</button>
            </div>
          </>
        )}

        {step === 'room' && !showNewRoom && (
          <>
            {existingRooms.map(rm => (
              <div key={rm.id} style={row} onClick={() => pickExistingRoom(rm)}>{rm.name} <span style={{ color: '#999', fontSize: 11 }}>({rm.room_type})</span></div>
            ))}
            <button style={{ ...btnGhost, marginTop: 8 }} onClick={() => setShowNewRoom(true)}>{t('kitchenPlannerModule.newRoom')}</button>
            <div><button style={{ ...btnGhost, marginTop: 8 }} onClick={() => setStep('project')}>{t('kitchenPlannerModule.back')}</button></div>
          </>
        )}
        {step === 'room' && showNewRoom && (
          <>
            <input style={input} placeholder={t('kitchenPlannerModule.roomNamePlaceholder')} value={roomForm.name} onChange={e => setRoomForm(f => ({ ...f, name: e.target.value }))} />
            <select style={input} value={roomForm.room_type} onChange={e => setRoomForm(f => ({ ...f, room_type: e.target.value }))}>
              {roomTypes.map((rt) => <option key={rt} value={rt}>{t(ROOM_TYPE_LABELS[rt] || 'kitchenPlannerModule.roomTypeOther')}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btn} disabled={busy} onClick={createRoomAndLink}>{busy ? t('kitchenPlannerModule.saving') : t('kitchenPlannerModule.createRoomSave')}</button>
              {existingRooms.length > 0 && <button style={btnGhost} onClick={() => setShowNewRoom(false)}>{t('kitchenPlannerModule.existingRooms')}</button>}
              <button style={btnGhost} onClick={() => setStep('project')}>{t('kitchenPlannerModule.backToProject')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
