import { useCallback, useEffect, useState } from 'react';
import { get, patch } from '../../services/httpClient.js';

export default function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await get('/api/subscriptions/').catch(() => []);
    setSubscriptions(rows || []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const assignSubscription = useCallback(async (orgId, { planId, isActive, note }) => {
    await patch(`/api/subscriptions/${orgId}`, { plan_id: planId, is_active: isActive, note });
    await refresh();
  }, [refresh]);

  const subscriptionFor = useCallback(
    (orgId) => subscriptions.find(s => s.org_id === orgId) || null,
    [subscriptions],
  );

  return { subscriptions, loading, assignSubscription, subscriptionFor };
}
