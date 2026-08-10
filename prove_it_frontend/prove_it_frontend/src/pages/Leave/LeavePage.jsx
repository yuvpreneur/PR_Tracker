import { Palmtree, Plus, Check, X, CalendarDays, ClipboardCheck, History } from 'lucide-react';
import useLeave from './useLeave.js';
import StatCard from '../../components/ui/StatCard.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { date } from '../../utils/format.js';
import { openModal } from '../../bridge/shared/modals.js';
import usePermissions from '../../hooks/usePermissions.js';

const COLUMNS = [
  { key: 'name', header: 'Employee' },
  { key: 'leave_type', header: 'Type' },
  { key: 'from_date', header: 'From', render: r => date(r.from_date) },
  { key: 'to_date', header: 'To', render: r => date(r.to_date) },
  { key: 'days', header: 'Days' },
  { key: 'active_projects', header: 'Active Projects', render: r => (r.active_projects?.length ? r.active_projects.join(', ') : '—') },
  { key: 'status', header: 'Status', render: r => <Badge status={r.status} /> },
  { key: 'decision_reason', header: 'Reason', render: r => (r.status === 'Rejected' ? (r.decision_reason || '—') : '—') },
];

export default function LeavePage() {
  const { can, canCreateOnPage, isMine, noActionsColumn } = usePermissions();
  const { leave, summary, loading } = useLeave();

  const renderExtraActions = row => {
    if (row.status !== 'Pending') return null;
    if (!can('Leave', 'approve') || isMine(row, 'name')) return null;
    return (
      <>
        <button className="bridge-approve rounded-md px-2.5 py-0.5 text-[11px] text-green" data-page="page-leave" data-id={row.id} title="Approve"><Check size={14} /> Approve</button>
        <button className="bridge-reject ml-1 rounded-md px-2.5 py-0.5 text-[11px] text-red" data-page="page-leave" data-id={row.id} title="Reject"><X size={14} /> Reject</button>
      </>
    );
  };

  return (
    <div>
      <div className="section-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Palmtree size={22} /> Leave</h2>
        {canCreateOnPage('leave') && (
          <Button variant="primary" onClick={() => openModal('modal-leave')}><Plus size={15} /> Apply Leave</Button>
        )}
      </div>

      <div className="mb-5 grid grid-cols-3 gap-4 max-[700px]:grid-cols-1">
        <StatCard label="Leave Balance" value={loading ? '—' : `${summary?.balance ?? 0} days`} sub="" color="var(--color-green)" icon={CalendarDays} />
        <StatCard label="Pending Requests" value={loading ? '—' : String(summary?.pending ?? 0)} sub="" color="var(--color-amber)" icon={ClipboardCheck} />
        <StatCard label="Taken This Year" value={loading ? '—' : `${summary?.taken_this_year ?? 0} days`} sub="" color="var(--color-brand)" icon={History} />
      </div>

      <div className="card table-wrap">
        <DataTable
          columns={COLUMNS}
          rows={leave}
          getRowId={r => r.id}
          pageId="page-leave"
          canEdit={false}
          canDelete={false}
          renderExtraActions={renderExtraActions}
          hideActionsColumn={noActionsColumn('leave')}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>
    </div>
  );
}
