import { useEffect, useState } from 'react'
import { authFetch } from '../../api/auth'

const API = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app'

export function useInventoryMaterials() {
  const [state, setState] = useState({ materials: [], loading: true, error: false })
  useEffect(() => {
    let alive = true
    const fetchAll = async (url, acc = []) => {
      const res = await authFetch(url)
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      const list = acc.concat(Array.isArray(data) ? data : data.results || [])
      return data.next ? fetchAll(data.next.replace(/^https?:/, new URL(API).protocol), list) : list
    }
    fetchAll(API + '/api/inventory/materials/')
      .then((list) => { if (alive) setState({ materials: list.filter((m) => m.sku), loading: false, error: false }) })
      .catch(() => { if (alive) setState({ materials: [], loading: false, error: true }) })
    return () => { alive = false }
  }, [])
  return state
}
