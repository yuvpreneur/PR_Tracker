import { useMemo, useState } from 'react';
import useUsers from './useUsers.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { state } from '../../bridge/core/state.js';
import { canCreateOnPage } from '../../bridge/shared/permissions.js';
import { openModal, startCreate } from '../../bridge/shared/modals.js';

const ROLES = ['Admin', 'Manager', 'Finance User', 'Employee', 'Viewer'];

const COLUMNS = [
  { key: 'username', header: 'ID', render: r => <strong>{r.username}</strong> },
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' },
  { key: 'role', header: 'Role', render: r => <Badge status={r.role} /> },
  { key: 'projects', header: 'Projects', render: () => '—' },
  { key: 'is_active', header: 'Status', render: r => <Badge status={r.is_active ? 'Active' : 'Inactive'} /> },
];

export default function UsersPage() {
  const { users, loading } = useUsers();
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      if (role && u.role !== role) return false;
      if (status && String(u.is_active) !== status) return false;
      if (q && !`${u.username} ${u.name} ${u.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, role, status, search]);

  const handleNew = () => {
    startCreate('page-users');
    openModal('modal-user');
  };

  // Users isn't part of the dynamic Roles & Permissions matrix (see
  // ADMIN_MANAGER_PAGES in shared/permissions.js) — edit/delete is a direct
  // Admin-only role check, mirroring the legacy loadUsers() exactly.
  const isAdmin = state.currentUser?.role === 'Admin';

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
          canEdit={isAdmin}
          canDelete={isAdmin}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>
    </div>
  );
}
