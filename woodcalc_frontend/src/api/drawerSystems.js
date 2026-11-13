import { authFetch } from './auth';
import { setDrawerSystemCatalog } from '../features/kitchen_planner/formulaEngine';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app';

// The company's drawer system catalog, fetched once per page load. A work
// order's pieces need it for metal-sided systems' back sizes.
let loadPromise = null;
export function loadDrawerSystems() {
  if (!loadPromise) {
    loadPromise = authFetch(`${BASE_URL}/api/inventory/drawer-systems/`)
      .then(res => (res.ok ? res.json() : []))
      .then(data => (Array.isArray(data) ? data : data.results || []))
      .then(list => { setDrawerSystemCatalog(list); return list; })
      .catch(() => { loadPromise = null; return []; });
  }
  return loadPromise;
}
