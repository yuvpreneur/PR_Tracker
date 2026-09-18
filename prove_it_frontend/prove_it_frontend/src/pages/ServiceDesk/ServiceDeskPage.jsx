import { useState } from 'react';
import { Ticket, RefreshCw, Hourglass, AlertTriangle, CheckCircle2, Check, X, Plus } from 'lucide-react';
import useServiceDesk from './useServiceDesk.js';
import { SERVICE_DESK_WORKFLOW_HTML } from './serviceDeskDashboardStatic.js';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import SectionTitle from '../../components/ui/SectionTitle.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import ReadOnlyField from '../../components/ui/ReadOnlyField.jsx';
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
  // The ticket currently shown in the read-only View modal (row click) — same pattern
  // as Clients/Projects/Project Codes/Billing Codes: a separate look-only surface, not
  // the Edit form (modal-ticket, still reachable only from the kebab menu's Edit item).
  const [viewingTicket, setViewingTicket] = useState(null);

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

  // Styled to match KebabMenu's own Edit item exactly (flat row, icon + label, same
  // hover) rather than the small bordered pill these used to be as standalone buttons
  // next to it — they now land inside that same popover as `extra` (see DataTable), so
  // they need to read as more rows in that list, not separate controls.
  const menuItemStyle = {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '7px 10px', border: 'none', background: 'transparent',
    cursor: 'pointer', fontSize: 12, fontWeight: 600, borderRadius: 6, textAlign: 'left',
  };
  const onMenuItemHover = e => (e.currentTarget.style.background = 'var(--soft)');
  const onMenuItemUnhover = e => (e.currentTarget.style.background = 'transparent');

  const renderExtraActions = row => {
    const canManage = can('Service Desk', 'approve');
    const mine = isMine(row, 'requester');
    if (OPEN_STATUSES.includes(row.status)) {
      if (!canManage) return null;
      return (
        <button
          className="bridge-resolve" data-page="page-service-desk" data-id={row.id} title="Resolve"
          style={{ ...menuItemStyle, color: '#16A36C' }}
          onMouseEnter={onMenuItemHover} onMouseLeave={onMenuItemUnhover}
        >
          <Check size={13} /> Resolve
        </button>
      );
    }
    if (row.status === 'Resolved') {
      if (!canManage && !mine) return null;
      return (
        <button
          className="bridge-close" data-page="page-service-desk" data-id={row.id} title="Close"
          style={{ ...menuItemStyle, color: 'var(--ink)' }}
          onMouseEnter={onMenuItemHover} onMouseLeave={onMenuItemUnhover}
        >
          <X size={13} /> Close
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
          actionsAsKebab
          onRowClick={setViewingTicket}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>

      {viewingTicket && (
        <Modal title={viewingTicket.ticket_no || viewingTicket.id} onClose={() => setViewingTicket(null)}>
          {/* Mirrors modal-ticket's own field order (global.css's .form-grid) — Subject
              full-width, then Requester/Project, Queue/Priority — but skips its
              "Category" and "Description" inputs, which the backend's TicketCreate/
              _out() never actually had a field for (dead markup from the original
              static prototype, not real data). Appends Resolution/Assigned To/
              Created/Updated At, which GET /api/tickets does return but neither the
              table nor the Create form show, the same way other View modals append
              real fields their own Edit form doesn't ask for. */}
          <div className="form-grid">
            <ReadOnlyField label="Subject" value={viewingTicket.subject} wide />
            <ReadOnlyField label="Requester" value={viewingTicket.requester} />
            <ReadOnlyField label="Project" value={viewingTicket.project_id} />
            <ReadOnlyField label="Queue" value={viewingTicket.queue} />
            <ReadOnlyField label="Priority" value={<Badge status={viewingTicket.priority} />} />
            <ReadOnlyField label="Status" value={<Badge status={viewingTicket.status} />} />
            <ReadOnlyField label="SLA Deadline" value={viewingTicket.sla_deadline ? date(viewingTicket.sla_deadline) : '—'} />
            <ReadOnlyField label="Resolution" value={viewingTicket.resolution} wide />
            <ReadOnlyField label="Assigned To" value={viewingTicket.assigned_to} />
            <ReadOnlyField label="Created At" value={date(viewingTicket.created_at)} />
            <ReadOnlyField label="Updated At" value={date(viewingTicket.updated_at)} />
          </div>
        </Modal>
      )}
    </div>
  );
}
