import { useEffect, useState } from 'react';
import useAuditLog from './useAuditLog.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { get } from '../../services/httpClient.js';
import { date } from '../../utils/format.js';
import usePermissions from '../../hooks/usePermissions.js';
import { openModal, startCreate, resetFields } from '../../bridge/shared/modals.js';

// Static list — mirrors the legacy markup's hardcoded <option> list exactly
// (this page has no module-discovery endpoint of its own).
const MODULES = ['Users', 'Projects', 'Employees', 'Timesheets', 'Expenses', 'Receivables', 'Access Control'];

const COLUMNS = [
  { key: 'timestamp', header: 'Date & Time', render: r => date(r.timestamp || r.created_at) },
  { key: 'user', header: 'User', render: r => r.user || '—' },
  { key: 'module', header: 'Module', render: r => <Badge status={r.module} /> },
  { key: 'action', header: 'Action', render: r => r.action || '—' },
  { key: 'detail', header: 'Detail', render: r => r.detail || '—' },
];

export default function AuditLogPage() {
  const { canCreateOnPage, canExportOnPage, noActionsColumn, role } = usePermissions();
  const [module, setModule] = useState('');
  const [user, setUser] = useState('');
  const [period, setPeriod] = useState('today');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);

  useEffect(() => {
    get('/api/users').then(rows => setUsers(rows || [])).catch(() => {});
  }, []);

  const { rows, loading } = useAuditLog({ module, user, period, search });

  // Manager has Admin-equivalent access here too (app/routers/audit_log.py allows both).
  const isAdmin = ['Admin', 'Manager'].includes(role);

  const handleNew = () => {
    resetFields('modal-audit');
    startCreate('page-audit');
    openModal('modal-audit');
  };

  const handleExport = () => {
    if (!rows.length) return;
    const cols = ['timestamp', 'user', 'module', 'action', 'detail'];
    const csv = [cols.join(','), ...rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'audit_log.csv';
    a.click();
  };

  return (
    <div>
      <div className="section-header">
        <h2>Audit Log</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          {canCreateOnPage('audit') && (
            <Button variant="primary" onClick={handleNew}>+ Add Entry</Button>
          )}
          {canExportOnPage('audit') && (
            <Button variant="ghost" onClick={handleExport}>↓ Export</Button>
          )}
        </div>
      </div>

      <div className="filter-bar">
        <select className="form-control" value={module} onChange={e => setModule(e.target.value)}>
          <option value="">All Modules</option>
          {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="form-control" value={user} onChange={e => setUser(e.target.value)}>
          <option value="">All Users</option>
          {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
        </select>
        <select className="form-control" value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="today">Today</option>
          <option value="this_week">This Week</option>
          <option value="this_month">This Month</option>
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
          pageId="page-audit"
          canEdit={isAdmin}
          canDelete={isAdmin}
          hideActionsColumn={noActionsColumn('audit')}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>
    </div>
  );
}
