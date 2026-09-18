import { useMemo, useState } from 'react';
import { UserCog, Plus, Search, Check } from 'lucide-react';
import useUsers from './useUsers.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Dropdown from '../../components/ui/Dropdown.jsx';
import Modal from '../../components/ui/Modal.jsx';
import ReadOnlyField from '../../components/ui/ReadOnlyField.jsx';
import usePermissions from '../../hooks/usePermissions.js';
import { openModal, startCreate, set, resetFields } from '../../bridge/shared/modals.js';

const ROLES = ['Admin', 'Manager', 'Finance User', 'Employee'];

const COLUMNS = [
  { key: 'username', header: 'ID', render: r => <strong>{r.username || '—'}</strong> },
  { key: 'name', header: 'Name', align: 'center' },
  { key: 'email', header: 'Email', align: 'center' },
  { key: 'role', header: 'Role', render: r => <Badge status={r.role} />, align: 'center' },
  { key: 'is_active', header: 'Status', render: r => <Badge status={r.pending ? 'Pending' : (r.is_active ? 'Active' : 'Inactive')} />, align: 'center' },
];

export default function UsersPage() {
  const { canCreateOnPage, role: actorRole } = usePermissions();
  const { users, loading } = useUsers();
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  // The user currently shown in the read-only View modal (row click) — same pattern as
  // every other page: a separate look-only surface, not the Edit form (modal-user,
  // still reachable only from the kebab menu's Edit item).
  const [viewingUser, setViewingUser] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (Array.isArray(users) ? users : []).filter(u => {
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

  // Styled to match KebabMenu's own Edit/Delete items exactly (flat row, icon + label,
  // same hover) rather than the small bordered pill this used to be as a standalone
  // button next to them — this now lands inside that same popover as `extra` (see
  // DataTable), so it needs to read as one more row in that list, not a separate control.
  const renderExtraActions = row => (
    canApprove(row) && (
      <button
        title="Approve access"
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '7px 10px', border: 'none', background: 'transparent',
          cursor: 'pointer', fontSize: 12, fontWeight: 600, borderRadius: 6,
          color: '#16A36C', textAlign: 'left',
        }}
        onClick={() => handleApprove(row)}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--soft)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <Check size={13} /> Approve
      </button>
    )
  );

  return (
    <div>
      <div className="page-header">
        <h2><UserCog size={22} /> User Management</h2>
        {canCreateOnPage('users') && (
          <Button variant="primary" onClick={handleNew}><Plus size={15} /> Create User</Button>
        )}
      </div>

      <div className="filter-bar">
        <Dropdown
          value={role}
          onChange={setRole}
          options={[
            { value: '', label: 'All Roles' },
            ...ROLES.map(r => ({ value: r, label: r }))
          ]}
          placeholder="All Roles"
          style={{ width: '160px' }}
        />
        <Dropdown
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'All Status' },
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
            { value: 'pending', label: 'Pending' }
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
          getRowId={r => r.id}
          pageId="page-users"
          canEdit={canTouchRow}
          canDelete={canTouchRow}
          renderExtraActions={renderExtraActions}
          actionsAsKebab
          onRowClick={setViewingUser}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>

      {viewingUser && (
        <Modal title={viewingUser.name} onClose={() => setViewingUser(null)}>
          {/* Mirrors modal-user's own real fields (global.css's .form-grid) — Email,
              Role — minus Full Name (already the modal title). Skips its "Employee ID"
              input, which UserCreate/_user_out() never actually had a field for (dead
              markup, not real data — same situation as Service Desk's "Category"/
              "Description") and Temporary Password (write-only, never returned).
              Appends Username/Status, real fields the Create form doesn't ask for
              directly (username is just a copy of the name at creation time — see
              bridge/index.js's modal-user submit handler — but it's the actual login
              credential, worth showing on its own the same way Employees keeps
              Employee ID visible alongside Name). */}
          <div className="form-grid">
            <ReadOnlyField label="Email" value={viewingUser.email} />
            <ReadOnlyField label="Role" value={<Badge status={viewingUser.role} />} />
            <ReadOnlyField label="Username" value={viewingUser.username} />
            <ReadOnlyField label="Status" value={<Badge status={viewingUser.pending ? 'Pending' : (viewingUser.is_active ? 'Active' : 'Inactive')} />} />
          </div>
        </Modal>
      )}
    </div>
  );
}
