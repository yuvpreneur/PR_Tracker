import { useMemo, useState } from 'react';
import useUsers from './useUsers.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import usePermissions from '../../hooks/usePermissions.js';
import { openModal, startCreate, set, resetFields } from '../../bridge/shared/modals.js';

const ROLES = ['Admin', 'Manager', 'Finance User', 'Employee', 'Viewer'];

const COLUMNS = [
  { key: 'username', header: 'ID', render: r => <strong>{r.username || '—'}</strong> },
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' },
  { key: 'role', header: 'Role', render: r => <Badge status={r.role} /> },
  { key: 'is_active', header: 'Status', render: r => <Badge status={r.pending ? 'Pending' : (r.is_active ? 'Active' : 'Inactive')} /> },
];

export default function UsersPage() {
  const { canCreateOnPage, role: actorRole } = usePermissions();
  const { users, loading } = useUsers();
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      if (role && u.role !== role) return false;
      if (status === 'pending') { if (!u.pending) return false; }
      else if (status) { if (u.pending || String(u.is_active) !== status) return false; }
      if (q && !`${u.username} ${u.name} ${u.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, role, status, search]);

  const handleNew = () => {
    resetFields('modal-user');
    startCreate('page-users');
    openModal('modal-user');
  };

  // Approve a pending Employee (no User account yet — see _pending_employee_rows() in
  // app/routers/users.py) into a real login: prefill the same Create User form used by
  // "+ Create User" with their name/email/role and let the Admin/Manager set a username +
  // password themselves. Mirrors the edit-prefill pattern in bridge/index.js's
  // `.bridge-edit[data-page="page-users"]` handler, just triggered from React instead.
  const handleApprove = row => {
    set('modal-user', 'full name', row.name);
    set('modal-user', 'email', row.email);
    set('modal-user', 'role', row.role);
    set('modal-user', 'employee id', row.emp_id);
    startCreate('page-users');
    openModal('modal-user');
  };

  // Users isn't part of the dynamic Roles & Permissions matrix — edit/delete is a
  // direct role check here. Manager has Admin-equivalent access everywhere else, but
  // can never touch an Admin or Manager account (mirrors PRIVILEGED_ROLES in
  // app/routers/users.py) — only Employee/Finance User/Viewer rows are editable by Manager.
  const isAdmin = actorRole === 'Admin';
  const isManager = actorRole === 'Manager';
  const canTouchRow = row => !row.pending && (isAdmin || (isManager && row.role !== 'Admin' && row.role !== 'Manager'));
  const canApprove = row => row.pending && canCreateOnPage('users') && (isAdmin || (isManager && row.role !== 'Admin' && row.role !== 'Manager'));

  const renderExtraActions = row => (
    canApprove(row) && (
      <button
        className="rounded-md px-2.5 py-0.5 text-[11px] text-green"
        onClick={() => handleApprove(row)}
        title="Approve access"
      >
        ✓ Approve
      </button>
    )
  );

  return (
    <div>
      <div className="section-header">
        <h2>User Management</h2>
        {canCreateOnPage('users') && (
          <Button variant="primary" onClick={handleNew}>+ Create User</Button>
        )}
      </div>

      <div className="filter-bar">
        <select className="form-control" value={role} onChange={e => setRole(e.target.value)}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="form-control" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
          <option value="pending">Pending</option>
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
          getRowId={r => r.id}
          pageId="page-users"
          canEdit={canTouchRow}
          canDelete={canTouchRow}
          renderExtraActions={renderExtraActions}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>
    </div>
  );
}
