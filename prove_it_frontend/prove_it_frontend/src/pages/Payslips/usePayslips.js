import { useCallback, useEffect, useState } from 'react';
import { get } from '../../services/httpClient.js';

export default function usePayslips() {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await get('/api/payslips').catch(() => []);
    setPayslips(rows || []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { payslips, loading, refresh };
}
