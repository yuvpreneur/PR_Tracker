import { useEffect, useState } from 'react';
import useDashboardData from './useDashboardData.js';
import StatCard from '../../components/ui/StatCard.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { date, num } from '../../bridge/shared/ui.js';
import { lineChart, projRows } from '../../bridge/pages/dashboard.js';

// Renders the shared SVG revenue-vs-cost bar chart by calling the existing,
// framework-agnostic lineChart() (bridge/pages/dashboard.js) imperatively into
// an empty div — this JSX never gives that div children, so React never
// reconciles into content lineChart() wrote, same interop pattern used for the
// still-legacy pages' inline onclick handlers elsewhere in this migration.
function RevenueCostChart({ monthly }) {
  useEffect(() => { lineChart(monthly, 'bar-chart-1'); }, [monthly]);
  return (
    <div className="card">
      <div className="card-section-title">Monthly Revenue vs Cost</div>
      <div className="bar-chart" id="bar-chart-1" />
    </div>
  );
}

function ProjectListCard({ title, profit, roleKey }) {
  return (
    <div className="card">
      <div className="card-section-title">{title}</div>
      <div dangerouslySetInnerHTML={{ __html: projRows(profit, roleKey) }} />
    </div>
  );
}

function AdminDashboard({ summary, monthly, profit }) {
  const f = summary?.financials || {};
  const ts = summary?.timesheets || {};
  const pr = summary?.projects || {};
  const rev = f.total_revenue_received || 0;
  const exp = f.total_approved_expenses || 0;
  const net = f.net_profit ?? (rev - exp);
  const margin = rev > 0 ? ((net / rev) * 100).toFixed(1) : '0.0';
  const bHrs = ts.billable_hours || 0;
  const tHrs = ts.approved_hours || 0;
  const nbHrs = Math.max(0, tHrs - bHrs);
  const bPct = tHrs > 0 ? Math.round((bHrs / tHrs) * 100) : 0;

  return (
    <>
      <div className="stats-row">
        <StatCard label="Total Revenue" value={'₹' + num(rev)} sub={`${pr.in_progress || 0} active projects`} color="#16A36C" />
        <StatCard label="Total Expenses" value={'₹' + num(exp)} sub={`${pr.in_progress || 0} projects active`} color="#F59E0B" />
        <StatCard label="Net Profit" value={'₹' + num(Math.abs(net))} sub={`Margin ${margin}%${net < 0 ? ' (loss)' : ''}`} color="#0086AD" />
        <StatCard label="Pending Approvals" value={String(summary?.pending_approvals || 0)} sub={`${ts.pending || 0} timesheets pending`} color="#E14D56" />
      </div>
      <div className="grid-2 mb-4">
        <RevenueCostChart monthly={monthly} />
        <div className="card">
          <div className="card-section-title">Billable vs Non-Billable Hours</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: '#16A36C', fontSize: 28, fontWeight: 700 }}>{bHrs.toLocaleString('en-IN')}</div>
              <div style={{ color: '#7C92A1', fontSize: 11 }}>Billable hrs</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: '#F59E0B', fontSize: 28, fontWeight: 700 }}>{nbHrs.toLocaleString('en-IN')}</div>
              <div style={{ color: '#7C92A1', fontSize: 11 }}>Non-billable hrs</div>
            </div>
          </div>
          <div className="progress"><div className="progress-bar" style={{ width: `${bPct}%`, background: '#16A36C' }} /></div>
          <div style={{ color: '#7C92A1', fontSize: 11, marginTop: 6 }}>{bPct}% billable utilisation</div>
        </div>
      </div>
      <ProjectListCard title="Project Overview — All Projects" profit={profit} roleKey="admin" />
    </>
  );
}

