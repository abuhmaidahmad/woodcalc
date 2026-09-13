import { authFetch } from './auth';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app';

export async function listImportJobs() {
  const res = await authFetch(`${BASE_URL}/api/cadcam/import-jobs/`);
  return res.json();
}

export async function createImportJob({ platform, method, file }) {
  const fd = new FormData();
  fd.append('platform', platform);
  fd.append('method', method);
  if (file) fd.append('source_file', file);
  const res = await authFetch(`${BASE_URL}/api/cadcam/import-jobs/`, {
    method: 'POST',
    body: fd,
  });
  return res.json();
}

export async function getJobParts(jobId) {
  const res = await authFetch(`${BASE_URL}/api/cadcam/import-jobs/${jobId}/parts/`);
  return res.json();
}

export async function getJobOffcuts(jobId) {
  const res = await authFetch(`${BASE_URL}/api/cadcam/import-jobs/${jobId}/offcuts/`);
  return res.json();
}

export async function addOffcutToStock(offcutId) {
  const res = await authFetch(`${BASE_URL}/api/cadcam/offcuts/${offcutId}/add-to-stock/`, {
    method: 'POST',
  });
  return res.json();
}

export async function sendToOptimizer(jobId) {
  const res = await authFetch(`${BASE_URL}/api/cadcam/import-jobs/${jobId}/send-to-optimizer/`, {
    method: 'POST',
  });
  return res.json();
}

export async function getCadCamSettings() {
  const res = await authFetch(`${BASE_URL}/api/tenants/settings/`);
  return res.json();
}

export async function updateCadCamSettings(patch) {
  const res = await authFetch(`${BASE_URL}/api/tenants/settings/`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return res.json();
}
