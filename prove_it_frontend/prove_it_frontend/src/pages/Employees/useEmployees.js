import { useCallback, useEffect, useState } from 'react';
import { get } from '../../services/httpClient.js';
import { state } from '../../bridge/core/state.js';

// Same pattern as useCompanies.js — plain client-side filtering over a single
// unfiltered fetch, no join needed.
export default function useEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await get('/api/employees').catch(() => []);
    setEmployees(rows || []);
    // Keeps the legacy `.bridge-edit`/`.bridge-delete` delegation's row lookup
    // (bridge/index.js, reads state.employees) in sync with what's on screen.
    state.employees = rows || [];
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener('employees:changed', refresh);
    return () => document.removeEventListener('employees:changed', refresh);
  }, [refresh]);

  return { employees, loading, refresh };
}
