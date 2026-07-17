import { useCallback, useEffect, useState } from 'react';
import { get } from '../../bridge/core/http.js';
import { state } from '../../bridge/core/state.js';

// Same pattern as useProjectCodes.js — billing codes carry a project_id FK, so this
// also fetches /api/projects to join in the project name (mirrors the legacy
// loadBillingCodes()'s reliance on state.projects for the same join).
export default function useBillingCodes() {
  const [bcodes, setBcodes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [codes, projs] = await Promise.all([
      get('/api/billing-codes').catch(() => []),
      get('/api/projects').catch(() => []),
    ]);
    setBcodes(codes || []);
    setProjects(projs || []);
    // Keeps the legacy `.bridge-edit`/`.bridge-delete` delegation's row lookup
    // (bridge/index.js, reads state.bcodes) in sync with what's actually on screen.
    state.bcodes = codes || [];
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener('billing-codes:changed', refresh);
    return () => document.removeEventListener('billing-codes:changed', refresh);
  }, [refresh]);

  return { bcodes, projects, loading, refresh };
}
