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

// Bootstrap-only: lets the sign-in page decide whether to show "Create admin account".
// Backend closes this for good the moment any user exists (see app/routers/auth.py).
export async function checkRegistrationAvailable() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/registration-status`);
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.available;
  } catch {
    return false;
  }
}

export async function register({ username, password, name, email }) {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, name, email }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(err.detail || 'Registration failed');
  }

  const data = await res.json();
  localStorage.setItem('token', data.access_token);
  return data;
}

// Bootstrap-only, platform-wide: lets the sign-in page decide whether to show "Create
// Super Admin account". Unlike checkRegistrationAvailable() above (which closes the
// moment ANY user exists), this only closes once a Super Admin specifically exists —
// see app/routers/auth.py's super_admin_status().
export async function checkSuperAdminAvailable() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/super-admin-status`);
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.available;
  } catch {
    return false;
  }
}

export async function registerSuperAdmin({ username, password, name, email, setupToken }) {
  const res = await fetch(`${API_BASE_URL}/api/auth/register-super-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, name, email, setup_token: setupToken }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(err.detail || 'Registration failed');
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

// Admin-only "View as role" — mints a short-lived token for a real account of the
// target role via POST /api/auth/view-as (server enforces the Admin check and audit
// logs it; see app/routers/auth.py). Works in production, not gated on a dev build.
export async function viewAs(role) {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No token');

  const res = await fetch(`${API_BASE_URL}/api/auth/view-as`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ role }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Could not switch role' }));
    throw new Error(err.detail || 'Could not switch role');
  }

  const data = await res.json();
  localStorage.setItem('token', data.access_token);
  return data;
}

// Always resolves with a generic message regardless of whether the email belongs to an
// account (the backend intentionally never reveals that — see app/routers/auth.py).
export async function forgotPassword(email) {
  const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Could not process your request.');
  return data;
}

export async function resetPassword(token, newPassword) {
  const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, new_password: newPassword }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Could not reset your password.');
  return data;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('real_token');
}

export function getToken() {
  return localStorage.getItem('token');
}
