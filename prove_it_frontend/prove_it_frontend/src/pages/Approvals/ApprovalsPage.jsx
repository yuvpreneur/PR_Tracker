import { useMemo, useState } from 'react';
import { ClipboardCheck, Clock, Receipt, CalendarDays, KeyRound, Check, X, Eye } from 'lucide-react';
import useApprovals from './useApprovals.js';
import StatCard from '../../components/ui/StatCard.jsx';
import SectionTitle from '../../components/ui/SectionTitle.jsx';
import Dropdown from '../../components/ui/Dropdown.jsx';
import { date, num } from '../../utils/format.js';
import usePermissions from '../../hooks/usePermissions.js';

const TYPE_LABEL = { timesheets: 'Timesheet', expenses: 'Expense', leave: 'Leave', access: 'Access Control' };
// Maps a row's _mod to the Roles & Permissions matrix module it's approved under. 'access'
// has no matrix entry — those rows only ever reach here for Admin (see approvals.py), so
// they're always actionable and deliberately left out of this map.
const MOD_TO_PERMISSION_MODULE = { timesheets: 'Timesheets', expenses: 'Expenses', leave: 'Leave' };
const TYPE_COLOR = { Timesheet: '#3b82f6', Expense: '#f59e0b', Leave: '#7c3aed', 'Access Control': '#64748b' };

// This page's type badge uses its own color map (Timesheet/Expense/Leave/Access
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
    case 'expenses': return { name: r.submitted_by, detail: `₹${num(r.amount)} – ${r.category}${r.vendor ? ' / ' + r.vendor : ''}${r.status === 'Pending Finance' ? ' – awaiting Finance' : ' – awaiting Manager'}` };
    case 'leave': return { name: r.name || r.emp_id, detail: `${r.leave_type} – ${date(r.from_date)} to ${date(r.to_date)} – ${r.days}d` };
    case 'access': return {
      name: r.requester,
      detail: r.request_type === 'project'
        ? `Project access to ${r.project_id}`
        : `Access to ${r.page}${r.project ? ' (' + r.project + ')' : ''}`,
    };
    default: return { name: '—', detail: '' };
  }
}

export default function ApprovalsPage() {
  const { can, role } = usePermissions();
  const { counts, all, loading } = useApprovals();
  const [filter, setFilter] = useState('');

  // Finance User has no say over Timesheets/Leave/Access Control at all, and within
  // Expenses only ever acts at the "Pending Finance" stage (see approvals.py's
  // pending_approvals(), which already excludes everything else server-side for them) —
  // so their view only offers the one category they can actually do something with.
  const isFinanceUser = role === 'Finance User';

  const rows = useMemo(() => (filter ? all.filter(r => r._mod === filter) : all), [all, filter]);

  return (
    <div>
      <div className="page-header">
        <h2><ClipboardCheck size={22} /> Approval Dashboard</h2>
        <Dropdown
          value={filter}
          onChange={setFilter}
          options={[
            { value: '', label: 'All Types' },
            ...(!isFinanceUser ? [{ value: 'timesheets', label: 'Timesheet' }] : []),
            { value: 'expenses', label: 'Expense' },
            ...(!isFinanceUser ? [{ value: 'leave', label: 'Leave' }] : []),
            ...(!isFinanceUser ? [{ value: 'access', label: 'Access Control' }] : [])
          ]}
          placeholder="All Types"
          style={{ width: '160px' }}
        />
      </div>

      {isFinanceUser ? (
        <div className="mb-5 grid grid-cols-1 gap-4 max-w-xs">
          <StatCard label="Pending Expenses" value={loading ? '—' : String(counts.expenses)} sub="" color="var(--color-amber)" icon={Receipt} />
        </div>
      ) : (
        <div className="mb-5 grid grid-cols-4 gap-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
          <StatCard label="Pending Timesheets" value={loading ? '—' : String(counts.timesheets)} sub="" color="var(--color-accent)" icon={Clock} />
          <StatCard label="Pending Expenses" value={loading ? '—' : String(counts.expenses)} sub="" color="var(--color-amber)" icon={Receipt} />
          <StatCard label="Pending Leave" value={loading ? '—' : String(counts.leave)} sub="" color="var(--color-violet)" icon={CalendarDays} />
          <StatCard label="Pending Access Control" value={loading ? '—' : String(counts.access)} sub="" color="var(--color-text2)" icon={KeyRound} />
        </div>
      )}

      <div className="card">
        <SectionTitle icon={ClipboardCheck}>Pending Approvals</SectionTitle>
        {rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8', fontSize: 13 }}>
            No pending {filter ? (TYPE_LABEL[filter] || filter) : ''} approvals
          </div>
        )}
        {rows.map(row => {
          const { name, detail } = describeApproval(row);
          const permModule = MOD_TO_PERMISSION_MODULE[row._mod];
          // Expenses is a two-stage chain (Manager confirms business purpose, then Finance
          // validates policy + posts payment — see expenses.py) — the blanket module
          // "approve" flag can't tell which stage this row is at, so gate on the row's
          // own status + the viewer's role instead of the matrix.
          const canAct = row._mod === 'expenses'
            ? (role === 'Admin'
                || (row.status === 'Pending' && role === 'Manager')
                || (row.status === 'Pending Finance' && role === 'Finance User'))
            : (permModule ? can(permModule, 'approve') : true);
          return (
            <div className="approval-item" key={`${row._mod}-${row.id}`}>
              <TypeBadge mod={row._mod} />
              <div className="approval-info">
                <div className="approval-name">{name}</div>
                <div className="approval-detail">{detail}</div>
              </div>
              <div className="approval-actions">
                {canAct && <button className="btn btn-success btn-sm bridge-approve" data-module={row._mod} data-id={row.id}><Check size={14} /> Approve</button>}
                {canAct && <button className="btn btn-danger btn-sm bridge-reject" data-module={row._mod} data-id={row.id}><X size={14} /> Reject</button>}
                <button className="btn btn-ghost btn-sm bridge-view" data-module={row._mod} data-id={row.id}><Eye size={14} /> View</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
