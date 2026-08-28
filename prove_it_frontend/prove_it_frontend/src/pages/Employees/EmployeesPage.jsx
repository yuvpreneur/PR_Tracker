import { useMemo, useState } from 'react';
import { Users, Plus, Search } from 'lucide-react';
import useEmployees from './useEmployees.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Dropdown from '../../components/ui/Dropdown.jsx';
import { openModal, startCreate, resetFields } from '../../bridge/shared/modals.js';
import usePermissions from '../../hooks/usePermissions.js';

const COLUMNS = [
  { key: 'emp_id', header: 'ID', render: r => <strong>{r.emp_id}</strong> },
  { key: 'name', header: 'Name', align: 'center' },
  { key: 'department', header: 'Dept', render: r => r.department || '—', align: 'center' },
  { key: 'designation', header: 'Designation', render: r => r.designation || '—', align: 'center' },
  { key: 'email', header: 'Email', align: 'center' },
  { key: 'status', header: 'Status', render: r => <Badge status={r.status} />, align: 'center' },
  { key: 'billable', header: 'Billing', render: r => <Badge status={r.billable ? 'Billable' : 'Non-Billable'} />, align: 'center' },
  {
    key: 'pm_sync_status', header: 'PR Manager',
    render: r => r.pm_access_enabled ? <Badge status={r.pm_sync_status} /> : <Badge status="Not Enabled" />,
    align: 'center',
  },
];

export default function EmployeesPage() {
  const { can, canCreateOnPage } = usePermissions();
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
    resetFields('modal-emp');
    startCreate('page-employees');
    openModal('modal-emp');
  };

  return (
    <div>
      <div className="page-header">
        <h2><Users size={22} /> Employees</h2>
        {canCreateOnPage('employees') && (
          <Button variant="primary" onClick={handleNew}><Plus size={15} /> New Employee</Button>
        )}
      </div>

      <div className="filter-bar">
        <Dropdown
          value={dept}
          onChange={setDept}
          options={[
            { value: '', label: 'All Depts' },
            ...depts.map(d => ({ value: d, label: d }))
          ]}
          placeholder="All Depts"
          style={{ width: '160px' }}
        />
        <Dropdown
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'All Status' },
            { value: 'Active', label: 'Active' },
            { value: 'Inactive', label: 'Inactive' }
          ]}
          placeholder="All Status"
          style={{ width: '160px' }}
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
