import { useCallback, useEffect, useState } from 'react';
import { get } from '../../bridge/core/http.js';
import { state } from '../../bridge/core/state.js';

// No filter bar exists on this page in the legacy markup (unlike Leads) — a
// single unfiltered fetch, client-side rendering, same as Companies/Projects.
export default function useServiceDesk() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await get('/api/tickets').catch(() => []);
    setTickets(rows || []);
    // Keeps the legacy `.bridge-edit`/`.bridge-resolve`/`.bridge-close` delegation's
    // row lookup (bridge/index.js, reads state.tickets) in sync with what's on screen.
    state.tickets = rows || [];
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener('service-desk:changed', refresh);
    return () => document.removeEventListener('service-desk:changed', refresh);
  }, [refresh]);

  return { tickets, loading, refresh };
}
