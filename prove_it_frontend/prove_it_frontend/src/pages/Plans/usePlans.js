import { useCallback, useEffect, useState } from 'react';
import { get, post, patch } from '../../services/httpClient.js';

export default function usePlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await get('/api/subscriptions/plans').catch(() => []);
    setPlans(rows || []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createPlan = useCallback(async (plan) => {
    await post('/api/subscriptions/plans', plan);
    await refresh();
  }, [refresh]);

  const updatePlan = useCallback(async (planId, patchBody) => {
    await patch(`/api/subscriptions/plans/${planId}`, patchBody);
    await refresh();
  }, [refresh]);

  return { plans, loading, createPlan, updatePlan, refresh };
}
