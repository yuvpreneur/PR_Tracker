import { useCallback, useEffect, useState } from 'react';
import { get } from '../../services/httpClient.js';

export default function useAvailablePlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await get('/api/subscriptions/available-plans');
      setPlans(rows || []);
    } catch (err) {
      setError(err.message || 'Failed to load plans');
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { plans, loading, error, refresh };
}
