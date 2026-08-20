import { useCallback, useEffect, useState } from 'react';
import { get } from '../../services/httpClient.js';

const blank = {
  organizations: { total: 0, new_this_month: 0 },
  users: { total: 0 },
  subscriptions: { active_paid: 0, free_or_trial: 0 },
  mrr: 0,
  revenue_growth: [],
  plan_distribution: [],
  system_health: { api: 'Online', database: 'Online', environment: 'development' },
};

export default function useOverview() {
  const [data, setData] = useState(blank);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await get('/api/platform-overview/').catch(() => null);
    setData(rows || blank);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, refresh };
}
