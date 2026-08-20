import { useCallback, useEffect, useState } from 'react';
import { get, post, patch } from '../../services/httpClient.js';

export default function useSubAdmins() {
  const [subAdmins, setSubAdmins] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await get('/api/sub-admins/').catch(() => []);
    setSubAdmins(rows || []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createSubAdmin = useCallback(async (payload) => {
    await post('/api/sub-admins/', payload);
    await refresh();
  }, [refresh]);

  const updateSubAdmin = useCallback(async (id, patchBody) => {
    await patch(`/api/sub-admins/${id}`, patchBody);
    await refresh();
  }, [refresh]);

  const resetPassword = useCallback(async (id, newPassword) => {
    await post(`/api/sub-admins/${id}/reset-password`, { new_password: newPassword });
  }, []);

  return { subAdmins, loading, createSubAdmin, updateSubAdmin, resetPassword };
}
