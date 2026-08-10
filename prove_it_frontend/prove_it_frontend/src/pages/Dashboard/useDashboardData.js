import { useCallback, useEffect, useState } from 'react';
import { get, qs } from '../../services/httpClient.js';
import { refreshNotifBadge } from '../../bridge/shared/notifications.js';
import useAuth from '../../hooks/useAuth.jsx';

// Every card/chart on the Dashboard is fetched from its own dedicated endpoint
// (app/routers/dashboard.py) rather than one bundled summary response, so any single
// card can load/fail/cache independently of the others. All calls for a given role
// still fire together via Promise.all — this is about decoupling the data sources,
// not about serializing the requests.
const ROLE_KEY = { Admin: 'admin', Manager: 'admin', 'Finance User': 'finance', Employee: 'employee' };

export default function useDashboardData(period) {
  const { user } = useAuth();
  const roleKey = ROLE_KEY[user?.role] || 'admin';
  const [loading, setLoading] = useState(true);

  const [revenue, setRevenue] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [netProfit, setNetProfit] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState(null);
  const [billableHours, setBillableHours] = useState(null);
  const [companies, setCompanies] = useState(null);
  const [activeProjects, setActiveProjects] = useState(null);
  const [headcount, setHeadcount] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [profit, setProfit] = useState([]);

  const [billed, setBilled] = useState(null);
  const [received, setReceived] = useState(null);
  const [outstanding, setOutstanding] = useState(null);

  const [myHours, setMyHours] = useState(null);
  const [myExpenses, setMyExpenses] = useState(null);
  const [pendingTimesheets, setPendingTimesheets] = useState(null);
  const [myTickets, setMyTickets] = useState(null);
  const [recentTimesheets, setRecentTimesheets] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const p = qs({ period });

    if (roleKey === 'employee') {
      const [hours, exp, pendingTs, tickets, tsRows, expRows] = await Promise.all([
        get('/api/dashboard/employee/my-hours').catch(() => null),
        get('/api/dashboard/employee/my-expenses').catch(() => null),
        get('/api/dashboard/employee/pending-timesheets').catch(() => null),
        get('/api/dashboard/employee/my-tickets').catch(() => null),
        get('/api/dashboard/employee/my-recent-timesheets').catch(() => []),
        get('/api/dashboard/employee/my-recent-expenses').catch(() => []),
      ]);
      setMyHours(hours);
      setMyExpenses(exp);
      setPendingTimesheets(pendingTs);
      setMyTickets(tickets);
      setRecentTimesheets(tsRows || []);
      setRecentExpenses(expRows || []);
      refreshNotifBadge();
      setLoading(false);
      return;
    }

    if (roleKey === 'finance') {
      const [b, r, o, e, monthlyData, profitData] = await Promise.all([
        get('/api/dashboard/finance/total-billed' + p).catch(() => null),
        get('/api/dashboard/finance/total-received' + p).catch(() => null),
        get('/api/dashboard/finance/outstanding').catch(() => null),
        get('/api/dashboard/finance/total-expenses' + p).catch(() => null),
        get('/api/reports/monthly-revenue' + p).catch(() => null),
        get('/api/reports/project-profitability').catch(() => null),
      ]);
      setBilled(b); setReceived(r); setOutstanding(o); setExpenses(e);
      setMonthly(monthlyData || []); setProfit(profitData || []);
      refreshNotifBadge();
      setLoading(false);
      return;
    }

    // Admin / Manager
    const [rev, exp, net, pending, bh, cos, actProj, hc, monthlyData, profitData] = await Promise.all([
      get('/api/dashboard/admin/total-revenue' + p).catch(() => null),
      get('/api/dashboard/admin/total-expenses' + p).catch(() => null),
      get('/api/dashboard/admin/net-profit' + p).catch(() => null),
      get('/api/dashboard/admin/pending-approvals').catch(() => null),
      get('/api/dashboard/admin/billable-hours' + p).catch(() => null),
      get('/api/dashboard/admin/companies-count').catch(() => null),
      get('/api/dashboard/admin/active-projects').catch(() => null),
      get('/api/dashboard/admin/headcount').catch(() => null),
      get('/api/reports/monthly-revenue' + p).catch(() => null),
      get('/api/reports/project-profitability').catch(() => null),
    ]);
    setRevenue(rev); setExpenses(exp); setNetProfit(net);
    setPendingApprovals(pending); setBillableHours(bh);
    setCompanies(cos); setActiveProjects(actProj); setHeadcount(hc);
    setMonthly(monthlyData || []); setProfit(profitData || []);
    // Combines this module's pending-approvals count with the user's own personal
    // decision notifications — see refreshNotifBadge() — rather than setting the badge
    // from pending_approvals alone, which would drop the personal-notification count
    // every time the Dashboard loads.
    refreshNotifBadge();
    setLoading(false);
  }, [roleKey, period]);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    roleKey, loading, monthly, profit,
    revenue, expenses, netProfit, pendingApprovals, billableHours,
    companies, activeProjects, headcount,
    billed, received, outstanding,
    myHours, myExpenses, pendingTimesheets, myTickets, recentTimesheets, recentExpenses,
  };
}
