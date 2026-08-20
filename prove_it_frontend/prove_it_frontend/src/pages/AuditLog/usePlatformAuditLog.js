import { useCallback, useEffect, useState } from 'react';
import { get, qs } from '../../services/httpClient.js';
import { periodRange } from '../../utils/format.js';

export default function usePlatformAuditLog({ module, user, period, search, limit } = {}) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const params = { module, user, ...periodRange(period), search, limit };
    const data = await get('/api/audit-log/platform' + qs(params)).catch(() => null);
    setRows(data?.logs || []);
    setTotal(data?.total || 0);
    setLoading(false);
  }, [module, user, period, search, limit]);

  useEffect(() => { refresh(); }, [refresh]);

  return { rows, total, loading, refresh };
}
