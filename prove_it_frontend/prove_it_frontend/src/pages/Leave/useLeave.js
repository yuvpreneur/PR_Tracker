import { useCallback, useEffect, useState } from 'react';
import { get } from '../../services/httpClient.js';
import { state } from '../../bridge/core/state.js';
import { markModuleNotificationsRead } from '../../bridge/shared/notifications.js';

// No filter bar at all on this page (unlike Timesheets) — a single
// unfiltered fetch, plus /api/leave/summary for the three stat cards.
export default function useLeave() {
  const [leave, setLeave] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [rows, s] = await Promise.all([
      get('/api/leave').catch(() => []),
      get('/api/leave/summary').catch(() => null),
    ]);
    setLeave(rows || []);
    setSummary(s);
    // Unlike other pages' delegation, Leave's approve/reject handlers use dataset.id
    // directly with no state.leave row lookup — this line isn't fixing a bug, just
    // kept for consistency with every other migrated page's hook.
    state.leave = rows || [];
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener('leave:changed', refresh);
    return () => document.removeEventListener('leave:changed', refresh);
  }, [refresh]);

  // Visiting this page is what dismisses your own Leave approved/rejected
  // notifications — see markModuleNotificationsRead().
  useEffect(() => { markModuleNotificationsRead('Leave'); }, []);

  return { leave, summary, loading, refresh };
}
