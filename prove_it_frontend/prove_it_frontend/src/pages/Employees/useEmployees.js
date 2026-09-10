import { useCallback, useEffect, useState } from 'react';
import { get } from '../../services/httpClient.js';
import { state } from '../../bridge/core/state.js';
import { populateManagerDropdown } from '../../bridge/pages/projects.js';
import { populateCostEmployeeDropdown } from '../../bridge/pages/employees.js';

// Same pattern as useCompanies.js — plain client-side filtering over a single
// unfiltered fetch, no join needed.
export default function useEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const raw = await get('/api/employees').catch(() => []);
    // `|| []` only catches null/undefined — an object (an error body, or a 2xx whose
    // payload didn't parse as JSON) slips straight through and blows up .map downstream.
    const rows = Array.isArray(raw) ? raw : [];
    setEmployees(rows);
    // Keeps the legacy `.bridge-edit`/`.bridge-delete` delegation's row lookup
    // (bridge/index.js, reads state.employees) in sync with what's on screen.
    state.employees = rows;
    // Every page (and its modal) mounts immediately on login regardless of which
    // route is active (see AllPages in AppRoutes.jsx) — refreshing these dropdowns
    // here, rather than only when the legacy nav-click loader happens to run, is
    // what keeps them from ever showing stale/fake data.
    populateManagerDropdown();
    populateCostEmployeeDropdown();
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener('employees:changed', refresh);
    return () => document.removeEventListener('employees:changed', refresh);
  }, [refresh]);

  return { employees, loading, refresh };
}