function ManagerDashboard({ summary, monthly, profit, utilization }) {
  const ts = summary?.timesheets || {};
  const pr = summary?.projects || {};
  const bHrs = ts.billable_hours || 0;
  const tHrs = ts.approved_hours || 0;
  const bPct = tHrs > 0 ? Math.round((bHrs / tHrs) * 100) : 0;
  const topUtil = (utilization || []).slice(0, 5);

  return (
    <>
      <div className="stats-row">
        <StatCard label="Active Projects" value={String(pr.in_progress || 0)} sub={`${pr.total || 0} total projects`} color="#0086AD" />
        <StatCard label="Approved Hours" value={tHrs.toLocaleString('en-IN') + 'h'} sub="Across all team members" color="#16A36C" />
        <StatCard label="Team Utilisation" value={bPct + '%'} sub={`${bHrs}h billable of ${tHrs}h total`} color="#7357E5" />
        <StatCard label="Pending Approvals" value={String(summary?.pending_approvals || 0)} sub={`${ts.pending || 0} timesheets awaiting`} color="#E14D56" />
      </div>
      <div className="grid-2 mb-4">
        <RevenueCostChart monthly={monthly} />
        <div className="card">
          <div className="card-section-title">Team Utilisation by Member</div>
          {topUtil.length ? topUtil.map(e => (
            <div key={e.emp_id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 90, fontSize: 12, fontWeight: 500, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
              <div style={{ flex: 1 }}>
                <div className="progress">
                  <div className="progress-bar" style={{ width: `${e.utilization_pct}%`, background: e.utilization_pct >= 80 ? '#16A36C' : e.utilization_pct >= 50 ? '#0086AD' : '#F59E0B' }} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#7C92A1', width: 36, textAlign: 'right' }}>{e.utilization_pct}%</div>
            </div>
          )) : <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 16 }}>No utilisation data</div>}
        </div>
      </div>
      <ProjectListCard title="My Projects" profit={profit} roleKey="manager" />
    </>
  );
}

function FinanceDashboard({ summary, monthly, profit }) {
  const f = summary?.financials || {};
  const billed = f.total_revenue_billed || 0;
  const received = f.total_revenue_received || 0;
  const outstanding = f.outstanding || 0;
  const expenses = f.total_approved_expenses || 0;
  const collectionPct = billed > 0 ? Math.round((received / billed) * 100) : 0;

  const box = (label, value, color) => (
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: '#7C92A1', marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 700, color }}>₹{num(value)}</div>
    </div>
  );

  return (
    <>
      <div className="stats-row">
        <StatCard label="Total Billed" value={'₹' + num(billed)} sub="Invoice amounts raised" color="#0086AD" />
        <StatCard label="Total Received" value={'₹' + num(received)} sub="Cash collected" color="#16A36C" />
        <StatCard label="Outstanding" value={'₹' + num(outstanding)} sub="Unpaid balance" color="#E14D56" />
        <StatCard label="Total Expenses" value={'₹' + num(expenses)} sub="Approved expenses" color="#F59E0B" />
      </div>
      <div className="grid-2 mb-4">
        <RevenueCostChart monthly={monthly} />
        <div className="card">
          <div className="card-section-title">Revenue Collection Summary</div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: '#7C92A1' }}>Collection Rate</span>
              <span style={{ fontWeight: 600, color: '#334155' }}>{collectionPct}%</span>
            </div>
            <div className="progress"><div className="progress-bar" style={{ width: `${collectionPct}%`, background: '#16A36C' }} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {box('Billed', billed, '#0086AD')}
            {box('Received', received, '#16A36C')}
            {box('Outstanding', outstanding, '#E14D56')}
            {box('Expenses', expenses, '#F59E0B')}
          </div>
        </div>
      </div>
      <ProjectListCard title="Project Profitability" profit={profit} roleKey="finance" />
    </>
  );
}

