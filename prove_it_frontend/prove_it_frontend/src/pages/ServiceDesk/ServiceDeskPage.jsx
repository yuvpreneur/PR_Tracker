import { Ticket, RefreshCw, Hourglass, AlertTriangle, XCircle, Check, X, Plus } from 'lucide-react';
import useServiceDesk from './useServiceDesk.js';
import { SERVICE_DESK_WORKFLOW_HTML } from './serviceDeskDashboardStatic.js';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import SectionTitle from '../../components/ui/SectionTitle.jsx';
import Button from '../../components/ui/Button.jsx';
import { date } from '../../utils/format.js';
import usePermissions from '../../hooks/usePermissions.js';

const COLUMNS = [
  { key: 'ticket_no', header: 'Ticket', render: r => <strong>{r.ticket_no || r.id}</strong> },
  { key: 'subject', header: 'Subject', align: 'center' },
  { key: 'project_id', header: 'Project', render: r => r.project_id || '—', align: 'center' },
  { key: 'requester', header: 'Requester', align: 'center' },
  { key: 'queue', header: 'Queue', render: r => r.queue || '—', align: 'center' },
  { key: 'priority', header: 'Priority', render: r => <Badge status={r.priority} />, align: 'center' },
  { key: 'status', header: 'Status', render: r => <Badge status={r.status} />, align: 'center' },
  { key: 'sla_deadline', header: 'SLA', render: r => r.sla_deadline ? date(r.sla_deadline) : '—', align: 'center' },
];

const LOCKED_STATUSES = ['Closed', 'Cancelled'];
// Self-service editing (the requester editing their own ticket) stops once it's
// Resolved too — mirrors the "Pending only" self-edit window on Timesheets/Expenses.
// Someone with Service Desk:edit can still edit regardless of status (until Closed/Cancelled).
const OWN_EDIT_LOCKED_STATUSES = ['Resolved', 'Closed', 'Cancelled'];
const OPEN_STATUSES = ['Open', 'In Progress', 'Waiting Approval'];

export default function ServiceDeskPage() {
  const { can, isMine } = usePermissions();
  const { tickets, loading } = useServiceDesk();

  // Mirrors GET /api/tickets/stats' open/in_progress/waiting_approval/critical/cancelled
  // definitions — computed client-side from the same `tickets` this page already fetched,
  // rather than a second network call for numbers derivable from data already in hand.
  const openTickets = tickets.filter(t => OPEN_STATUSES.includes(t.status));
  const highPriorityCount = openTickets.filter(t => t.priority === 'High' || t.priority === 'Critical').length;
  const inProgressCount = tickets.filter(t => t.status === 'In Progress').length;
  const waitingApprovalCount = tickets.filter(t => t.status === 'Waiting Approval').length;
  const criticalCount = openTickets.filter(t => t.priority === 'Critical').length;
  const cancelledCount = tickets.filter(t => t.status === 'Cancelled').length;

  const canEditRow = row => can('Service Desk', 'edit')
    ? !LOCKED_STATUSES.includes(row.status)
    : (isMine(row, 'requester') && !OWN_EDIT_LOCKED_STATUSES.includes(row.status));

  const renderExtraActions = row => {
    const canManage = can('Service Desk', 'approve');
    const mine = isMine(row, 'requester');
    if (OPEN_STATUSES.includes(row.status)) {
      if (!canManage) return null;
      return (
        <button className="bridge-resolve ml-1 rounded-md px-2.5 py-0.5 text-[11px] text-green" data-page="page-service-desk" data-id={row.id} title="Resolve">
          <Check size={14} /> Resolve
        </button>
      );
    }
    if (row.status === 'Resolved') {
      if (!canManage && !mine) return null;
      return (
        <button className="bridge-close ml-1 rounded-md px-2.5 py-0.5 text-[11px]" data-page="page-service-desk" data-id={row.id} title="Close">
          <X size={14} /> Close
        </button>
      );
    }
    return null;
  };

  return (
    <div>
      <div className="page-header">
        <h2><Ticket size={22} /> Service Desk Integration</h2>
        <Button variant="primary" onClick={() => openModal('modal-ticket')}>
          <Plus size={14} /> Create Ticket
        </Button>
      </div>

      <div className="mb-5 grid grid-cols-5 gap-4 max-[900px]:grid-cols-3 max-[560px]:grid-cols-1">
        <StatCard label="Open Tickets" value={loading ? '—' : String(openTickets.length)} sub={loading ? '' : `${highPriorityCount} high priority`} color="var(--color-brand)" icon={Ticket} />
        <StatCard label="In Progress" value={loading ? '—' : String(inProgressCount)} sub="Being worked on" color="var(--color-accent)" icon={RefreshCw} />
        <StatCard label="Waiting Approval" value={loading ? '—' : String(waitingApprovalCount)} sub="Needs sign-off" color="var(--color-amber)" icon={Hourglass} />
        <StatCard label="Critical" value={loading ? '—' : String(criticalCount)} sub="Open & critical priority" color="var(--color-red)" icon={AlertTriangle} />
        <StatCard label="Cancelled" value={loading ? '—' : String(cancelledCount)} sub="With audit reason" color="var(--color-text2)" icon={XCircle} />
      </div>

      <div dangerouslySetInnerHTML={{ __html: SERVICE_DESK_WORKFLOW_HTML }} />

      <div className="card table-wrap">
        <DataTable
          columns={COLUMNS}
          rows={tickets}
          getRowId={r => r.id}
          pageId="page-service-desk"
          canEdit={canEditRow}
          canDelete={false}
          renderExtraActions={renderExtraActions}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>
    </div>
  );
}
