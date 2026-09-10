const BASE_URL = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app';

export async function registerCustomer(data) {
  const res = await fetch(`${BASE_URL}/api/auth/register/customer/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function registerArchitect(data) {
  const res = await fetch(`${BASE_URL}/api/auth/register/architect/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function registerManufacturer(formData) {
  const res = await fetch(`${BASE_URL}/api/auth/register/manufacturer/`, {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

export async function registerSupplier(formData) {
  const res = await fetch(`${BASE_URL}/api/auth/register/supplier/`, {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

export async function loginUser(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export function saveSession(tokens, user) {
  localStorage.setItem('access_token', tokens.access);
  localStorage.setItem('refresh_token', tokens.refresh);
  localStorage.setItem('user', JSON.stringify(user));
}

export function getUser() {
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
}

export function getCompany() {
  const u = getUser();
  return u?.company || null;
}

export function isStaff() {
  const u = getUser();
  return !!u?.is_staff;
}

export function hasPermission(code) {
  const company = getCompany();
  if (!company) return false;
  return company.role === 'owner' || (company.permissions || []).includes(code);
}

export function getToken() {
  return localStorage.getItem('access_token');
}

export function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
}

export async function refreshAccessToken() {
  const refresh = localStorage.getItem('refresh_token')
  if (!refresh) return null
  const res = await fetch(`${BASE_URL}/api/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
  if (res.ok) {
    const data = await res.json()
    localStorage.setItem('access_token', data.access)
    return data.access
  }
  return null
}

export async function authFetch(url, options = {}) {
  const token = localStorage.getItem('access_token')
  // Don't set Content-Type for FormData — the browser sets it with the multipart boundary
  const defaultHeaders = options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }
  const headers = { ...defaultHeaders, ...options.headers }
  if (token) headers['Authorization'] = 'Bearer ' + token
  let res = await fetch(url, { ...options, headers })
  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      headers['Authorization'] = 'Bearer ' + newToken
      res = await fetch(url, { ...options, headers })
    }
  }
  if (res.status === 403) {
    // Distinguish "company access blocked" (trial expired/suspended, HasActiveCompany)
    // from "missing a granular permission" (RequirePermission('hr.view_salary') etc.)
    // — only the former should trigger the global trial/billing banner.
    let isPermissionDenied = false
    try {
      const body = await res.clone().json()
      isPermissionDenied = typeof body?.detail === 'string' && body.detail.startsWith('Missing permission:')
    } catch {}
    if (!isPermissionDenied) {
      window.dispatchEvent(new CustomEvent('woodcalc:access-denied'))
    }
  }
  return res
}

export function withCompanyParam(url, companySlug) {
  if (!companySlug) return url
  return url + (url.includes('?') ? '&' : '?') + 'company=' + encodeURIComponent(companySlug)
}
