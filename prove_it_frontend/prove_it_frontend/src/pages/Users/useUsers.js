import { useCallback, useEffect, useState } from 'react';
import { get } from '../../services/httpClient.js';
import { state } from '../../bridge/core/state.js';

export default function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await get('/api/users').catch(() => []);
    setUsers(rows || []);
    // Keeps the legacy `.bridge-edit`/`.bridge-delete` delegation's row lookup
    // (bridge/index.js, reads state.users) in sync with what's on screen.
    state.users = rows || [];
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    document.addEventListener('users:changed', refresh);
    return () => document.removeEventListener('users:changed', refresh);
  }, [refresh]);

  return { users, loading, refresh };
}
