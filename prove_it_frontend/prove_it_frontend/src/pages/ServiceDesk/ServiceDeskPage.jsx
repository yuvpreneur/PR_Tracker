import { Ticket, RefreshCw, Hourglass, AlertTriangle, CheckCircle2, Check, X, Plus } from 'lucide-react';
import useServiceDesk from './useServiceDesk.js';
import { SERVICE_DESK_WORKFLOW_HTML } from './serviceDeskDashboardStatic.js';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import SectionTitle from '../../components/ui/SectionTitle.jsx';
import Button from '../../components/ui/Button.jsx';
import { date } from '../../utils/format.js';
import usePermissions from '../../hooks/usePermissions.js';
import { MicroIcons } from '../../components/ui/MicroIcons.jsx';
import { openModal, startCreate, resetFields } from '../../bridge/shared/modals.js';
import { setTicketModalMode } from '../../bridge/pages/servicedesk.js';

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

const LOCKED_STATUSES = ['Closed'];
// Self-service editing (the requester editing their own ticket) stops once it's
// Resolved too — mirrors the "Pending only" self-edit window on Timesheets/Expenses.
// Someone with Service Desk:edit can still edit regardless of status (until Closed).
const OWN_EDIT_LOCKED_STATUSES = ['Resolved', 'Closed'];
const OPEN_STATUSES = ['Open', 'In Progress', 'Waiting Approval'];

export default function ServiceDeskPage() {
  const { can, isMine } = usePermissions();
  const { tickets, loading } = useServiceDesk();

  // Mirrors GET /api/tickets/stats' open/in_progress/waiting_approval/critical/closed_total
  // definitions — computed client-side from the same `tickets` this page already fetched,
  // rather than a second network call for numbers derivable from data already in hand.
  const openTickets = (Array.isArray(tickets) ? tickets : []).filter(t => OPEN_STATUSES.includes(t.status));
  const highPriorityCount = (Array.isArray(openTickets) ? openTickets : []).filter(t => t.priority === 'High' || t.priority === 'Critical').length;
  const inProgressCount = (Array.isArray(tickets) ? tickets : []).filter(t => t.status === 'In Progress').length;
  const waitingApprovalCount = (Array.isArray(tickets) ? tickets : []).filter(t => t.status === 'Waiting Approval').length;
  const criticalCount = (Array.isArray(openTickets) ? openTickets : []).filter(t => t.priority === 'Critical').length;
  // Everything that has reached the end of the pipeline. Resolved counts here because a
  // resolved ticket is finished work — Closed is only the sign-off that follows it — so
  // the card is not stuck on 0 for every ticket awaiting that last step.
  const closedCount = (Array.isArray(tickets) ? tickets : []).filter(t => ['Resolved', 'Closed'].includes(t.status)).length;

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

  // These modals are persistent DOM nodes shared between Create and Edit, so opening one
  // without clearing it first shows whatever was last typed or loaded into it. This
  // button used to call the legacy global openModal(), which only toggles a CSS class —
  // it reset neither the fields nor the Create/Edit state, so "Create Ticket" could
  // arrive pre-filled and, after a cancelled Edit, still be holding that row's id and
  // quietly update it instead of creating. Same three calls every other page's "+ New"
  // makes.
  const handleNew = () => {
    resetFields('modal-ticket');
    startCreate('page-service-desk');
    // Restores the "Create" heading/button after an Edit, and hides the Status field —
    // every new ticket starts Open, so that dropdown belongs to Edit only.
    setTicketModalMode(false);
    openModal('modal-ticket');
  };

  return (
    <div>
      <div className="page-header">
        <h2><Ticket size={22} /> Service Desk Integration</h2>
        <Button variant="primary" onClick={handleNew}>
          <Plus size={14} /> Create Ticket
        </Button>
      </div>

      <div className="mb-5 grid grid-cols-5 gap-4 max-[900px]:grid-cols-3 max-[560px]:grid-cols-1">
        <StatCard label="Open Tickets" value={loading ? '—' : String(openTickets.length)} sub={loading ? '' : `${highPriorityCount} high priority`} color="var(--color-brand)" icon={Ticket} microIcon={MicroIcons.EmployeeCard} />
        <StatCard label="In Progress" value={loading ? '—' : String(inProgressCount)} sub="Being worked on" color="var(--color-accent)" icon={RefreshCw} microIcon={MicroIcons.GrowthChart} />
        <StatCard label="Waiting Approval" value={loading ? '—' : String(waitingApprovalCount)} sub="Needs sign-off" color="var(--color-amber)" icon={Hourglass} microIcon={MicroIcons.ClockCheck} />
        <StatCard label="Critical" value={loading ? '—' : String(criticalCount)} sub="Open & critical priority" color="var(--color-red)" icon={AlertTriangle} microIcon={MicroIcons.Target} />
        <StatCard label="Closed" value={loading ? '—' : String(closedCount)} sub="Resolved & closed" color="var(--color-green)" icon={CheckCircle2} microIcon={MicroIcons.DocumentTick} />
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
