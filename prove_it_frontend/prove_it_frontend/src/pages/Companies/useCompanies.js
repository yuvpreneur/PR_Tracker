import { useCallback, useEffect, useState } from 'react';
import { get } from '../../services/httpClient.js';
import { state } from '../../bridge/core/state.js';

// Mirrors src/pages/Projects/useProjects.js's pattern: the legacy
// bridge/pages/companies.js loadCompanies() still runs (nav clicks, modal save/delete
// all trigger it) and dispatches 'companies:changed' once it's done — that's how this
// hook knows to refetch after a create/edit/delete made through the still-legacy
// modal-company modal.
export default function useCompanies() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await get('/api/companies').catch(() => []);
    setCompanies(rows || []);
    // Keeps the legacy `.bridge-edit`/`.bridge-delete` delegation's row lookup
    // (bridge/index.js, reads state.companies) in sync with what's actually on screen.
    state.companies = rows || [];
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener('companies:changed', refresh);
    return () => document.removeEventListener('companies:changed', refresh);
  }, [refresh]);

  return { companies, loading, refresh };
}
