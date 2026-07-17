import { useMemo, useState } from 'react';
import useApprovals from './useApprovals.js';
import StatCard from '../../components/ui/StatCard.jsx';
import { date, num } from '../../bridge/shared/ui.js';
import { can } from '../../bridge/shared/permissions.js';

const TYPE_LABEL = { timesheets: 'Timesheet', expenses: 'Expense', attendance: 'Attendance', access: 'Access Control' };
// Maps a row's _mod to the Roles & Permissions matrix module it's approved under. 'access'
// has no matrix entry — those rows only ever reach here for Admin (see approvals.py), so
// they're always actionable and deliberately left out of this map.
const MOD_TO_PERMISSION_MODULE = { timesheets: 'Timesheets', expenses: 'Expenses', attendance: 'Attendance' };
const TYPE_COLOR = { Timesheet: '#3b82f6', Expense: '#f59e0b', Attendance: '#22c55e', 'Access Control': '#64748b' };

// This page's type badge uses its own color map (Timesheet/Expense/Attendance/Access
// Control), distinct from the shared <Badge> component's status color map — a local,
// small inline pill instead of extending <Badge> for this one-off case.
function TypeBadge({ mod }) {
  const label = TYPE_LABEL[mod] || mod;
  const color = TYPE_COLOR[label] || '#64748b';
  return (
    <span className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${color}20`, color }}>
      {label}
    </span>
  );
}

// Mirrors the legacy describeApproval() exactly — note it does NOT include a
// "submitted on" sub-line despite the static demo markup showing one; the real
// renderApprovalsTable() output never had that line either.
function describeApproval(r) {
  switch (r._mod) {
    case 'timesheets': return { name: r.name || r.emp_id, detail: `${r.hours}h – ${r.project_id} – ${date(r.entry_date)}` };
    case 'expenses': return { name: r.submitted_by, detail: `₹${num(r.amount)} – ${r.category}${r.vendor ? ' / ' + r.vendor : ''}` };
    case 'attendance': return { name: r.name || r.emp_id, detail: `${date(r.att_date)} attendance – ${r.total_hours}h` };
    case 'access': return { name: r.requester, detail: `Access to ${r.page}${r.project ? ' (' + r.project + ')' : ''}` };
    default: return { name: '—', detail: '' };
  }
}

export default function ApprovalsPage() {
  const { counts, all, loading } = useApprovals();
  const [filter, setFilter] = useState('');

  const rows = useMemo(() => (filter ? all.filter(r => r._mod === filter) : all), [all, filter]);

  return (
    <div>
      <div className="section-header">
        <h2>Approval Dashboard</h2>
        <select id="appr-type-filter" className="form-control" style={{ width: 'auto' }} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="timesheets">Timesheet</option>
          <option value="expenses">Expense</option>
          <option value="attendance">Attendance</option>
          <option value="access">Access Control</option>
        </select>
      </div>

      <div className="mb-5 grid grid-cols-4 gap-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        <StatCard label="Pending Timesheets" value={loading ? '—' : String(counts.timesheets)} sub="" color="var(--color-accent)" />
        <StatCard label="Pending Expenses" value={loading ? '—' : String(counts.expenses)} sub="" color="var(--color-amber)" />
        <StatCard label="Pending Attendance" value={loading ? '—' : String(counts.attendance)} sub="" color="var(--color-green)" />
        <StatCard label="Pending Access Control" value={loading ? '—' : String(counts.access)} sub="" color="var(--color-text2)" />
      </div>

      <div className="card">
        <div className="card-section-title">Pending Approvals</div>
        {rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8', fontSize: 13 }}>
            No pending {filter ? (TYPE_LABEL[filter] || filter) : ''} approvals
          </div>
        )}
        {rows.map(row => {
          const { name, detail } = describeApproval(row);
          const permModule = MOD_TO_PERMISSION_MODULE[row._mod];
          const canAct = permModule ? can(permModule, 'approve') : true;
          return (
            <div className="approval-item" key={`${row._mod}-${row.id}`}>
              <TypeBadge mod={row._mod} />
              <div className="approval-info">
                <div className="approval-name">{name}</div>
                <div className="approval-detail">{detail}</div>
              </div>
              <div className="approval-actions">
                {canAct && <button className="btn btn-success btn-sm bridge-approve" data-module={row._mod} data-id={row.id}>✓ Approve</button>}
                {canAct && <button className="btn btn-danger btn-sm bridge-reject" data-module={row._mod} data-id={row.id}>✗ Reject</button>}
                <button className="btn btn-ghost btn-sm bridge-view" data-module={row._mod} data-id={row.id}>View</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
