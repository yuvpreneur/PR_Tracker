import { useCallback, useEffect, useState } from 'react';
import { get, post } from '../../services/httpClient.js';

export default function useFreeAccess() {
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await get('/api/subscriptions/free-access').catch(() => []);
    setGrants(rows || []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const grantAccess = useCallback(async ({ orgId, planId, note }) => {
    await post('/api/subscriptions/free-access', { org_id: orgId, plan_id: planId, note: note || null });
    await refresh();
  }, [refresh]);

  const revokeAccess = useCallback(async (orgId) => {
    await post(`/api/subscriptions/free-access/${orgId}/revoke`, {});
    await refresh();
  }, [refresh]);

  return { grants, loading, grantAccess, revokeAccess };
}
