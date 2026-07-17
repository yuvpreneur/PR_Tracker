import { useCallback, useEffect, useState } from 'react';
import { get, qs } from '../../bridge/core/http.js';
import { state } from '../../bridge/core/state.js';
import { updateNotifBadge } from '../../bridge/shared/notifications.js';

// Ports the real per-role data fetching already live in bridge/pages/dashboard.js's
// loadDashboard()/dashAdmin()/dashManager()/dashFinance()/dashEmployee() (their
// '#dash-content' target is created dynamically at boot by bridge/index.js — not
// missing, just not in the static appHtml) into real React state, same endpoints
// and fetch shape as the vanilla version.
const ROLE_KEY = { Admin: 'admin', Manager: 'manager', 'Finance User': 'finance', Employee: 'employee' };

export default function useDashboardData(period) {
  const roleKey = ROLE_KEY[state.currentUser?.role] || 'admin';
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [profit, setProfit] = useState([]);
  const [utilization, setUtilization] = useState([]);
  const [employee, setEmployee] = useState({ timesheets: [], attendance: [], expenses: [], tickets: [] });

  const refresh = useCallback(async () => {
    setLoading(true);

    if (roleKey === 'employee') {
      const me = state.currentUser;
      const employees = await get('/api/employees').catch(() => []);
      const empIds = (employees || []).filter(e => e.name === me?.name).map(e => e.emp_id);
      const [ts, att, allExpenses, allTickets] = await Promise.all([
        Promise.all(empIds.map(id => get('/api/timesheets?emp_id=' + id).catch(() => []))).then(rs => rs.flat()),
        Promise.all(empIds.map(id => get('/api/attendance?emp_id=' + id).catch(() => []))).then(rs => rs.flat()),
        get('/api/expenses').catch(() => []),
        get('/api/tickets').catch(() => []),
      ]);
      setEmployee({
        timesheets: ts,
        attendance: att,
        expenses: (allExpenses || []).filter(r => r.submitted_by === me?.name),
        tickets: (allTickets || []).filter(r => r.requester === me?.name),
      });
      setLoading(false);
      return;
    }

    const base = [
      get('/api/reports/dashboard' + qs({ period })).catch(() => null),
      get('/api/reports/monthly-revenue' + qs({ period })).catch(() => null),
      // Deliberately unfiltered by period, matching legacy's dashAdmin/dashManager/dashFinance exactly.
      get('/api/reports/project-profitability').catch(() => null),
    ];
    const fetches = roleKey === 'manager' ? [...base, get('/api/reports/employee-utilization').catch(() => null)] : base;
    const [data, monthlyData, profitData, utilData] = await Promise.all(fetches);

    setSummary(data);
    setMonthly(monthlyData || []);
    setProfit(profitData || []);
    if (roleKey === 'manager') setUtilization(utilData || []);
    if (data) updateNotifBadge(data.pending_approvals || 0);
    setLoading(false);
  }, [roleKey, period]);

  useEffect(() => { refresh(); }, [refresh]);

  return { roleKey, loading, summary, monthly, profit, utilization, employee };
}
