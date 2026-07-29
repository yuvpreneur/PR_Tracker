import { useCallback, useEffect, useState } from 'react';
import { get } from '../../services/httpClient.js';
import { state } from '../../bridge/core/state.js';
import { setNavBadge } from '../../bridge/shared/ui.js';

// Cross-module dashboard — one real backend endpoint bundles pending rows from
// four different modules. Type filtering is client-side (matches the legacy
// renderApprovalsTable(filter), which just filters the already-fetched array).
export default function useApprovals() {
  const [counts, setCounts] = useState({ timesheets: 0, expenses: 0, leave: 0, access: 0 });
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await get('/api/approvals/pending').catch(() => null);
    if (!data) { setLoading(false); return; }
    const tagged = [
      ...(data.timesheets || []).map(r => ({ ...r, _mod: 'timesheets' })),
      ...(data.expenses || []).map(r => ({ ...r, _mod: 'expenses' })),
      ...(data.leave || []).map(r => ({ ...r, _mod: 'leave' })),
      ...(data.access_requests || []).map(r => ({ ...r, _mod: 'access' })),
    ];
    setAll(tagged);
    const nextCounts = {
      timesheets: (data.timesheets || []).length,
      expenses: (data.expenses || []).length,
      leave: (data.leave || []).length,
      access: (data.access_requests || []).length,
    };
    setCounts(nextCounts);
    setNavBadge('approvals', nextCounts.timesheets + nextCounts.expenses + nextCounts.leave + nextCounts.access);
    // Keeps the legacy `.bridge-view`/`.bridge-approve`/`.bridge-reject` delegation's
    // row lookup (bridge/index.js, reads state.approvalsAll) in sync with what's on screen.
    state.approvalsAll = tagged;
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener('approvals:changed', refresh);
    return () => document.removeEventListener('approvals:changed', refresh);
  }, [refresh]);

  return { counts, all, loading, refresh };
}
