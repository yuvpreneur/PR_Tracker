import useServiceDesk from './useServiceDesk.js';
import { SERVICE_DESK_DASHBOARD_HTML } from './serviceDeskDashboardStatic.js';
import Badge from '../../components/ui/Badge.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { date } from '../../bridge/shared/ui.js';
import { can, isMine } from '../../bridge/shared/permissions.js';

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
  const { tickets, loading } = useServiceDesk();

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
          ✓ Resolve
        </button>
      );
    }
    if (row.status === 'Resolved') {
      if (!canManage && !mine) return null;
      return (
        <button className="bridge-close ml-1 rounded-md px-2.5 py-0.5 text-[11px]" data-page="page-service-desk" data-id={row.id} title="Close">
          Close
        </button>
      );
    }
    return null;
  };

  return (
    <div>
      <div dangerouslySetInnerHTML={{ __html: SERVICE_DESK_DASHBOARD_HTML }} />

      <div className="card table-wrap">
        <div className="card-section-title">Ticket Workbench</div>
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
