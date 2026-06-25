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

export function getToken() {
  return localStorage.getItem('access_token');
}

export function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
}
