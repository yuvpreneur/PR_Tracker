import { useMemo, useState } from 'react';
import useExpenses from './useExpenses.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { date } from '../../bridge/shared/ui.js';
import { can, canCreateOnPage, isMine } from '../../bridge/shared/permissions.js';
import { openModal, startCreate } from '../../bridge/shared/modals.js';

const CATEGORIES = ['Travel', 'Software', 'Vendor', 'Material', 'Misc'];

export default function ExpensesPage() {
  const { expenses, projects, loading } = useExpenses();
  const [projectId, setProjectId] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const projectName = id => projects.find(p => p.id === id)?.name;

  const columns = useMemo(() => [
    { key: 'project_id', header: 'Project', render: r => projectName(r.project_id) || r.project_id },
    { key: 'project_code_id', header: 'Project Code', render: r => r.project_code_id || '—' },
    { key: 'billing_code_id', header: 'Billing Code', render: r => r.billing_code_id || '—' },
    { key: 'category', header: 'Category', render: r => <Badge status={r.category} /> },
    { key: 'expense_date', header: 'Date', render: r => date(r.expense_date) },
    { key: 'amount', header: 'Amount', render: r => `₹${r.amount.toLocaleString('en-IN')}` },
    { key: 'vendor', header: 'Vendor', render: r => r.vendor || '—' },
    { key: 'status', header: 'Status', render: r => <Badge status={r.status} /> },
  ], [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter(e => {
      if (projectId && e.project_id !== projectId) return false;
      if (category && e.category !== category) return false;
      if (status && e.status !== status) return false;
      if (q && !`${projectName(e.project_id) || ''} ${e.vendor || ''} ${e.project_code_id || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [expenses, projects, projectId, category, status, search]);

  const handleNew = () => {
    startCreate('page-expenses');
    openModal('modal-expense');
  };

  // Expenses is no longer self-service at all (not even own-pending edit) — matches the
  // backend, where expenses.py's create/update endpoints are now purely matrix-gated.
  const canEditRow = () => can('Expenses', 'edit');
  const canDeleteRow = () => can('Expenses', 'delete');

  const renderExtraActions = row => {
    if (row.status !== 'Pending') return null;
    if (!can('Expenses', 'approve') || isMine(row, 'submitted_by')) return null;
    return (
      <>
        <button className="bridge-approve ml-1 rounded-md px-2.5 py-0.5 text-[11px] text-green" data-page="page-expenses" data-id={row.id} title="Approve">✓ Approve</button>
        <button className="bridge-reject ml-1 rounded-md px-2.5 py-0.5 text-[11px] text-red" data-page="page-expenses" data-id={row.id} title="Reject">✗ Reject</button>
      </>
    );
  };

  return (
    <div>
      <div className="section-header">
        <h2>Expenses</h2>
        {canCreateOnPage('expenses') && (
          <Button variant="primary" onClick={handleNew}>+ Add Expense</Button>
        )}
      </div>

      <div className="filter-bar">
        <select className="form-control" value={projectId} onChange={e => setProjectId(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
        </select>
        <select className="form-control" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="form-control" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option>Pending</option>
          <option>Approved</option>
          <option>Rejected</option>
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
          columns={columns}
          rows={filtered}
          getRowId={r => r.id}
          pageId="page-expenses"
          canEdit={canEditRow}
          canDelete={canDeleteRow}
          renderExtraActions={renderExtraActions}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>
    </div>
  );
}
