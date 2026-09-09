import { authFetch } from './auth';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app';

export async function getCompanySettings() {
  const res = await authFetch(`${BASE_URL}/api/tenants/settings/`);
  return res.json();
}
