import { useState } from 'react';
import { Palmtree, Plus, Check, X, CalendarDays, ClipboardCheck, History } from 'lucide-react';
import useLeave from './useLeave.js';
import StatCard from '../../components/ui/StatCard.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import ReadOnlyField from '../../components/ui/ReadOnlyField.jsx';
import { date } from '../../utils/format.js';
import { openModal, resetFields } from '../../bridge/shared/modals.js';
import usePermissions from '../../hooks/usePermissions.js';
import { MicroIcons } from '../../components/ui/MicroIcons.jsx';

const COLUMNS = [
  { key: 'name', header: 'Employee' },
  { key: 'leave_type', header: 'Type', align: 'center' },
  { key: 'from_date', header: 'From', render: r => date(r.from_date), align: 'center' },
  { key: 'to_date', header: 'To', render: r => date(r.to_date), align: 'center' },
  { key: 'days', header: 'Days', align: 'center' },
  { key: 'active_projects', header: 'Active Projects', render: r => (r.active_projects?.length ? r.active_projects.join(', ') : '—'), align: 'center' },
  { key: 'status', header: 'Status', render: r => <Badge status={r.status} />, align: 'center' },
  { key: 'decision_reason', header: 'Reason', render: r => (r.status === 'Rejected' ? (r.decision_reason || '—') : '—'), align: 'center' },
];

export default function LeavePage() {
  const { can, canCreateOnPage, isMine, noActionsColumn } = usePermissions();
  const { leave, summary, loading } = useLeave();
  // The request currently shown in the read-only View modal (row click) — same pattern
  // as the other pages: a separate look-only surface. Leave never allows Edit/Delete at
  // all (canEdit/canDelete are both hardcoded false below), only Approve/Reject in the
  // kebab, so this is purely additive rather than distinguishing View from an Edit form.
  const [viewingLeave, setViewingLeave] = useState(null);

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
      <div className="page-header">
        <h2><Palmtree size={22} /> Leave</h2>
        {canCreateOnPage('leave') && (
          <Button variant="primary" onClick={() => { resetFields('modal-leave'); openModal('modal-leave'); }}><Plus size={15} /> Apply Leave</Button>
        )}
      </div>

      <div className="mb-5 grid grid-cols-3 gap-4 max-[700px]:grid-cols-1">
        <StatCard label="Leave Balance" value={loading ? '—' : `${summary?.balance ?? 0} days`} sub="" color="var(--color-green)" icon={CalendarDays} microIcon={MicroIcons.CalendarCheck} />
        <StatCard label="Pending Requests" value={loading ? '—' : String(summary?.pending ?? 0)} sub="" color="var(--color-amber)" icon={ClipboardCheck} microIcon={MicroIcons.DocumentTick} />
        <StatCard label="Taken This Year" value={loading ? '—' : `${summary?.taken_this_year ?? 0} days`} sub="" color="var(--color-brand)" icon={History} microIcon={MicroIcons.GrowthChart} />
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
          actionsAsKebab
          onRowClick={setViewingLeave}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>

      {viewingLeave && (
        <Modal
          title={`${viewingLeave.name || viewingLeave.emp_id} — ${date(viewingLeave.from_date)} to ${date(viewingLeave.to_date)}`}
          onClose={() => setViewingLeave(null)}
        >
          {/* modal-leave's own Apply form is a plain single-column stack (no
              .form-grid — like modal-pcode/modal-cost), so this matches that rather
              than forcing a two-column layout it doesn't have. Skips Employee/From/To
              (already the modal title). Reason is the real field the Apply form
              collects but the table never shows (Reason there is actually
              decision_reason — the manager's rejection note, a different field).
              Appends Days/Status/Active Projects/Decision Reason, real fields the
              Apply form doesn't ask for (set only once the request exists/is decided). */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ReadOnlyField label="Leave Type" value={viewingLeave.leave_type} />
            <ReadOnlyField label="Reason" value={viewingLeave.reason} />
            <ReadOnlyField label="Days" value={viewingLeave.days} />
            <ReadOnlyField label="Status" value={<Badge status={viewingLeave.status} />} />
            <ReadOnlyField label="Active Projects" value={viewingLeave.active_projects?.length ? viewingLeave.active_projects.join(', ') : null} />
            <ReadOnlyField label="Decision Reason" value={viewingLeave.status === 'Rejected' ? viewingLeave.decision_reason : null} />
          </div>
        </Modal>
      )}
    </div>
  );
}
