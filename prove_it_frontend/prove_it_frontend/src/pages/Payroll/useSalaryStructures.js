import { useCallback, useEffect, useState } from 'react';
import { get, post, patch, del } from '../../services/httpClient.js';

export default function useSalaryStructures() {
  const [structures, setStructures] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await get('/api/salary-structures').catch(() => []);
    setStructures(rows || []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createStructure = payload => post('/api/salary-structures', payload).then(r => { refresh(); return r; });
  const updateStructure = (id, payload) => patch(`/api/salary-structures/${id}`, payload).then(r => { refresh(); return r; });
  const deleteStructure = id => del(`/api/salary-structures/${id}`).then(r => { refresh(); return r; });

  return { structures, loading, refresh, createStructure, updateStructure, deleteStructure };
}
