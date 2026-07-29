import { useCallback, useEffect, useState } from 'react';
import { get } from '../../services/httpClient.js';
import { state } from '../../bridge/core/state.js';

// Invoices is a view+edit layer over the Receivables backend (/api/receivables) —
// mirrors the legacy loadInvoices(), which reads the same endpoint into state.invoices.
export default function useInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [rows, projs] = await Promise.all([
      get('/api/receivables').catch(() => []),
      get('/api/projects').catch(() => []),
    ]);
    setInvoices(rows || []);
    setProjects(projs || []);
    // Keeps the legacy `.bridge-view`/`.bridge-edit` delegation's row lookup
    // (bridge/index.js, reads state.invoices) in sync with what's on screen.
    state.invoices = rows || [];
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener('invoices:changed', refresh);
    return () => document.removeEventListener('invoices:changed', refresh);
  }, [refresh]);

  return { invoices, projects, loading, refresh };
}
