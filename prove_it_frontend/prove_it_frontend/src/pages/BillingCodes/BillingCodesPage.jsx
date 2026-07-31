import { useMemo, useState } from 'react';
import { CreditCard, Plus, Search } from 'lucide-react';
import useBillingCodes from './useBillingCodes.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { date, num } from '../../utils/format.js';
import { openModal, startCreate, resetFields } from '../../bridge/shared/modals.js';
import usePermissions from '../../hooks/usePermissions.js';

export default function BillingCodesPage() {
  const { can, canCreateOnPage } = usePermissions();
  const { bcodes, projects, loading } = useBillingCodes();
  const [projectId, setProjectId] = useState('');
  const [billingType, setBillingType] = useState('');
  const [search, setSearch] = useState('');

  const projectName = id => projects.find(p => p.id === id)?.name;

  const columns = useMemo(() => [
    { key: 'code', header: 'Billing Code', render: r => <strong>{r.code}</strong> },
    { key: 'project_code_id', header: 'Project Code' },
    { key: 'project_id', header: 'Project', render: r => projectName(r.project_id) || r.project_id },
    { key: 'client', header: 'Client', render: r => r.client || '—' },
    { key: 'billing_type', header: 'Type', render: r => <Badge status={r.billing_type} /> },
    { key: 'rate', header: 'Rate', render: r => `₹${num(r.rate)}${r.billing_type === 'T&M' ? '/hr' : ''}` },
    { key: 'status', header: 'Status', render: r => <Badge status={r.status} /> },
    { key: 'effective_from', header: 'Eff. From', render: r => date(r.effective_from) },
    { key: 'effective_to', header: 'Eff. To', render: r => date(r.effective_to) },
  ], [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bcodes.filter(b => {
      if (projectId && b.project_id !== projectId) return false;
      if (billingType && b.billing_type !== billingType) return false;
      if (q && !`${b.code} ${b.project_code_id} ${projectName(b.project_id) || ''} ${b.client || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [bcodes, projects, projectId, billingType, search]);

  const handleNew = () => {
    resetFields('modal-bcode');
    startCreate('page-billing-codes');
    openModal('modal-bcode');
  };

  return (
    <div>
      <div className="section-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><CreditCard size={22} /> Billing Codes</h2>
        {canCreateOnPage('billing-codes') && (
          <Button variant="primary" onClick={handleNew}><Plus size={15} /> New Billing Code</Button>
        )}
      </div>

      <div className="filter-bar">
        <select className="form-control" value={projectId} onChange={e => setProjectId(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}
        </select>
        <select className="form-control" value={billingType} onChange={e => setBillingType(e.target.value)}>
          <option value="">All Types</option>
          <option value="T&M">T&M</option>
          <option value="Fixed">Fixed</option>
          <option value="Milestone">Milestone</option>
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
          getRowId={r => r.code}
          pageId="page-billing-codes"
          canEdit={can('Billing Codes', 'edit')}
          canDelete={can('Billing Codes', 'delete')}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>
    </div>
  );
}
