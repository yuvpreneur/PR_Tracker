import { useEffect, useState } from 'react';
import { ClipboardList, Plus, Download, Search } from 'lucide-react';
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
  { key: 'user', header: 'User', render: r => r.user || '—', align: 'center' },
  { key: 'module', header: 'Module', render: r => <Badge status={r.module} />, align: 'center' },
  { key: 'action', header: 'Action', render: r => r.action || '—', align: 'center' },
  { key: 'detail', header: 'Detail', render: r => r.detail || '—', align: 'center' },
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
      <div className="page-header">
        <h2><ClipboardList size={22} /> Audit Log</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          {canCreateOnPage('audit') && (
            <Button variant="primary" onClick={handleNew}><Plus size={15} /> Add Entry</Button>
          )}
          {canExportOnPage('audit') && (
            <button type="button" className="form-control" style={{ color: 'var(--rose)', borderColor: 'var(--rose)', marginTop: '8px', width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 12px', cursor: 'pointer' }} onClick={handleExport}><Download size={15} /> Export</button>
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
