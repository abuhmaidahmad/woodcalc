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

// ─── Employee login links & stations ────────────────────────────────────────
export async function listLinkableUsers() {
  const res = await authFetch(`${BASE_URL}/api/hr/employees/linkable-users/`);
  if (!res.ok) return [];
  return res.json();
}

export async function listStations() {
  const res = await authFetch(`${BASE_URL}/api/manufacturing/stations/`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.results || []);
}

// ─── Payroll settings (one per company) ─────────────────────────────────────
// PATCH helpers return { ok, data } so callers can show field errors (400 bodies).
async function jsonResult(res) {
  let data = null
  try { data = await res.json() } catch {}
  return { ok: res.ok, status: res.status, data }
}

export async function getPayrollSettings() {
  return jsonResult(await authFetch(`${BASE_URL}/api/hr/payroll-settings/`));
}

export async function updatePayrollSettings(data) {
  return jsonResult(await authFetch(`${BASE_URL}/api/hr/payroll-settings/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }));
}

export async function updateEmployeeChecked(id, data) {
  return jsonResult(await authFetch(`${BASE_URL}/api/hr/employees/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }));
}

// ─── Allowance types (company-wide) ─────────────────────────────────────────
export async function listAllowanceTypes() {
  const res = await authFetch(`${BASE_URL}/api/hr/allowance-types/`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : (data.results || []);
}

export async function createAllowanceType(data) {
  return jsonResult(await authFetch(`${BASE_URL}/api/hr/allowance-types/`, {
    method: 'POST',
    body: JSON.stringify(data),
  }));
}

export async function updateAllowanceType(id, data) {
  return jsonResult(await authFetch(`${BASE_URL}/api/hr/allowance-types/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }));
}

// ─── Employee allowances ────────────────────────────────────────────────────
export async function listEmployeeAllowances(employeeId) {
  const res = await authFetch(`${BASE_URL}/api/hr/employee-allowances/?employee=${employeeId}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : (data.results || []);
}

export async function createEmployeeAllowance(data) {
  return jsonResult(await authFetch(`${BASE_URL}/api/hr/employee-allowances/`, {
    method: 'POST',
    body: JSON.stringify(data),
  }));
}

export async function updateEmployeeAllowance(id, data) {
  return jsonResult(await authFetch(`${BASE_URL}/api/hr/employee-allowances/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }));
}

export async function deleteEmployeeAllowance(id) {
  return authFetch(`${BASE_URL}/api/hr/employee-allowances/${id}/`, { method: 'DELETE' });
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

// Turn a DRF 400 body ({ field: ["msg"] } or { detail }) into one readable line per field.
export function formatErrors(data, labelFor = k => k) {
  if (!data) return ''
  if (typeof data.detail === 'string') return data.detail
  return Object.entries(data)
    .map(([k, v]) => `${labelFor(k)}: ${[].concat(v).map(x => (typeof x === 'object' ? JSON.stringify(x) : x)).join(' ')}`)
    .join('\n')
}
