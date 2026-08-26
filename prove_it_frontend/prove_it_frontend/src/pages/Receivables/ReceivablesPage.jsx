import { useMemo, useState } from 'react';
import { Inbox, Plus, Search, IndianRupee, Wallet, Clock, AlertTriangle } from 'lucide-react';
import useReceivables from './useReceivables.js';
import StatCard from '../../components/ui/StatCard.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { date, num } from '../../utils/format.js';
import { openModal, startCreate, resetFields } from '../../bridge/shared/modals.js';
import usePermissions from '../../hooks/usePermissions.js';

// The legacy stats-row here was 4 hardcoded numbers (₹10.0L/₹5.5L/₹4.5L/₹2.0L) that
// no code ever updated — unlike Service Desk's much larger decorative
// dashboard (ported verbatim per the user's explicit call), these are simple sums
// over data already being fetched, so they're computed for real here instead.
function sum(rows, key) { return rows.reduce((t, r) => t + (r[key] || 0), 0); }

export default function ReceivablesPage() {
  const { can, canCreateOnPage } = usePermissions();
  const { receivables, projects, loading } = useReceivables();
  const [projectId, setProjectId] = useState('');
  const [client, setClient] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const projectName = id => projects.find(p => p.id === id)?.name;
  const clients = useMemo(() => [...new Set(receivables.map(r => r.client).filter(Boolean))].sort(), [receivables]);

  const totalBilled = useMemo(() => sum(receivables, 'invoice_amount'), [receivables]);
  const received = useMemo(() => sum(receivables, 'received_amount'), [receivables]);
  const outstanding = useMemo(() => sum(receivables, 'balance'), [receivables]);
  const overdue = useMemo(() => sum(receivables.filter(r => r.status === 'Overdue'), 'balance'), [receivables]);

  const columns = useMemo(() => [
    { key: 'project_id', header: 'Project', render: r => projectName(r.project_id) || r.project_id },
    { key: 'billing_code_id', header: 'Billing Code', render: r => r.billing_code_id || '—', align: 'center' },
    { key: 'client', header: 'Client', align: 'center' },
    { key: 'invoice_no', header: 'Invoice #', align: 'center' },
    { key: 'invoice_date', header: 'Date', render: r => date(r.invoice_date), align: 'center' },
    { key: 'invoice_amount', header: 'Invoice Amt', render: r => `₹${num(r.invoice_amount)}`, align: 'center' },
    { key: 'received_amount', header: 'Received', render: r => `₹${num(r.received_amount)}`, align: 'center' },
    { key: 'balance', header: 'Balance', render: r => `₹${num(r.balance)}`, align: 'center' },
    { key: 'due_date', header: 'Due Date', render: r => date(r.due_date), align: 'center' },
    { key: 'status', header: 'Status', render: r => <Badge status={r.status} />, align: 'center' },
  ], [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return receivables.filter(r => {
      if (projectId && r.project_id !== projectId) return false;
      if (client && r.client !== client) return false;
      if (status && r.status !== status) return false;
      if (q && !`${projectName(r.project_id) || ''} ${r.client} ${r.invoice_no}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [receivables, projects, projectId, client, status, search]);

  const handleNew = () => {
    resetFields('modal-recv');
    startCreate('page-receivables');
    openModal('modal-recv');
  };

  return (
    <div>
      <div className="page-header">
        <h2><Inbox size={22} /> Receivables</h2>
        {canCreateOnPage('receivables') && (
          <Button variant="primary" onClick={handleNew}><Plus size={15} /> Add Receivable</Button>
        )}
      </div>

      <div className="mb-5 grid grid-cols-4 gap-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        <StatCard label="Total Billed" value={loading ? '—' : `₹${num(totalBilled)}`} sub="" color="var(--color-accent)" icon={IndianRupee} />
        <StatCard label="Received" value={loading ? '—' : `₹${num(received)}`} sub="" color="var(--color-green)" icon={Wallet} />
        <StatCard label="Outstanding" value={loading ? '—' : `₹${num(outstanding)}`} sub="" color="var(--color-amber)" icon={Clock} />
        <StatCard label="Overdue" value={loading ? '—' : `₹${num(overdue)}`} sub="" color="var(--color-red)" icon={AlertTriangle} />
      </div>

      <div className="filter-bar">
        <select className="form-control" value={projectId} onChange={e => setProjectId(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
        </select>
        <select className="form-control" value={client} onChange={e => setClient(e.target.value)}>
          <option value="">All Clients</option>
          {clients.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="form-control" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option>Pending</option>
          <option>Partial</option>
          <option>Paid</option>
          <option>Overdue</option>
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
          columns={columns}
          rows={filtered}
          getRowId={r => r.id}
          pageId="page-receivables"
          canEdit={can('Receivables', 'edit')}
          canDelete={can('Receivables', 'delete')}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>
    </div>
  );
}
