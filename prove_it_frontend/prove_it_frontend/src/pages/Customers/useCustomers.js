import { useCallback, useEffect, useState } from 'react';
import { get } from '../../services/httpClient.js';
import { state } from '../../bridge/core/state.js';

// Customers is a finance-facing view of the same /api/companies records as the
// Companies page — same endpoint, different columns, shared modal-company.
export default function useCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await get('/api/companies').catch(() => []);
    setCustomers(Array.isArray(rows) ? rows : []);
    // Keeps the legacy `.bridge-edit`/`.bridge-delete` delegation's row lookup
    // (bridge/index.js, reads state.companies — shared with the Companies page) in
    // sync with what's on screen.
    state.companies = Array.isArray(rows) ? rows : [];
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener('customers:changed', refresh);
    return () => document.removeEventListener('customers:changed', refresh);
  }, [refresh]);

  return { customers, loading, refresh };
}
