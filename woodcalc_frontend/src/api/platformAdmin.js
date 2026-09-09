import { authFetch } from './auth';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app';

export async function listCompanies() {
  const res = await authFetch(`${BASE_URL}/api/platform-admin/companies/`);
  return res.json();
}

export async function updateCompany(companyId, data) {
  const res = await authFetch(`${BASE_URL}/api/platform-admin/companies/${companyId}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function extendTrial(companyId) {
  const res = await authFetch(`${BASE_URL}/api/platform-admin/companies/${companyId}/extend_trial/`, {
    method: 'POST',
  });
  return res.json();
}

export async function listAllFeedback() {
  const res = await authFetch(`${BASE_URL}/api/platform-admin/feedback/`);
  return res.json();
}

export async function updateFeedback(feedbackId, data) {
  const res = await authFetch(`${BASE_URL}/api/platform-admin/feedback/${feedbackId}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.json();
}
