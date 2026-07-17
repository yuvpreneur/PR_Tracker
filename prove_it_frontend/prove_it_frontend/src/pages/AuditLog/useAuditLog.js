import { useCallback, useEffect, useState } from 'react';
import { get, qs } from '../../bridge/core/http.js';
import { state } from '../../bridge/core/state.js';
import { periodRange } from '../../bridge/shared/ui.js';

// Server-side filtered like the legacy loadAudit() — period maps to a
// date_from/date_to range (periodRange(), reused as-is), module/user/search
// are real backend query params too (see app/routers/audit_log.py).
export default function useAuditLog({ module, user, period, search } = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const params = { module, user, ...periodRange(period), search };
    const data = await get('/api/audit-log/' + qs(params)).catch(() => null);
    const logs = data?.logs || data || [];
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
