import { useEffect, useState } from 'react';
import { LayoutDashboard, IndianRupee, Receipt, TrendingUp, ClipboardCheck, FileText, AlertCircle, Clock, Ticket, FolderKanban, PieChart, Building2, Users, Percent } from 'lucide-react';
import useDashboardData from './useDashboardData.js';
import StatCard from '../../components/ui/StatCard.jsx';
import SectionTitle from '../../components/ui/SectionTitle.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { date, num } from '../../utils/format.js';
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
      <SectionTitle icon={TrendingUp}>Monthly Revenue vs Cost</SectionTitle>
      <div className="bar-chart" id="bar-chart-1" />
    </div>
  );
}

function ProjectListCard({ title, profit, roleKey }) {
  return (
    <div className="card">
      <SectionTitle icon={FolderKanban}>{title}</SectionTitle>
      <div dangerouslySetInnerHTML={{ __html: projRows(profit, roleKey) }} />
    </div>
  );
}

function AdminDashboard({ revenue, expenses, netProfit, pendingApprovals, billableHours, companies, activeProjects, headcount, monthly, profit }) {
  const rev = revenue?.total_revenue || 0;
  const exp = expenses?.total_expenses || 0;
  const net = netProfit?.net_profit ?? (rev - exp);
  const margin = (netProfit?.margin_pct ?? 0).toFixed(1);
  const bHrs = billableHours?.billable_hours || 0;
  const nbHrs = billableHours?.non_billable_hours || 0;
  const bPct = billableHours?.billable_pct || 0;

  return (
    <>
      <div className="stats-row">
        <StatCard label="Total Revenue" value={'₹' + num(rev)} sub={`${revenue?.active_projects || 0} active projects`} color="#16A36C" icon={IndianRupee} />
        <StatCard label="Total Expenses" value={'₹' + num(exp)} sub={`${expenses?.active_projects || 0} projects active`} color="#F59E0B" icon={Receipt} />
        <StatCard label="Net Profit" value={'₹' + num(Math.abs(net))} sub={`Margin ${margin}%${netProfit?.is_loss ? ' (loss)' : ''}`} color="#0086AD" icon={TrendingUp} />
        <StatCard label="Pending Approvals" value={String(pendingApprovals?.pending_approvals || 0)} sub={`${pendingApprovals?.pending_timesheets || 0} timesheets pending`} color="#E14D56" icon={ClipboardCheck} />
      </div>
      <div className="stats-row">
        <StatCard label="Companies" value={String(companies?.total_companies || 0)} sub={`${companies?.active_companies || 0} active`} color="#7357E5" icon={Building2} />
        <StatCard label="Active Projects" value={String(activeProjects?.active_projects || 0)} sub={`${activeProjects?.total_projects || 0} total projects`} color="#0086AD" icon={FolderKanban} />
        <StatCard label="Headcount" value={String(headcount?.headcount || 0)} sub={`${headcount?.billable_count || 0} billable`} color="#16A36C" icon={Users} />
        <StatCard label="Billable Utilisation" value={`${bPct}%`} sub={`${bHrs.toLocaleString('en-IN')} billable hrs`} color="#F59E0B" icon={Percent} />
      </div>
      <div className="grid-2 mb-4">
        <RevenueCostChart monthly={monthly} />
        <div className="card">
          <SectionTitle icon={Clock}>Billable vs Non-Billable Hours</SectionTitle>
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

function FinanceDashboard({ billed, received, outstanding, expenses, monthly, profit }) {
  const billedAmt = billed?.total_billed || 0;
  const receivedAmt = received?.total_received || 0;
  const outstandingAmt = outstanding?.outstanding || 0;
  const expensesAmt = expenses?.total_expenses || 0;
  const collectionPct = billedAmt > 0 ? Math.round((receivedAmt / billedAmt) * 100) : 0;

  const box = (label, value, color) => (
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: '#7C92A1', marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 700, color }}>₹{num(value)}</div>
    </div>
  );

  return (
    <>
      <div className="stats-row">
        <StatCard label="Total Billed" value={'₹' + num(billedAmt)} sub="Invoice amounts raised" color="#0086AD" icon={FileText} />
        <StatCard label="Total Received" value={'₹' + num(receivedAmt)} sub="Cash collected" color="#16A36C" icon={IndianRupee} />
        <StatCard label="Outstanding" value={'₹' + num(outstandingAmt)} sub="Unpaid balance" color="#E14D56" icon={AlertCircle} />
        <StatCard label="Total Expenses" value={'₹' + num(expensesAmt)} sub="Approved expenses" color="#F59E0B" icon={Receipt} />
      </div>
      <div className="grid-2 mb-4">
        <RevenueCostChart monthly={monthly} />
        <div className="card">
          <SectionTitle icon={PieChart}>Revenue Collection Summary</SectionTitle>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: '#7C92A1' }}>Collection Rate</span>
              <span style={{ fontWeight: 600, color: '#334155' }}>{collectionPct}%</span>
            </div>
            <div className="progress"><div className="progress-bar" style={{ width: `${collectionPct}%`, background: '#16A36C' }} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {box('Billed', billedAmt, '#0086AD')}
            {box('Received', receivedAmt, '#16A36C')}
            {box('Outstanding', outstandingAmt, '#E14D56')}
            {box('Expenses', expensesAmt, '#F59E0B')}
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

