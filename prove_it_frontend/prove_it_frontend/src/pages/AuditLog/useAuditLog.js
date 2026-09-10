import { useCallback, useEffect, useState } from 'react';
import { get, qs } from '../../services/httpClient.js';
import { state } from '../../bridge/core/state.js';
import { periodRange } from '../../utils/format.js';

// Server-side filtered like the legacy loadAudit() — period maps to a
// date_from/date_to range (periodRange(), reused as-is), module/user/search
// are real backend query params too (see app/routers/audit_log.py).
export default function useAuditLog({ module, user, period, search } = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const params = { module, user, ...periodRange(period), search };
    const data = await get('/api/audit-log/' + qs(params)).catch(() => null);
    // `data?.logs || data || []` returned `data` itself when it was a non-array object
    // (an error body, or a 2xx that didn't parse) — truthy, so it sailed past both `||`
    // and reached DataTable as `rows`, where .map took the page down.
    const logs = Array.isArray(data?.logs) ? data.logs : (Array.isArray(data) ? data : []);
    setRows(logs);
    // Keeps the legacy `.bridge-edit`/`.bridge-delete` delegation's row lookup
    // (bridge/index.js, reads state.auditLogs) in sync with what's on screen.
    state.auditLogs = logs;
    setLoading(false);
  }, [module, user, period, search]);

  useEffect(() => {
    refresh();
    document.addEventListener('audit:changed', refresh);
    return () => document.removeEventListener('audit:changed', refresh);
  }, [refresh]);

  return { rows, loading, refresh };
}
