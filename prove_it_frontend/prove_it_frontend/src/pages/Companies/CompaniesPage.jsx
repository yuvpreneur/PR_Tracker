import { useMemo, useState } from 'react';
import { Building2, Plus, Search } from 'lucide-react';
import useCompanies from './useCompanies.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Dropdown from '../../components/ui/Dropdown.jsx';
import Modal from '../../components/ui/Modal.jsx';
import ReadOnlyField from '../../components/ui/ReadOnlyField.jsx';
import { openModal, startCreate, resetFields, setModalMode } from '../../bridge/shared/modals.js';
import usePermissions from '../../hooks/usePermissions.js';

const COLUMNS = [
  { key: 'name', header: 'Client', render: r => <strong>{r.name}</strong> },
  { key: 'industry', header: 'Industry', align: 'center' },
  { key: 'primary_contact', header: 'Primary Contact', align: 'center', render: r => r.primary_contact || '—' },
  { key: 'active_projects', header: 'Active Projects', align: 'center' },
  { key: 'status', header: 'Status', align: 'center', render: r => <Badge status={r.status} /> },
  {
    key: 'pm_sync_status', header: 'PR Manager', align: 'center',
    render: r => (
      <span title={r.pm_missing_fields?.length ? `Needs: ${r.pm_missing_fields.join(', ')}` : undefined}>
        <Badge status={r.pm_sync_status} />
      </span>
    ),
  },
];

export default function CompaniesPage() {
  const { can, canCreateOnPage } = usePermissions();
  const { companies, loading } = useCompanies();
  const [industry, setIndustry] = useState('');
  const [search, setSearch] = useState('');
  // The client currently shown in the read-only View modal (row click) — separate from
  // any edit-modal state, since this is deliberately just a look, not the Edit form
  // (see modal-company, still reachable only from the kebab menu's Edit item).
  const [viewingClient, setViewingClient] = useState(null);

  const companiesArray = Array.isArray(companies) ? companies : [];
  const industries = useMemo(() => [...new Set(companiesArray.map(c => c.industry).filter(Boolean))].sort(), [companiesArray]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companiesArray.filter(c => {
      if (industry && c.industry !== industry) return false;
      if (q && !`${c.name} ${c.industry} ${c.primary_contact || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [companiesArray, industry, search]);

  const handleNewCompany = () => {
    resetFields('modal-company');
    startCreate('page-companies');
    // modal-company is shared with the Customers page, whose own heading stays
    // "Add Customer" — the records are the same, the two pages just name them
    // differently, so each sets the wording it wants on open.
    setModalMode('modal-company', { title: 'Add Client' });
    openModal('modal-company');
  };

  return (
    <div>
      <div className="page-header">
        <h2><Building2 size={22} /> Clients</h2>
        {canCreateOnPage('companies') && (
          <Button variant="primary" onClick={handleNewCompany}><Plus size={15} /> New Client</Button>
        )}
      </div>

      <div className="filter-bar">
        <Dropdown
          value={industry}
          onChange={setIndustry}
          options={[
            { value: '', label: 'All Industries' },
            ...industries.map(i => ({ value: i, label: i }))
          ]}
          placeholder="All Industries"
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
          pageId="page-companies"
          canEdit={can('Companies', 'edit')}
          canDelete={can('Companies', 'delete')}
          actionsAsKebab
          onRowClick={setViewingClient}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>

      {viewingClient && (
        <Modal title={viewingClient.name} onClose={() => setViewingClient(null)}>
          {/* Same .form-grid modal-company's own Edit form uses, so this reads as the
              read-only counterpart of that layout rather than a different pattern. No
              "Client Name" field — the modal title already shows it. */}
          <div className="form-grid">
            <ReadOnlyField label="Industry" value={viewingClient.industry} />
            <ReadOnlyField label="Primary Contact" value={viewingClient.primary_contact} />
            <ReadOnlyField label="Email" value={viewingClient.email} />
            <ReadOnlyField label="Phone" value={viewingClient.phone} />
            <ReadOnlyField label="GSTIN" value={viewingClient.gstin} />
            <ReadOnlyField label="Status" value={<Badge status={viewingClient.status} />} />
            <ReadOnlyField label="Billing Address" value={viewingClient.billing_address} wide />
            <ReadOnlyField label="Active Projects" value={viewingClient.active_projects} />
            <ReadOnlyField label="Lifetime Value" value={`₹${(viewingClient.lifetime_value || 0).toLocaleString('en-IN')}`} />
            <ReadOnlyField
              label="PR Manager"
              wide
              value={
                <span title={viewingClient.pm_missing_fields?.length ? `Needs: ${viewingClient.pm_missing_fields.join(', ')}` : undefined}>
                  <Badge status={viewingClient.pm_sync_status} />
                </span>
              }
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
