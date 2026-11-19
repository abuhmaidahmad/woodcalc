import { useEffect, useState } from 'react'
import { authFetch, getToken } from './auth'

const BASE_URL = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'
const URL = `${BASE_URL}/api/tenants/sliding-door-settings/`

export async function getSlidingDoorSettings() {
  const res = await authFetch(URL)
  if (!res.ok) throw new Error('Failed to load sliding door settings')
  return res.json()
}

export async function updateSlidingDoorSettings(patch) {
  const res = await authFetch(URL, { method: 'PATCH', body: JSON.stringify(patch) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.detail || 'Failed to save')
    err.fields = data
    throw err
  }
  loadPromise = Promise.resolve(data)
  return data
}

let loadPromise = null
export function loadSlidingDoorSettings() {
  if (!loadPromise) {
    loadPromise = getSlidingDoorSettings().catch(() => { loadPromise = null; return null })
  }
  return loadPromise
}

export function useSlidingDoorSettings() {
  const [settings, setSettings] = useState(null)
  useEffect(() => {
    if (!getToken()) return
    let alive = true
    loadSlidingDoorSettings().then((s) => { if (alive) setSettings(s) })
    return () => { alive = false }
  }, [])
  return settings
}
