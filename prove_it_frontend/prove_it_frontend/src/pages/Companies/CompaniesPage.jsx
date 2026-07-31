import { useMemo, useState } from 'react';
import { Building2, Plus, Search } from 'lucide-react';
import useCompanies from './useCompanies.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { openModal, startCreate, resetFields } from '../../bridge/shared/modals.js';
import usePermissions from '../../hooks/usePermissions.js';

const COLUMNS = [
  { key: 'name', header: 'Company', render: r => <strong>{r.name}</strong> },
  { key: 'industry', header: 'Industry' },
  { key: 'primary_contact', header: 'Primary Contact', render: r => r.primary_contact || '—' },
  { key: 'active_projects', header: 'Active Projects' },
  { key: 'status', header: 'Status', render: r => <Badge status={r.status} /> },
];

export default function CompaniesPage() {
  const { can, canCreateOnPage } = usePermissions();
  const { companies, loading } = useCompanies();
  const [industry, setIndustry] = useState('');
  const [search, setSearch] = useState('');

  const industries = useMemo(() => [...new Set(companies.map(c => c.industry).filter(Boolean))].sort(), [companies]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter(c => {
      if (industry && c.industry !== industry) return false;
      if (q && !`${c.name} ${c.industry} ${c.primary_contact || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [companies, industry, search]);

  const handleNewCompany = () => {
    resetFields('modal-company');
    startCreate('page-companies');
    openModal('modal-company');
  };

  return (
    <div>
      <div className="section-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Building2 size={22} /> Companies</h2>
        {canCreateOnPage('companies') && (
          <Button variant="primary" onClick={handleNewCompany}><Plus size={15} /> New Company</Button>
        )}
      </div>

      <div className="filter-bar">
        <select className="form-control" value={industry} onChange={e => setIndustry(e.target.value)}>
          <option value="">All Industries</option>
          {industries.map(i => <option key={i} value={i}>{i}</option>)}
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
          rows={filtered}
          getRowId={r => r.id}
          pageId="page-companies"
          canEdit={can('Companies', 'edit')}
          canDelete={can('Companies', 'delete')}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>
    </div>
  );
}
