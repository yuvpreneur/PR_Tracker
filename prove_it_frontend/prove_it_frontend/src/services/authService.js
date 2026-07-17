import { API_BASE_URL } from '../utils/constants';

export async function login(username, password) {
  const form = new URLSearchParams();
  form.append('username', username);
  form.append('password', password);

  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(err.detail || 'Invalid credentials');
  }

  const data = await res.json();
  localStorage.setItem('token', data.access_token);
  return data;
}

export async function getMe() {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No token');

  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) throw new Error('Session expired');
  return res.json();
}

export function logout() {
  localStorage.removeItem('token');
}

export function getToken() {
  return localStorage.getItem('token');
}
