import { useCallback, useEffect, useState } from 'react';
import { get } from '../../services/httpClient.js';
import { state } from '../../bridge/core/state.js';
import { setNavBadge } from '../../bridge/shared/ui.js';

// Mirrors ServiceDeskPage.jsx's OPEN_STATUSES — tickets still needing action, as opposed
// to Resolved/Closed/Cancelled — used here only to size the sidebar nav badge.
const OPEN_STATUSES = ['Open', 'In Progress', 'Waiting Approval'];

// No filter bar exists on this page in the legacy markup — a single unfiltered
// fetch, client-side rendering, same as Companies/Projects.
export default function useServiceDesk() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await get('/api/tickets').catch(() => []);
    setTickets(rows || []);
    // Keeps the legacy `.bridge-edit`/`.bridge-resolve`/`.bridge-close` delegation's
    // row lookup (bridge/index.js, reads state.tickets) in sync with what's on screen.
    state.tickets = rows || [];
    setNavBadge('service-desk', (rows || []).filter(r => OPEN_STATUSES.includes(r.status)).length);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener('service-desk:changed', refresh);
    return () => document.removeEventListener('service-desk:changed', refresh);
  }, [refresh]);

  return { tickets, loading, refresh };
}
