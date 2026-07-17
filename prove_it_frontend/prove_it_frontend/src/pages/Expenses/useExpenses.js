import { useCallback, useEffect, useState } from 'react';
import { get } from '../../bridge/core/http.js';
import { state } from '../../bridge/core/state.js';

// Same join-against-/api/projects pattern as Project Codes/Billing Codes.
export default function useExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [rows, projs] = await Promise.all([
      get('/api/expenses').catch(() => []),
      get('/api/projects').catch(() => []),
    ]);
    setExpenses(rows || []);
    setProjects(projs || []);
    // Keeps the legacy `.bridge-edit`/`.bridge-delete`/`.bridge-approve`/`.bridge-reject`
    // delegation's row lookup (bridge/index.js, reads state.expenses) in sync.
    state.expenses = rows || [];
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener('expenses:changed', refresh);
    return () => document.removeEventListener('expenses:changed', refresh);
  }, [refresh]);

  return { expenses, projects, loading, refresh };
}
