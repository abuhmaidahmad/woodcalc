import { authFetch } from './auth';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app';
const FIELD_OPS = `${BASE_URL}/api/field-ops`;

const listOf = (data) => (Array.isArray(data) ? data : (data?.results || []));

async function send(url, method, data) {
  const res = await authFetch(url, { method, body: data === undefined ? undefined : JSON.stringify(data) });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data: body };
}

function query(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined);
  return entries.length ? '?' + new URLSearchParams(entries).toString() : '';
}

export async function listMyJobs() {
  const res = await authFetch(`${FIELD_OPS}/my-jobs/`);
  return { ok: res.ok, status: res.status, jobs: res.ok ? listOf(await res.json()) : [] };
}

export async function getMyJob(id) {
  const res = await authFetch(`${FIELD_OPS}/my-jobs/${id}/`);
  return { ok: res.ok, status: res.status, job: res.ok ? await res.json() : null };
}

export async function listInstallations(params) {
  const res = await authFetch(`${FIELD_OPS}/installations/${query(params)}`);
  return res.ok ? listOf(await res.json()) : [];
}

export const createInstallation = (data) => send(`${FIELD_OPS}/installations/`, 'POST', data);
export const updateInstallation = (id, data) => send(`${FIELD_OPS}/installations/${id}/`, 'PATCH', data);
export const deleteInstallation = (id) => send(`${FIELD_OPS}/installations/${id}/`, 'DELETE');

export const createAssignment = (data) => send(`${FIELD_OPS}/assignments/`, 'POST', data);
export const updateAssignment = (id, data) => send(`${FIELD_OPS}/assignments/${id}/`, 'PATCH', data);
export const deleteAssignment = (id) => send(`${FIELD_OPS}/assignments/${id}/`, 'DELETE');

export async function listLockedRooms(params) {
  const res = await authFetch(`${FIELD_OPS}/locked-rooms/${query(params)}`);
  return res.ok ? listOf(await res.json()) : [];
}

export async function getLockedRoomCabinets(roomId) {
  const res = await authFetch(`${FIELD_OPS}/locked-rooms/${roomId}/cabinets/`);
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data?.cabinets) ? data.cabinets : null;
}

export async function listCrew() {
  const res = await authFetch(`${FIELD_OPS}/crew/`);
  return res.ok ? listOf(await res.json()) : [];
}
