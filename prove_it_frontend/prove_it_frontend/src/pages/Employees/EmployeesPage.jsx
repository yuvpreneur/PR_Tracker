import { useMemo, useState } from 'react';
import useEmployees from './useEmployees.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { can, canCreateOnPage } from '../../bridge/shared/permissions.js';
import { openModal, startCreate } from '../../bridge/shared/modals.js';

const COLUMNS = [
  { key: 'emp_id', header: 'ID', render: r => <strong>{r.emp_id}</strong> },
  { key: 'name', header: 'Name' },
  { key: 'department', header: 'Dept', render: r => r.department || '—' },
  { key: 'designation', header: 'Designation', render: r => r.designation || '—' },
  { key: 'email', header: 'Email' },
  { key: 'status', header: 'Status', render: r => <Badge status={r.status} /> },
  { key: 'billable', header: 'Billing', render: r => <Badge status={r.billable ? 'Billable' : 'Non-Billable'} /> },
];

export default function EmployeesPage() {
  const { employees, loading } = useEmployees();
  const [dept, setDept] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const depts = useMemo(() => [...new Set(employees.map(e => e.department).filter(Boolean))].sort(), [employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter(e => {
      if (dept && e.department !== dept) return false;
      if (status && e.status !== status) return false;
      if (q && !`${e.emp_id} ${e.name} ${e.email} ${e.designation || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [employees, dept, status, search]);

  const handleNew = () => {
    startCreate('page-employees');
    openModal('modal-emp');
  };

  return (
    <div>
      <div className="section-header">
        <h2>Employees</h2>
        {canCreateOnPage('employees') && (
          <Button variant="primary" onClick={handleNew}>+ New Employee</Button>
        )}
      </div>

      <div className="filter-bar">
        <select className="form-control" value={dept} onChange={e => setDept(e.target.value)}>
          <option value="">All Depts</option>
          {depts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="form-control" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option>Active</option>
          <option>Inactive</option>
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
          rows={filtered}
          getRowId={r => r.emp_id}
          pageId="page-employees"
          canEdit={can('Employees', 'edit')}
          canDelete={can('Employees', 'delete')}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>
    </div>
  );
}
