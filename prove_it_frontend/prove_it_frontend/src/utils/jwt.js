// Relocated verbatim from src/bridge/core/cache.js and src/bridge/shared/ui.js as part of
// the bridge-removal migration (Phase 1).

export function username() {
  try { return JSON.parse(atob(localStorage.getItem('token').split('.')[1])).sub || ''; } catch { return ''; }
}

const ROLE_KEY_MAP = { Admin: 'admin', Manager: 'manager', 'Finance User': 'finance', Employee: 'employee' };

export function activeRole() {
  try {
    const payload = JSON.parse(atob(localStorage.getItem('token').split('.')[1]));
    return ROLE_KEY_MAP[payload.role] || 'admin';
  } catch { return 'admin'; }
}
