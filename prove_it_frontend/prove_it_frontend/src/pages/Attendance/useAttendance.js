import { useCallback, useEffect, useState } from 'react';
import { get, qs } from '../../bridge/core/http.js';
import { state } from '../../bridge/core/state.js';
import { periodRange } from '../../bridge/shared/ui.js';

// Server-side filtered like the legacy loadAttendance() — period maps to a
// date_from/date_to range (periodRange(), reused as-is, framework-agnostic),
// emp_id/att_status/search are real backend query params too (see
// state.PARAM_MAP / state.PAGE_PARAM_OVERRIDES in bridge/core/state.js).
export default function useAttendance({ period, empId, status, search } = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const params = { ...periodRange(period), emp_id: empId, att_status: status, search };
    const data = await get('/api/attendance' + qs(params)).catch(() => []);
    setRows(data || []);
    // Keeps the legacy `.bridge-edit`/`.bridge-approve`/`.bridge-reject` delegation's
    // row lookup (bridge/index.js, reads state.attendance) in sync with what's on screen.
    state.attendance = data || [];
    setLoading(false);
  }, [period, empId, status, search]);

  useEffect(() => {
    refresh();
    document.addEventListener('attendance:changed', refresh);
    return () => document.removeEventListener('attendance:changed', refresh);
  }, [refresh]);

  return { rows, loading, refresh };
}
