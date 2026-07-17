import { get } from './http.js';
import { state } from './state.js';

export function username() {
  try { return JSON.parse(atob(localStorage.getItem('token').split('.')[1])).sub || ''; } catch { return ''; }
}

export async function refreshCaches() {
  [state.projects, state.employees, state.pcodes, state.bcodes, state.companies] = await Promise.allSettled([
    get('/api/projects'),
    get('/api/employees'),
    get('/api/project-codes'),
    get('/api/billing-codes'),
    get('/api/companies'),
  ]).then(rs => rs.map(r => r.value || []));
}
