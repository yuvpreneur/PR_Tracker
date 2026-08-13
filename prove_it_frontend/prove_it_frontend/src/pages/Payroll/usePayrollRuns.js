import { useCallback, useEffect, useState } from 'react';
import { get, post, patch, del } from '../../services/httpClient.js';

export default function usePayrollRuns() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await get('/api/payroll/runs').catch(() => []);
    setRuns(rows || []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createRun = payload => post('/api/payroll/runs', payload).then(r => { refresh(); return r; });
  const getRun = id => get(`/api/payroll/runs/${id}`);
  const updateLine = (runId, lineId, payload) => patch(`/api/payroll/runs/${runId}/lines/${lineId}`, payload);
  const finalizeRun = id => post(`/api/payroll/runs/${id}/finalize`).then(r => { refresh(); return r; });
  const voidRun = id => post(`/api/payroll/runs/${id}/void`).then(r => { refresh(); return r; });
  const deleteRun = id => del(`/api/payroll/runs/${id}`).then(r => { refresh(); return r; });

  return { runs, loading, refresh, createRun, getRun, updateLine, finalizeRun, voidRun, deleteRun };
}
