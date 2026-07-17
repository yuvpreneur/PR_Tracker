import { useEffect, useMemo, useState } from 'react';
import useAttendance from './useAttendance.js';
import StatCard from '../../components/ui/StatCard.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { get } from '../../bridge/core/http.js';
import { can, canCreateOnPage, isMine } from '../../bridge/shared/permissions.js';
import { openModal, startCreate } from '../../bridge/shared/modals.js';

const BASE_STATUSES = ['Present', 'Absent', 'WFH', 'Late', 'Half Day', 'On Leave'];

const COLUMNS = [
  { key: 'emp_id', header: 'Emp ID', render: r => <strong>{r.emp_id}</strong> },
  { key: 'name', header: 'Name', render: r => r.name || r.emp_id },
  { key: 'att_date', header: 'Date' },
  { key: 'check_in', header: 'Check In', render: r => r.check_in || '—' },
  { key: 'check_out', header: 'Check Out', render: r => r.check_out || '—' },
  { key: 'total_hours', header: 'Total', render: r => `${r.total_hours || 0}h` },
  { key: 'att_status', header: 'Attendance', render: r => <Badge status={r.att_status} /> },
  { key: 'approval_status', header: 'Approval', render: r => <Badge status={r.approval_status} /> },
];

export default function AttendancePage() {
  const [period, setPeriod] = useState('today');
  const [empId, setEmpId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    get('/api/employees').then(rows => setEmployees(rows || [])).catch(() => {});
  }, []);

  const { rows, loading, refresh } = useAttendance({ period, empId, status, search });

  const statuses = useMemo(() => [...new Set([...BASE_STATUSES, ...rows.map(r => r.att_status).filter(Boolean)])].sort(), [rows]);

  const present = rows.filter(r => r.att_status === 'Present' || r.att_status === 'WFH').length;
  const absent = rows.filter(r => r.att_status === 'Absent').length;
  const pending = rows.filter(r => r.approval_status === 'Pending').length;
  const wfh = rows.filter(r => r.att_status === 'WFH').length;
  const labelSuffix = { today: ' Today', this_week: ' This Week', this_month: ' This Month' }[period] || '';

  const handleNew = () => {
    startCreate('page-attendance');
    openModal('modal-attendance');
  };

  const canEditRow = row => can('Attendance', 'edit') || (isMine(row, 'name') && row.approval_status === 'Pending');

  const renderExtraActions = row => {
    if (row.approval_status !== 'Pending') return null;
    if (!can('Attendance', 'approve') || isMine(row, 'name')) return null;
    return (
      <>
        <button className="bridge-approve ml-1 rounded-md px-2.5 py-0.5 text-[11px] text-green" data-page="page-attendance" data-id={row.id} title="Approve">✓ Approve</button>
        <button className="bridge-reject ml-1 rounded-md px-2.5 py-0.5 text-[11px] text-red" data-page="page-attendance" data-id={row.id} title="Reject">✗ Reject</button>
      </>
    );
  };

  return (
    <div>
      <div className="section-header">
        <h2>Attendance</h2>
        {canCreateOnPage('attendance') && (
          <Button variant="primary" onClick={handleNew}>+ Mark Attendance</Button>
        )}
      </div>

      <div className="mb-5 grid grid-cols-3 gap-4 max-[700px]:grid-cols-1">
        <StatCard label={`Present${labelSuffix}${wfh ? ` (incl. ${wfh} WFH)` : ''}`} value={loading ? '—' : String(present)} sub="" color="var(--color-green)" />
        <StatCard label={`Absent${labelSuffix}`} value={loading ? '—' : String(absent)} sub="" color="var(--color-red)" />
        <StatCard label={`Pending Approval${labelSuffix}`} value={loading ? '—' : String(pending)} sub="" color="var(--color-amber)" />
      </div>

      <div className="filter-bar">
        <select className="form-control" value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="today">Today</option>
          <option value="this_week">This Week</option>
          <option value="this_month">This Month</option>
        </select>
        <select className="form-control" value={empId} onChange={e => setEmpId(e.target.value)}>
          <option value="">All Employees</option>
          {employees.map(e => <option key={e.emp_id} value={e.emp_id}>{e.emp_id} - {e.name}</option>)}
        </select>
        <select className="form-control" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Status</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          className="form-control"
          style={{ flex: 1 }}
          placeholder="🔍 Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card table-wrap">
        <DataTable
          columns={COLUMNS}
          rows={rows}
          getRowId={r => r.id}
          pageId="page-attendance"
          canEdit={canEditRow}
          canDelete={false}
          renderExtraActions={renderExtraActions}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>
    </div>
  );
}
