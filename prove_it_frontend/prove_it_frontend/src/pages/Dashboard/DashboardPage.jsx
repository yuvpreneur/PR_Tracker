import { useEffect, useState } from 'react';
import { LayoutDashboard, IndianRupee, Receipt, TrendingUp, ClipboardCheck, FileText, AlertCircle, Clock, Ticket, FolderKanban, PieChart, Building2, Users, Percent, BarChart3 } from 'lucide-react';
import useDashboardData from './useDashboardData.js';
import StatCard from '../../components/ui/StatCard.jsx';
import SectionTitle from '../../components/ui/SectionTitle.jsx';
import Badge from '../../components/ui/Badge.jsx';
import ProgressBar from '../../components/ui/ProgressBar.jsx';
import KebabMenu from '../../components/ui/KebabMenu.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import RevenueCostChart from '../../components/widgets/RevenueCostChart.jsx';
import DualStatSplit from '../../components/widgets/DualStatSplit.jsx';
import { date, num, formatCurrency } from '../../utils/format.js';
import Dropdown from '../../components/ui/Dropdown.jsx';
import { MicroIcons } from '../../components/ui/MicroIcons.jsx';


function AdminDashboard({ revenue, expenses, netProfit, pendingApprovals, billableHours, companies, activeProjects, headcount, monthly, profit }) {
  const rev = revenue?.total_revenue || 0;
  const exp = expenses?.total_expenses || 0;
  const net = netProfit?.net_profit ?? (rev - exp);
  const margin = (netProfit?.margin_pct ?? 0).toFixed(1);
  const bHrs = billableHours?.billable_hours || 0;
  const nbHrs = billableHours?.non_billable_hours || 0;
  const bPct = billableHours?.billable_pct || 0;

  // Add mock trend data - replace with real backend data when available
  const enrichedData = {
    revenue: { ...revenue, trend_pct: 12.5 },
    expenses: { ...expenses, trend_pct: 0 },
    netProfit: { ...netProfit, trend_pct: 12.5 },
    pendingApprovals: { ...pendingApprovals, trend_pct: 0 },
    companies: { ...companies, trend_pct: 8 },
    activeProjects: { ...activeProjects, trend_pct: 20 },
    headcount: { ...headcount, trend_pct: 10 },
    billableHours: { ...billableHours, trend_pct: 0 },
  };

  const projColumns = [
    {
      key: 'project_name',
      header: 'Project',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.project_name || r.project_id}</div>
          <ProgressBar value={r.status === 'Completed' ? 100 : r.status === 'Not Started' ? 0 : (r.revenue_received > 0 ? Math.min(94, Math.round(r.revenue_received / Math.max(r.total_cost || 1, 1) * 100)) : 8)} color="rose" />
          <div style={{ color: 'var(--muted)', fontSize: '11px', marginTop: 3 }}>{r.status === 'Completed' ? 100 : r.status === 'Not Started' ? 0 : (r.revenue_received > 0 ? Math.min(94, Math.round(r.revenue_received / Math.max(r.total_cost || 1, 1) * 100)) : 8)}% · {r.client || '—'}</div>
        </div>
      ),
    },
    {
      key: 'revenue_received',
      header: 'Revenue',
      align: 'center',
      render: (r) => <span style={{ color: 'var(--color-green)', fontWeight: 600 }}>{formatCurrency(r.revenue_received)}</span>,
    },
    {
      key: 'total_cost',
      header: 'Cost',
      align: 'center',
      render: (r) => <span style={{ color: 'var(--color-amber)', fontWeight: 600 }}>{formatCurrency(r.total_cost)}</span>,
    },
    {
      key: 'gross_profit',
      header: 'Profit',
      align: 'center',
      render: (r) => <span style={{ color: r.gross_profit >= 0 ? 'var(--color-brand)' : 'var(--color-red)', fontWeight: 600 }}>{formatCurrency(Math.abs(r.gross_profit))}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (r) => <Badge status={r.status} />,
    },
  ];

  return (
    <>
      <div className="stats-row">
        <StatCard label="Total Revenue" value={formatCurrency(rev)} sub={`${revenue?.active_projects || 0} active projects`} color="#16A36C" icon={IndianRupee} microIcon={MicroIcons.GrowthChart} trend={enrichedData.revenue?.trend_pct ? { value: Math.abs(enrichedData.revenue.trend_pct) + '%', direction: enrichedData.revenue.trend_pct > 0 ? 'up' : enrichedData.revenue.trend_pct < 0 ? 'down' : 'flat' } : null} />
        <StatCard label="Total Expenses" value={formatCurrency(exp)} sub={`${expenses?.active_projects || 0} projects active`} color="#F59E0B" icon={Receipt} microIcon={MicroIcons.ConnectedDots} trend={enrichedData.expenses?.trend_pct ? { value: Math.abs(enrichedData.expenses.trend_pct) + '%', direction: enrichedData.expenses.trend_pct > 0 ? 'up' : enrichedData.expenses.trend_pct < 0 ? 'down' : 'flat' } : null} />
        <StatCard label="Net Profit" value={formatCurrency(Math.abs(net))} sub={`Margin ${margin}%${netProfit?.is_loss ? ' (loss)' : ''}`} color="#0086AD" icon={TrendingUp} microIcon={MicroIcons.Target} trend={enrichedData.netProfit?.trend_pct ? { value: Math.abs(enrichedData.netProfit.trend_pct) + '%', direction: enrichedData.netProfit.trend_pct > 0 ? 'up' : enrichedData.netProfit.trend_pct < 0 ? 'down' : 'flat' } : null} />
        <StatCard label="Pending Approvals" value={String(pendingApprovals?.pending_approvals || 0)} sub={`${pendingApprovals?.pending_timesheets || 0} timesheets pending`} color="#E8607A" icon={ClipboardCheck} microIcon={MicroIcons.DocumentTick} trend={enrichedData.pendingApprovals?.trend_pct ? { value: Math.abs(enrichedData.pendingApprovals.trend_pct) + '%', direction: enrichedData.pendingApprovals.trend_pct > 0 ? 'up' : enrichedData.pendingApprovals.trend_pct < 0 ? 'down' : 'flat' } : null} />
      </div>
      <div className="stats-row">
        <StatCard label="Companies" value={String(companies?.total_companies || 0)} sub={`${companies?.active_companies || 0} active`} color="#7357E5" icon={Building2} microIcon={MicroIcons.OrganizationTree} trend={enrichedData.companies?.trend_pct ? { value: Math.abs(enrichedData.companies.trend_pct) + '%', direction: enrichedData.companies.trend_pct > 0 ? 'up' : enrichedData.companies.trend_pct < 0 ? 'down' : 'flat' } : null} />
        <StatCard label="Active Projects" value={String(activeProjects?.active_projects || 0)} sub={`${activeProjects?.total_projects || 0} total projects`} color="#0086AD" icon={FolderKanban} microIcon={MicroIcons.BriefcaseSpark} trend={enrichedData.activeProjects?.trend_pct ? { value: Math.abs(enrichedData.activeProjects.trend_pct) + '%', direction: enrichedData.activeProjects.trend_pct > 0 ? 'up' : enrichedData.activeProjects.trend_pct < 0 ? 'down' : 'flat' } : null} />
        <StatCard label="Headcount" value={String(headcount?.headcount || 0)} sub={`${headcount?.billable_count || 0} billable`} color="#16A36C" icon={Users} microIcon={MicroIcons.TeamNetwork} trend={enrichedData.headcount?.trend_pct ? { value: Math.abs(enrichedData.headcount.trend_pct) + '%', direction: enrichedData.headcount.trend_pct > 0 ? 'up' : enrichedData.headcount.trend_pct < 0 ? 'down' : 'flat' } : null} />
        <StatCard label="Billable Utilisation" value={`${bPct}%`} sub={`${bHrs.toLocaleString('en-IN')} billable hrs`} color="#F59E0B" icon={Percent} microIcon={MicroIcons.ClockCheck} trend={enrichedData.billableHours?.trend_pct ? { value: Math.abs(enrichedData.billableHours.trend_pct) + '%', direction: enrichedData.billableHours.trend_pct > 0 ? 'up' : enrichedData.billableHours.trend_pct < 0 ? 'down' : 'flat' } : null} />
      </div>
      <div className="grid-2 mb-4">
        <div className="card">
          <SectionTitle icon={BarChart3} right={<KebabMenu />} iconColor="var(--rose)" subdued={false}>Monthly Revenue vs Cost</SectionTitle>
          <RevenueCostChart data={monthly} />
        </div>
        <div className="card">
          <SectionTitle icon={Clock} right={<KebabMenu />} iconColor="var(--rose)" subdued={false}>Billable vs Non-Billable Hours</SectionTitle>
          <DualStatSplit stats={[
            { label: 'Billable hrs', value: bHrs, color: 'var(--color-green)' },
            { label: 'Non-billable hrs', value: nbHrs, color: 'var(--color-amber)' },
          ]} percentage={bPct} />
        </div>
      </div>
      <div className="card">
        <SectionTitle icon={FolderKanban} right={<KebabMenu />} iconColor="var(--rose)" subdued={false}>Project Overview — All Projects</SectionTitle>
        <DataTable
          columns={projColumns}
          rows={(profit || []).slice(0, 6)}
          getRowId={(r) => r.project_id}
          pageId="dashboard"
          hideActionsColumn={true}
          renderExtraActions={(r) => <KebabMenu />}
        />
      </div>
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
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 700, color }}>{formatCurrency(value)}</div>
    </div>
  );

  const projColumns = [
    { key: 'project_name', header: 'Project', render: (r) => r.project_name || r.project_id },
    { key: 'revenue_received', header: 'Revenue', render: (r) => <span style={{ color: 'var(--color-green)', fontWeight: 600 }}>{formatCurrency(r.revenue_received)}</span> },
    { key: 'total_cost', header: 'Cost', render: (r) => <span style={{ color: 'var(--color-amber)', fontWeight: 600 }}>{formatCurrency(r.total_cost)}</span> },
    { key: 'gross_profit', header: 'Profit', render: (r) => <span style={{ color: r.gross_profit >= 0 ? 'var(--color-brand)' : 'var(--color-red)', fontWeight: 600 }}>{formatCurrency(Math.abs(r.gross_profit))}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
  ];

  return (
    <>
      <div className="stats-row">
        <StatCard label="Total Billed" value={formatCurrency(billedAmt)} sub="Invoice amounts raised" color="#0086AD" icon={FileText} microIcon={MicroIcons.DocumentTick} />
        <StatCard label="Total Received" value={formatCurrency(receivedAmt)} sub="Cash collected" color="#16A36C" icon={IndianRupee} microIcon={MicroIcons.GrowthChart} />
        <StatCard label="Outstanding" value={formatCurrency(outstandingAmt)} sub="Unpaid balance" color="#E14D56" icon={AlertCircle} microIcon={MicroIcons.Target} />
        <StatCard label="Total Expenses" value={formatCurrency(expensesAmt)} sub="Approved expenses" color="#F59E0B" icon={Receipt} microIcon={MicroIcons.ConnectedDots} />
      </div>
      <div className="grid-2 mb-4">
        <div className="card">
          <SectionTitle icon={TrendingUp}>Monthly Revenue vs Cost</SectionTitle>
          <RevenueCostChart data={monthly} />
        </div>
        <div className="card">
          <SectionTitle icon={PieChart}>Revenue Collection Summary</SectionTitle>
          <ProgressBar value={collectionPct} color="green" label="Collection Rate" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
            {box('Billed', billedAmt, '#0086AD')}
            {box('Received', receivedAmt, '#16A36C')}
            {box('Outstanding', outstandingAmt, '#E14D56')}
            {box('Expenses', expensesAmt, '#F59E0B')}
          </div>
        </div>
      </div>
      <div className="card">
        <SectionTitle icon={FolderKanban}>Project Profitability</SectionTitle>
        <DataTable
          columns={projColumns}
          rows={(profit || []).slice(0, 6)}
          getRowId={(r) => r.project_id}
          pageId="dashboard"
          hideActionsColumn={true}
        />
      </div>
    </>
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

  const timesheetColumns = [
    { key: 'entry_date', header: 'Date', render: r => date(r.entry_date) },
    { key: 'project_id', header: 'Project' },
    { key: 'hours', header: 'Hours', render: r => <span style={{ fontWeight: 600 }}>{r.hours}h</span> },
    { key: 'status', header: 'Status', render: r => <Badge status={r.status} /> },
  ];

  const expenseColumns = [
    { key: 'expense_date', header: 'Date', render: r => date(r.expense_date) },
    { key: 'category', header: 'Category' },
    { key: 'amount', header: 'Amount', render: r => <span style={{ fontWeight: 600 }}>{formatCurrency(r.amount)}</span> },
    { key: 'status', header: 'Status', render: r => <Badge status={r.status} /> },
  ];

  return (
    <>
      <div className="stats-row">
        <StatCard label="My Hours (All Time)" value={myHrs + 'h'} sub={`${billableHrs}h billable`} color="#16A36C" icon={Clock} microIcon={MicroIcons.ClockCheck} />
        <StatCard label="My Expenses" value={formatCurrency(myExpAmt)} sub={`${expCount} submissions`} color="#F59E0B" icon={Receipt} microIcon={MicroIcons.ConnectedDots} />
        <StatCard label="Pending Approvals" value={String(pendingTs)} sub="timesheets awaiting review" color="#7357E5" icon={ClipboardCheck} microIcon={MicroIcons.DocumentTick} />
        <StatCard label="Open Tickets" value={String(openTix)} sub={`${totalTix} raised total`} color="#0086AD" icon={Ticket} microIcon={MicroIcons.EmployeeCard} />
      </div>
      <div className="grid-2 mb-4">
        <div className="card">
          <SectionTitle icon={Clock}>My Recent Timesheets</SectionTitle>
          <DataTable
            columns={timesheetColumns}
            rows={recentTimesheets.slice(0, 6)}
            getRowId={(r, i) => i}
            pageId="dashboard"
            hideActionsColumn={true}
            emptyMessage="No timesheets found"
          />
        </div>
        <div className="card">
          <SectionTitle icon={Receipt}>My Expenses</SectionTitle>
          <DataTable
            columns={expenseColumns}
            rows={recentExpenses.slice(0, 6)}
            getRowId={(r, i) => i}
            pageId="dashboard"
            hideActionsColumn={true}
            emptyMessage="No expenses found"
          />
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
      <div className="page-header">
        <h2>
          <LayoutDashboard size={22} /> Dashboard
        </h2>
        <Dropdown
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'last_month', label: 'Last Month' },
            { value: 'this_month', label: 'This Month' },
            { value: 'q1_2026', label: 'Q1 2026' },
            { value: 'fy_2025_26', label: 'FY 2025-26' },
          ]}
          placeholder="Select period"
          style={{ width: '200px' }}
        />
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
