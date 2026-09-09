import { authFetch } from './auth';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app';

export async function listFeedback() {
  const res = await authFetch(`${BASE_URL}/api/feedback/`);
  return res.json();
}

export async function submitFeedback(message, page) {
  const res = await authFetch(`${BASE_URL}/api/feedback/`, {
    method: 'POST',
    body: JSON.stringify({ message, page }),
  });
  return res.json();
}
