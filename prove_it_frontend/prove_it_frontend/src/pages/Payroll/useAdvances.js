import { useCallback, useEffect, useState } from 'react';
import { get, post, del } from '../../services/httpClient.js';

export default function useAdvances() {
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await get('/api/advances').catch(() => []);
    setAdvances(rows || []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createAdvance = payload => post('/api/advances', payload).then(r => { refresh(); return r; });
  const closeAdvance = id => post(`/api/advances/${id}/close`).then(r => { refresh(); return r; });
  const deleteAdvance = id => del(`/api/advances/${id}`).then(r => { refresh(); return r; });

  return { advances, loading, refresh, createAdvance, closeAdvance, deleteAdvance };
}
