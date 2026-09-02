import { get } from './http.js';
import { state } from './state.js';

export function username() {
  try { return JSON.parse(atob(localStorage.getItem('token').split('.')[1])).sub || ''; } catch { return ''; }
}

export async function refreshCaches() {
  const results = await Promise.allSettled([
    get('/api/projects').catch(() => []),
    get('/api/employees').catch(() => []),
    get('/api/project-codes').catch(() => []),
    get('/api/billing-codes').catch(() => []),
    get('/api/companies').catch(() => []),
  ]).then(rs => rs.map(r => r.value || []));
  [state.projects, state.employees, state.pcodes, state.bcodes, state.companies] = results;
}