function EmployeeDashboard({ myHours, myExpenses, pendingTimesheets, myTickets, recentTimesheets, recentExpenses }) {
  const myHrs = myHours?.hours || 0;
  const billableHrs = myHours?.billable_hours || 0;
  const myExpAmt = myExpenses?.amount || 0;
  const expCount = myExpenses?.count || 0;
  const pendingTs = pendingTimesheets?.count || 0;
  const openTix = myTickets?.open || 0;
  const totalTix = myTickets?.total || 0;

  return (
    <>
      <div className="stats-row">
        <StatCard label="My Hours (All Time)" value={myHrs + 'h'} sub={`${billableHrs}h billable`} color="#16A36C" icon={Clock} />
        <StatCard label="My Expenses" value={'₹' + num(myExpAmt)} sub={`${expCount} submissions`} color="#F59E0B" icon={Receipt} />
        <StatCard label="Pending Approvals" value={String(pendingTs)} sub="timesheets awaiting review" color="#7357E5" icon={ClipboardCheck} />
        <StatCard label="Open Tickets" value={String(openTix)} sub={`${totalTix} raised total`} color="#0086AD" icon={Ticket} />
      </div>
      <div className="grid-2 mb-4">
        <div className="card">
          <SectionTitle icon={Clock}>My Recent Timesheets</SectionTitle>
          {previewTable(recentTimesheets, [
            { key: 'date', header: 'Date', render: r => date(r.entry_date) },
            { key: 'project_id', header: 'Project' },
            { key: 'hours', header: 'Hours', align: 'right', bold: true, render: r => `${r.hours}h` },
            { key: 'status', header: 'Status', align: 'center', render: r => <Badge status={r.status} /> },
          ], 'No timesheets found')}
        </div>
        <div className="card">
          <SectionTitle icon={Receipt}>My Expenses</SectionTitle>
          {previewTable(recentExpenses, [
            { key: 'date', header: 'Date', render: r => date(r.expense_date) },
            { key: 'category', header: 'Category' },
            { key: 'amount', header: 'Amount', align: 'right', bold: true, render: r => `₹${num(r.amount)}` },
            { key: 'status', header: 'Status', align: 'center', render: r => <Badge status={r.status} /> },
          ], 'No expenses found')}
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  const [period, setPeriod] = useState('last_month');
  const data = useDashboardData(period);
  const { roleKey, loading, monthly, profit } = data;

  return (
    <div>
      <div className="section-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><LayoutDashboard size={22} /> Dashboard</h2>
        <select id="dash-period" className="form-control" style={{ width: 'auto' }} value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="q1_2026">Q1 2026</option>
          <option value="fy_2025_26">FY 2025-26</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>Loading…</div>
      ) : roleKey === 'finance' ? (
        <FinanceDashboard billed={data.billed} received={data.received} outstanding={data.outstanding} expenses={data.expenses} monthly={monthly} profit={profit} />
      ) : roleKey === 'employee' ? (
        <EmployeeDashboard
          myHours={data.myHours} myExpenses={data.myExpenses} pendingTimesheets={data.pendingTimesheets}
          myTickets={data.myTickets} recentTimesheets={data.recentTimesheets} recentExpenses={data.recentExpenses}
        />
      ) : (
        <AdminDashboard
          revenue={data.revenue} expenses={data.expenses} netProfit={data.netProfit} pendingApprovals={data.pendingApprovals}
          billableHours={data.billableHours} companies={data.companies} activeProjects={data.activeProjects} headcount={data.headcount}
          monthly={monthly} profit={profit}
        />
      )}
    </div>
  );
}
