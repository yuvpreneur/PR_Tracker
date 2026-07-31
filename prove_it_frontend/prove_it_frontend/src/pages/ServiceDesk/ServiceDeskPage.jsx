import { Ticket, ClipboardCheck, Clock, XCircle, Check, X } from 'lucide-react';
import useServiceDesk from './useServiceDesk.js';
import { SERVICE_DESK_HERO_HTML, SERVICE_DESK_WORKFLOW_HTML } from './serviceDeskDashboardStatic.js';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import SectionTitle from '../../components/ui/SectionTitle.jsx';
import { date } from '../../utils/format.js';
import usePermissions from '../../hooks/usePermissions.js';

const COLUMNS = [
  { key: 'ticket_no', header: 'Ticket', render: r => <strong>{r.ticket_no || r.id}</strong> },
  { key: 'subject', header: 'Subject' },
  { key: 'project_id', header: 'Project', render: r => r.project_id || '—' },
  { key: 'requester', header: 'Requester' },
  { key: 'queue', header: 'Queue', render: r => r.queue || '—' },
  { key: 'priority', header: 'Priority', render: r => <Badge status={r.priority} /> },
  { key: 'status', header: 'Status', render: r => <Badge status={r.status} /> },
  { key: 'sla_deadline', header: 'SLA', render: r => r.sla_deadline ? date(r.sla_deadline) : '—' },
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

  // Mirrors GET /api/tickets/stats' open/high_priority/cancelled definitions — computed
  // client-side from the same `tickets` this page already fetched, rather than a second
  // network call for numbers derivable from data already in hand.
  const openTickets = tickets.filter(t => OPEN_STATUSES.includes(t.status));
  const highPriorityCount = openTickets.filter(t => t.priority === 'High' || t.priority === 'Critical').length;
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
      <div dangerouslySetInnerHTML={{ __html: SERVICE_DESK_HERO_HTML }} />

      <div className="mb-5 grid grid-cols-4 gap-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        <StatCard label="Open Tickets" value={loading ? '—' : String(openTickets.length)} sub={loading ? '' : `${highPriorityCount} high priority`} color="var(--color-brand)" icon={Ticket} />
        {/* SLA Compliance / Avg Resolution: no real computation behind these yet
            (no resolved-at timestamp, no SLA-met definition) — placeholder values kept
            per request until that data/logic is provided. */}
        <StatCard label="SLA Compliance" value="0%" sub="+4% this month" color="var(--color-green)" icon={ClipboardCheck} />
        <StatCard label="Avg Resolution" value="0h" sub="Across all queues" color="var(--color-violet)" icon={Clock} />
        <StatCard label="Cancelled" value={loading ? '—' : String(cancelledCount)} sub="With audit reason" color="var(--color-red)" icon={XCircle} />
      </div>

      <div dangerouslySetInnerHTML={{ __html: SERVICE_DESK_WORKFLOW_HTML }} />

      <div className="card table-wrap">
        <SectionTitle icon={Ticket}>Ticket Workbench</SectionTitle>
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
