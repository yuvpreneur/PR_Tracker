import { useCallback, useEffect, useState } from 'react';
import { get, qs } from '../../services/httpClient.js';
import { refreshNotifBadge } from '../../bridge/shared/notifications.js';
import useAuth from '../../hooks/useAuth.jsx';

// Ports the real per-role data fetching already live in bridge/pages/dashboard.js's
// loadDashboard()/dashAdmin()/dashFinance()/dashEmployee() (their '#dash-content'
// target is created dynamically at boot by bridge/index.js — not missing, just not
// in the static appHtml) into real React state, same endpoints and fetch shape as
// the vanilla version.
// Manager maps to the same 'admin' fetch/render path — Reports/project-profitability
// already return company-wide, unscoped data to both roles (Manager is a
// FULL_ACCESS_ROLES role, see app/core/permissions.py), so there's no separate
// Manager view left to fetch for.
const ROLE_KEY = { Admin: 'admin', Manager: 'admin', 'Finance User': 'finance', Employee: 'employee' };

export default function useDashboardData(period) {
  const { user } = useAuth();
  const roleKey = ROLE_KEY[user?.role] || 'admin';
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [profit, setProfit] = useState([]);
  const [employee, setEmployee] = useState({ timesheets: [], expenses: [], tickets: [] });

  const refresh = useCallback(async () => {
    setLoading(true);

    if (roleKey === 'employee') {
      const me = user;
      const employees = await get('/api/employees').catch(() => []);
      const empIds = (employees || []).filter(e => e.name === me?.name).map(e => e.emp_id);
      const [ts, allExpenses, allTickets] = await Promise.all([
        Promise.all(empIds.map(id => get('/api/timesheets?emp_id=' + id).catch(() => []))).then(rs => rs.flat()),
        get('/api/expenses').catch(() => []),
        get('/api/tickets').catch(() => []),
      ]);
      setEmployee({
        timesheets: ts,
        expenses: (allExpenses || []).filter(r => r.submitted_by === me?.name),
        tickets: (allTickets || []).filter(r => r.requester === me?.name),
      });
      setLoading(false);
      return;
    }

    const [data, monthlyData, profitData] = await Promise.all([
      get('/api/reports/dashboard' + qs({ period })).catch(() => null),
      get('/api/reports/monthly-revenue' + qs({ period })).catch(() => null),
      // Deliberately unfiltered by period, matching legacy's dashAdmin/dashFinance exactly.
      get('/api/reports/project-profitability').catch(() => null),
    ]);

    setSummary(data);
    setMonthly(monthlyData || []);
    setProfit(profitData || []);
    // Combines this module's pending-approvals count with the user's own personal
    // decision notifications — see refreshNotifBadge() — rather than setting the badge
    // from pending_approvals alone, which would drop the personal-notification count
    // every time the Dashboard loads.
    refreshNotifBadge();
    setLoading(false);
  }, [roleKey, period]);

  useEffect(() => { refresh(); }, [refresh]);

  return { roleKey, loading, summary, monthly, profit, employee };
}
