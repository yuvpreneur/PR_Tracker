import { useEffect, useState } from 'react';
import { Clock, Plus, Search, Check, X } from 'lucide-react';
import useTimesheets from './useTimesheets.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Dropdown from '../../components/ui/Dropdown.jsx';
import { date } from '../../utils/format.js';
import { get } from '../../services/httpClient.js';
import usePermissions from '../../hooks/usePermissions.js';
import { openModal, startCreate, resetFields } from '../../bridge/shared/modals.js';

// project_id/billing_code_id are rendered raw (not joined to a name) — mirrors the
// legacy loadTimesheets(), which does the same (unlike Billing/Project Codes' pages).
const COLUMNS = [
  { key: 'emp_id', header: 'Employee', render: r => <strong>{r.emp_id}</strong> },
  { key: 'name', header: 'Name', render: r => r.name || r.emp_id, align: 'center' },
  { key: 'entry_date', header: 'Date', render: r => date(r.entry_date), align: 'center' },
  { key: 'project_id', header: 'Project', align: 'center' },
  { key: 'billing_code_id', header: 'Billing Code', render: r => r.billing_code_id || '—', align: 'center' },
  { key: 'hours', header: 'Hours', render: r => <strong>{r.hours}h</strong>, align: 'center' },
  { key: 'billable', header: 'Type', render: r => <Badge status={r.billable ? 'Billable' : 'Non-Billable'} />, align: 'center' },
  { key: 'status', header: 'Status', render: r => <Badge status={r.status} />, align: 'center' },
];

export default function TimesheetsPage() {
  const { can, canCreateOnPage, isMine, noActionsColumn } = usePermissions();
  const [period, setPeriod] = useState('');
  const [projectId, setProjectId] = useState('');
  const [billingCodeId, setBillingCodeId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState([]);
  const [bcodes, setBcodes] = useState([]);

  useEffect(() => {
    get('/api/projects').then(rows => setProjects(rows || [])).catch(() => {});
    get('/api/billing-codes').then(rows => setBcodes(rows || [])).catch(() => {});
  }, []);

  const { timesheets, loading } = useTimesheets({ period, projectId, billingCodeId, status, search });

  const handleNew = () => {
    resetFields('modal-timesheet');
    startCreate('page-timesheets');
    openModal('modal-timesheet');
  };

  const canEditRow = row => can('Timesheets', 'edit') || (isMine(row, 'name') && row.status === 'Pending');
  // No self-service delete, even for your own pending entry — matches the backend
  // (timesheets.py's DELETE endpoint no longer has an own-pending bypass).
  const canDeleteRow = () => can('Timesheets', 'delete');

  const renderExtraActions = row => {
    if (row.status !== 'Pending') return null;
    if (!can('Timesheets', 'approve') || isMine(row, 'name')) return null;
    return (
      <>
        <button className="bridge-approve ml-1 rounded-md px-2.5 py-0.5 text-[11px] text-green" data-page="page-timesheets" data-id={row.id} title="Approve"><Check size={14} /> Approve</button>
        <button className="bridge-reject ml-1 rounded-md px-2.5 py-0.5 text-[11px] text-red" data-page="page-timesheets" data-id={row.id} title="Reject"><X size={14} /> Reject</button>
      </>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h2><Clock size={22} /> Timesheets</h2>
        {canCreateOnPage('timesheets') && (
          <Button variant="primary" onClick={handleNew}><Plus size={15} /> Submit Hours</Button>
        )}
      </div>

      <div className="filter-bar">
        <Dropdown
          value={projectId}
          onChange={setProjectId}
          options={[
            { value: '', label: 'All Projects' },
            ...projects.map(p => ({ value: p.id, label: `${p.id} — ${p.name}` }))
          ]}
          placeholder="All Projects"
          style={{ width: '180px' }}
        />
        <Dropdown
          value={billingCodeId}
          onChange={setBillingCodeId}
          options={[
            { value: '', label: 'All Billing Codes' },
            ...[...new Set(bcodes.map(b => b.code))].sort().map(c => ({ value: c, label: c }))
          ]}
          placeholder="All Billing Codes"
          style={{ width: '160px' }}
        />
        <Dropdown
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'All Status' },
            { value: 'Approved', label: 'Approved' },
            { value: 'Pending', label: 'Pending' },
            { value: 'Rejected', label: 'Rejected' }
          ]}
          placeholder="All Status"
          style={{ width: '140px' }}
        />
        <Dropdown
          value={period}
          onChange={setPeriod}
          options={[
            { value: '', label: 'All Time' },
            { value: 'this_week', label: 'This Week' },
            { value: 'last_week', label: 'Last Week' },
            { value: 'this_month', label: 'This Month' }
          ]}
          placeholder="All Time"
          style={{ width: '140px' }}
        />
        <div className="relative" style={{ flex: 1, minWidth: 180 }}>
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="form-control"
            style={{ width: '100%', paddingLeft: 32 }}
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card table-wrap">
        <DataTable
          columns={COLUMNS}
          rows={timesheets}
          getRowId={r => r.id}
          pageId="page-timesheets"
          canEdit={canEditRow}
          canDelete={canDeleteRow}
          renderExtraActions={renderExtraActions}
          hideActionsColumn={noActionsColumn('timesheets')}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>
    </div>
  );
}
