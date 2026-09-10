import { useCallback, useEffect, useState } from 'react';
import { get } from '../../services/httpClient.js';

export default function useMySubscription() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await get('/api/subscriptions/me').catch(() => null);
    setSubscription(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { subscription, loading, refresh };
}