function previewTable(rows, columns, emptyMessage) {
  if (!rows.length) return <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>{emptyMessage}</div>;
  return (
    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ color: '#7C92A1', fontSize: 11 }}>
          {columns.map(c => <th key={c.key} style={{ textAlign: c.align || 'left', padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>{c.header}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
            {columns.map(c => (
              <td key={c.key} style={{ padding: '7px 8px', textAlign: c.align || 'left', fontWeight: c.bold ? 600 : 400 }}>
                {c.render ? c.render(r) : (r[c.key] ?? '—')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EmployeeDashboard({ employee }) {
  const { timesheets, attendance, expenses, tickets } = employee;
  const myHrs = timesheets.reduce((s, r) => s + (r.hours || 0), 0);
  const billableHrs = timesheets.filter(r => r.billable).reduce((s, r) => s + (r.hours || 0), 0);
  const myExpAmt = expenses.reduce((s, r) => s + (r.amount || 0), 0);
  const pendingTs = timesheets.filter(r => r.status === 'Pending').length;
  const openTix = tickets.filter(r => ['Open', 'In Progress'].includes(r.status)).length;
  const presentDays = attendance.filter(r => ['Present', 'WFH'].includes(r.att_status)).length;

  return (
    <>
      <div className="stats-row">
        <StatCard label="My Hours (All Time)" value={myHrs + 'h'} sub={`${billableHrs}h billable`} color="#16A36C" />
        <StatCard label="My Expenses" value={'₹' + num(myExpAmt)} sub={`${expenses.length} submissions`} color="#F59E0B" />
        <StatCard label="Pending Approvals" value={String(pendingTs)} sub="timesheets awaiting review" color="#7357E5" />
        <StatCard label="Open Tickets" value={String(openTix)} sub={`${presentDays} days attendance logged`} color="#0086AD" />
      </div>
      <div className="grid-2 mb-4">
        <div className="card">
          <div className="card-section-title">My Recent Timesheets</div>
          {previewTable(timesheets.slice(0, 6), [
            { key: 'date', header: 'Date', render: r => date(r.entry_date) },
            { key: 'project_id', header: 'Project' },
            { key: 'hours', header: 'Hours', align: 'right', bold: true, render: r => `${r.hours}h` },
            { key: 'status', header: 'Status', align: 'center', render: r => <Badge status={r.status} /> },
          ], 'No timesheets found')}
        </div>
        <div className="card">
          <div className="card-section-title">My Expenses</div>
          {previewTable(expenses.slice(0, 6), [
            { key: 'date', header: 'Date', render: r => date(r.expense_date) },
            { key: 'category', header: 'Category' },
            { key: 'amount', header: 'Amount', align: 'right', bold: true, render: r => `₹${num(r.amount)}` },
            { key: 'status', header: 'Status', align: 'center', render: r => <Badge status={r.status} /> },
          ], 'No expenses found')}
        </div>
      </div>
      <div className="card">
        <div className="card-section-title">My Attendance (Recent)</div>
        {previewTable(attendance.slice(0, 7), [
          { key: 'date', header: 'Date', render: r => date(r.att_date) },
          { key: 'att_status', header: 'Status', align: 'center', render: r => <Badge status={r.att_status} /> },
          { key: 'check_in', header: 'Check In', align: 'center', render: r => r.check_in || '—' },
          { key: 'check_out', header: 'Check Out', align: 'center', render: r => r.check_out || '—' },
          { key: 'total_hours', header: 'Hours', align: 'right', bold: true, render: r => `${r.total_hours}h` },
        ], 'No attendance records')}
      </div>
    </>
  );
}

export default function DashboardPage() {
  const [period, setPeriod] = useState('last_month');
  const { roleKey, loading, summary, monthly, profit, utilization, employee } = useDashboardData(period);

  return (
    <div>
      <div className="section-header">
        <h2>Dashboard</h2>
        <select id="dash-period" className="form-control" style={{ width: 'auto' }} value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="q1_2026">Q1 2026</option>
          <option value="fy_2025_26">FY 2025-26</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>Loading…</div>
      ) : roleKey === 'manager' ? (
        <ManagerDashboard summary={summary} monthly={monthly} profit={profit} utilization={utilization} />
      ) : roleKey === 'finance' ? (
        <FinanceDashboard summary={summary} monthly={monthly} profit={profit} />
      ) : roleKey === 'employee' ? (
        <EmployeeDashboard employee={employee} />
      ) : (
        <AdminDashboard summary={summary} monthly={monthly} profit={profit} />
      )}
    </div>
  );
}
