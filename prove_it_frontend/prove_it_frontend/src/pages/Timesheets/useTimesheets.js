import { useCallback, useEffect, useState } from 'react';
import { get, qs } from '../../bridge/core/http.js';
import { state } from '../../bridge/core/state.js';
import { periodRange } from '../../bridge/shared/ui.js';

// period='' means "All Time" (no date filter) here — unlike periodRange('') itself,
// which defaults to "today". Mirrors the legacy tsPeriodRange() wrapper exactly.
function tsPeriodRange(period) {
  return period ? periodRange(period) : {};
}

export default function useTimesheets({ period, projectId, billingCodeId, status, search } = {}) {
  const [timesheets, setTimesheets] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const params = { ...tsPeriodRange(period), project_id: projectId, billing_code_id: billingCodeId, status, search };
    const rows = await get('/api/timesheets' + qs(params)).catch(() => []);
    setTimesheets(rows || []);
    // Keeps the legacy `.bridge-edit`/`.bridge-delete`/`.bridge-approve`/`.bridge-reject`
    // delegation's row lookup (bridge/index.js, reads state.timesheets) in sync.
    state.timesheets = rows || [];
    setLoading(false);
  }, [period, projectId, billingCodeId, status, search]);

  useEffect(() => {
    refresh();
    document.addEventListener('timesheets:changed', refresh);
    return () => document.removeEventListener('timesheets:changed', refresh);
  }, [refresh]);

  return { timesheets, loading, refresh };
}
