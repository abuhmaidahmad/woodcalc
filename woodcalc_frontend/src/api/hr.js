import { authFetch } from './auth';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app';

// ─── Departments ────────────────────────────────────────────────────────────
export async function listDepartments() {
  const res = await authFetch(`${BASE_URL}/api/hr/departments/`);
  return res.json();
}

// ─── Employees ──────────────────────────────────────────────────────────────
export async function listEmployees() {
  const res = await authFetch(`${BASE_URL}/api/hr/employees/`);
  return res.json();
}

export async function getEmployee(id) {
  const res = await authFetch(`${BASE_URL}/api/hr/employees/${id}/`);
  return res.json();
}

export async function createEmployee(data) {
  const res = await authFetch(`${BASE_URL}/api/hr/employees/`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateEmployee(id, data) {
  const res = await authFetch(`${BASE_URL}/api/hr/employees/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteEmployee(id) {
  return authFetch(`${BASE_URL}/api/hr/employees/${id}/`, { method: 'DELETE' });
}

// ─── Attendance ─────────────────────────────────────────────────────────────
export async function listAttendance(employeeId) {
  const url = employeeId
    ? `${BASE_URL}/api/hr/attendance/?employee=${employeeId}`
    : `${BASE_URL}/api/hr/attendance/`;
  const res = await authFetch(url);
  return res.json();
}

export async function createAttendance(data) {
  const res = await authFetch(`${BASE_URL}/api/hr/attendance/`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateAttendance(id, data) {
  const res = await authFetch(`${BASE_URL}/api/hr/attendance/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteAttendance(id) {
  return authFetch(`${BASE_URL}/api/hr/attendance/${id}/`, { method: 'DELETE' });
}

// ─── Leave requests ─────────────────────────────────────────────────────────
export async function listLeaveRequests(employeeId) {
  const url = employeeId
    ? `${BASE_URL}/api/hr/leave-requests/?employee=${employeeId}`
    : `${BASE_URL}/api/hr/leave-requests/`;
  const res = await authFetch(url);
  return res.json();
}

export async function createLeaveRequest(data) {
  const res = await authFetch(`${BASE_URL}/api/hr/leave-requests/`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteLeaveRequest(id) {
  return authFetch(`${BASE_URL}/api/hr/leave-requests/${id}/`, { method: 'DELETE' });
}

export async function approveLeaveRequest(id, decisionNote) {
  const res = await authFetch(`${BASE_URL}/api/hr/leave-requests/${id}/approve/`, {
    method: 'POST',
    body: JSON.stringify({ decision_note: decisionNote || '' }),
  });
  return res.json();
}

export async function rejectLeaveRequest(id, decisionNote) {
  const res = await authFetch(`${BASE_URL}/api/hr/leave-requests/${id}/reject/`, {
    method: 'POST',
    body: JSON.stringify({ decision_note: decisionNote || '' }),
  });
  return res.json();
}

// ─── Payroll ────────────────────────────────────────────────────────────────
export async function listPayroll(params) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await authFetch(`${BASE_URL}/api/hr/payroll/${qs}`);
  return res.json();
}

export async function updatePayroll(id, data) {
  const res = await authFetch(`${BASE_URL}/api/hr/payroll/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function generatePayroll(period) {
  const res = await authFetch(`${BASE_URL}/api/hr/payroll/generate/`, {
    method: 'POST',
    body: JSON.stringify({ period }),
  });
  return res.json();
}

// ─── Team / permissions ─────────────────────────────────────────────────────
export async function listPermissions() {
  const res = await authFetch(`${BASE_URL}/api/tenants/permissions/`);
  return res.json();
}

export async function listMembers() {
  const res = await authFetch(`${BASE_URL}/api/tenants/members/`);
  return res.json();
}

export async function createMember(data) {
  const res = await authFetch(`${BASE_URL}/api/tenants/members/`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateMember(id, data) {
  const res = await authFetch(`${BASE_URL}/api/tenants/members/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function removeMember(id) {
  return authFetch(`${BASE_URL}/api/tenants/members/${id}/`, { method: 'DELETE' });
}
