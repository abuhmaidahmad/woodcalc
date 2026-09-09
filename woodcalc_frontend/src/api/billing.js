import { authFetch } from './auth';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app';

export async function createCheckout(plan) {
  const res = await authFetch(`${BASE_URL}/api/billing/checkout/`, {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });
  return res.json();
}
