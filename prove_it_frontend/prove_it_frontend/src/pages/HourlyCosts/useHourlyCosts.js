import { useCallback, useEffect, useState } from 'react';
import { get } from '../../bridge/core/http.js';
import { state } from '../../bridge/core/state.js';

// The /api/hourly-costs rows already come back with denormalized name/department
// (see bridge/pages/employees.js's loadHourlyCosts()), so no join needed.
export default function useHourlyCosts() {
  const [costs, setCosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await get('/api/hourly-costs').catch(() => []);
    setCosts(rows || []);
    // Keeps the legacy `.bridge-edit`/`.bridge-delete` delegation's row lookup
    // (bridge/index.js, reads state.hourlyCosts) in sync with what's on screen.
    state.hourlyCosts = rows || [];
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener('hourly-costs:changed', refresh);
    return () => document.removeEventListener('hourly-costs:changed', refresh);
  }, [refresh]);

  return { costs, loading, refresh };
}
