import { useCallback, useEffect, useState } from 'react';
import { get } from '../../services/httpClient.js';
import { state } from '../../bridge/core/state.js';

// Same /api/receivables endpoint as Invoices — shared modal-recv, different columns
// and action set (Receivables has real edit+delete; Invoices is View + gated Edit).
export default function useReceivables() {
  const [receivables, setReceivables] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [rows, projs] = await Promise.all([
      get('/api/receivables').catch(() => []),
      get('/api/projects').catch(() => []),
    ]);
    setReceivables(rows || []);
    setProjects(projs || []);
    // Keeps the legacy `.bridge-edit`/`.bridge-delete` delegation's row lookup
    // (bridge/index.js, reads state.receivables) in sync with what's on screen.
    state.receivables = rows || [];
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener('receivables:changed', refresh);
    return () => document.removeEventListener('receivables:changed', refresh);
  }, [refresh]);

  return { receivables, projects, loading, refresh };
}
