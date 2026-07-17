import { useCallback, useEffect, useState } from 'react';
import { get, qs } from '../../bridge/core/http.js';
import { state } from '../../bridge/core/state.js';

// Server-side filtered, like the legacy loadLeads() (get('/api/leads' + qs(...))) —
// unlike the simpler pages so far, Leads' "owner" filter interacts with per-role
// visibility scoping on the backend (see OWN_RECORD_PAGES in permissions.js), so
// filtering has to be a real query param, not a client-side array filter.
export default function useLeads({ stage, owner, search } = {}) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await get('/api/leads' + qs({ stage, owner, search })).catch(() => []);
    setLeads(rows || []);
    // The legacy `.bridge-edit`/`.bridge-delete` delegation (bridge/index.js) looks
    // up the clicked row from state.leads, populated independently by the legacy
    // loadLeads() — which may run with different filters than this hook (or not at
    // all yet). Keeping state.leads in sync with whatever this hook just fetched
    // ensures the edit/delete lookup always matches what's actually on screen.
    state.leads = rows || [];
    setLoading(false);
  }, [stage, owner, search]);

  useEffect(() => {
    refresh();
    document.addEventListener('leads:changed', refresh);
    return () => document.removeEventListener('leads:changed', refresh);
  }, [refresh]);

  return { leads, loading, refresh };
}
