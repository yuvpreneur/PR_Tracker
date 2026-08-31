import { LayoutGrid, Building2, Users, Receipt, DollarSign, PieChart, Server, Database, Globe, ClipboardList, TrendingUp } from 'lucide-react';
import useOverview from './useOverview.js';
import usePlatformAuditLog from '../AuditLog/usePlatformAuditLog.js';
import RevenueGrowthChart from './RevenueGrowthChart.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import SectionTitle from '../../components/ui/SectionTitle.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { date } from '../../utils/format.js';
import { MicroIcons } from '../../components/ui/MicroIcons.jsx';

const money = (value) => `$${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

function HealthRow({ label, value, icon: Icon }) {
  const ok = value === 'Online';
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
        <Icon size={15} color="var(--muted)" /> {label}
      </span>
      <span
        style={{
          fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
          background: ok ? 'rgba(34,197,94,.14)' : 'rgba(148,163,184,.18)',
          color: ok ? '#16a34a' : 'var(--slate)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function PlanBar({ name, count, max }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
        <span style={{ fontWeight: 600 }}>{name}</span>
        <span style={{ color: 'var(--muted)' }}>{count} org{count === 1 ? '' : 's'}</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: 'var(--soft)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: 'var(--rose)' }} />
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { data, loading } = useOverview();
  const { rows: recentAudit, loading: auditLoading } = usePlatformAuditLog({ period: 'all', limit: 8 });

  const maxPlanCount = Math.max(1, ...data.plan_distribution.map(p => p.org_count));

  return (
    <div>
      <div className="page-header">
        <h2><LayoutGrid size={22} /> Overview</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18, marginBottom: 28 }}>
        <StatCard
          label="Organizations" value={loading ? '—' : String(data.organizations.total)}
          sub={`+${data.organizations.new_this_month} this month`} color="#7357E5" icon={Building2} microIcon={MicroIcons.OrganizationTree}
        />
        <StatCard
          label="Platform Users" value={loading ? '—' : String(data.users.total)}
          sub="Across all organizations" color="#E8607A" icon={Users} microIcon={MicroIcons.TeamNetwork}
        />
        <StatCard
          label="Active Subscriptions" value={loading ? '—' : String(data.subscriptions.active_paid)}
          sub={`${data.subscriptions.free_or_trial} on free/trial`} color="#16A36C" icon={Receipt} microIcon={MicroIcons.GrowthChart}
        />
        <StatCard
          label="MRR" value={loading ? '—' : money(data.mrr)}
          sub="From active paid plans" color="#F59E0B" icon={DollarSign} microIcon={MicroIcons.Target}
        />
      </div>

      <div className="grid-2" style={{ gap: 20 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionTitle icon={PieChart} subdued={false}>Plan Distribution</SectionTitle>
          {data.plan_distribution.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>{loading ? 'Loading…' : 'No active subscriptions yet.'}</p>
          ) : (
            data.plan_distribution.map(p => (
              <PlanBar key={p.plan_id} name={p.name} count={p.org_count} max={maxPlanCount} />
            ))
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionTitle icon={Server} subdued={false}>System Health</SectionTitle>
          <HealthRow label="API Server" value={data.system_health.api} icon={Server} />
          <HealthRow label="Database" value={data.system_health.database} icon={Database} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
              <Globe size={15} color="var(--muted)" /> Environment
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'capitalize' }}>
              {data.system_health.environment}
            </span>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 24, alignItems: 'start', gap: 20 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionTitle icon={TrendingUp} subdued={false}>Revenue Growth</SectionTitle>
          <RevenueGrowthChart points={data.revenue_growth} />
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, marginBottom: 0 }}>
            Approximated from each organization's signup date and current plan — historical billing isn't tracked.
          </p>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionTitle icon={ClipboardList} subdued={false}>Recent Audit Log</SectionTitle>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Date &amp; Time</th><th>User</th><th>Module</th><th>Action</th><th>Detail</th></tr>
              </thead>
              <tbody>
                {recentAudit.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
                      {auditLoading ? 'Loading…' : 'No platform activity yet.'}
                    </td>
                  </tr>
                )}
                {recentAudit.map(r => (
                  <tr key={r.id}>
                    <td>{date(r.timestamp)}</td>
                    <td>{r.user || '—'}</td>
                    <td><Badge status={r.module} /></td>
                    <td>{r.action || '—'}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12.5 }}>{r.detail || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
