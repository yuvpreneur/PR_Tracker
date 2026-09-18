import { useMemo, useState } from 'react';
import { CreditCard, Plus, Search } from 'lucide-react';
import useBillingCodes from './useBillingCodes.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Dropdown from '../../components/ui/Dropdown.jsx';
import Modal from '../../components/ui/Modal.jsx';
import ReadOnlyField from '../../components/ui/ReadOnlyField.jsx';
import { date, num } from '../../utils/format.js';
import { openModal, startCreate, resetFields } from '../../bridge/shared/modals.js';
import { populateBCodeProjectCodeDropdown } from '../../bridge/pages/billing.js';
import usePermissions from '../../hooks/usePermissions.js';

export default function BillingCodesPage() {
  const { can, canCreateOnPage } = usePermissions();
  const { bcodes, projects, loading } = useBillingCodes();
  const [projectId, setProjectId] = useState('');
  const [billingType, setBillingType] = useState('');
  const [search, setSearch] = useState('');
  // The billing code currently shown in the read-only View modal (row click) — same
  // pattern as Clients/Projects/Project Codes: a separate look-only surface, not the
  // Edit form (modal-bcode, still reachable only from the kebab menu's Edit item).
  const [viewingBCode, setViewingBCode] = useState(null);

  const projectsArray = Array.isArray(projects) ? projects : [];
  const bcodesArray = Array.isArray(bcodes) ? bcodes : [];
  const projectName = id => projectsArray.find(p => p.id === id)?.name;

  const columns = useMemo(() => [
    { key: 'code', header: 'Billing Code', render: r => <strong>{r.code}</strong> },
    { key: 'project_code_id', header: 'Project Code', align: 'center' },
    { key: 'project_id', header: 'Project', align: 'center', render: r => projectName(r.project_id) || r.project_id },
    { key: 'client', header: 'Client', align: 'center', render: r => r.client || '—' },
    { key: 'billing_type', header: 'Type', align: 'center', render: r => <Badge status={r.billing_type} /> },
    { key: 'rate', header: 'Rate', align: 'center', render: r => `₹${num(r.rate)}${r.billing_type === 'T&M' ? '/hr' : ''}` },
    { key: 'status', header: 'Status', align: 'center', render: r => <Badge status={r.status} /> },
    { key: 'effective_from', header: 'Eff. From', align: 'center', render: r => date(r.effective_from) },
    { key: 'effective_to', header: 'Eff. To', align: 'center', render: r => date(r.effective_to) },
  ], [projectsArray]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bcodesArray.filter(b => {
      if (projectId && b.project_id !== projectId) return false;
      if (billingType && b.billing_type !== billingType) return false;
      if (q && !`${b.code} ${b.project_code_id} ${projectName(b.project_id) || ''} ${b.client || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [bcodesArray, projectsArray, projectId, billingType, search]);

  const handleNew = () => {
    resetFields('modal-bcode');
    startCreate('page-billing-codes');
    // Drops the project code left selectable by the last Edit, and picks up any project
    // code claimed since this page loaded, so Create never offers a taken one.
    populateBCodeProjectCodeDropdown();
    openModal('modal-bcode');
  };

  return (
    <div>
      <div className="page-header">
        <h2><CreditCard size={22} /> Billing Codes</h2>
        {canCreateOnPage('billing-codes') && (
          <Button variant="primary" onClick={handleNew}><Plus size={15} /> New Billing Code</Button>
        )}
      </div>

      <div className="filter-bar">
        <Dropdown
          value={projectId}
          onChange={setProjectId}
          options={[
            { value: '', label: 'All Projects' },
            ...projects.map(p => ({ value: p.id, label: `${p.id} · ${p.name}` }))
          ]}
          placeholder="All Projects"
          style={{ width: '200px' }}
        />
        <Dropdown
          value={billingType}
          onChange={setBillingType}
          options={[
            { value: '', label: 'All Types' },
            { value: 'T&M', label: 'T&M' },
            { value: 'Fixed', label: 'Fixed' },
            { value: 'Milestone', label: 'Milestone' }
          ]}
          placeholder="All Types"
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
          columns={columns}
          rows={filtered}
          getRowId={r => r.code}
          pageId="page-billing-codes"
          canEdit={can('Billing Codes', 'edit')}
          canDelete={can('Billing Codes', 'delete')}
          actionsAsKebab
          onRowClick={setViewingBCode}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>

      {viewingBCode && (
        <Modal title={viewingBCode.code} onClose={() => setViewingBCode(null)}>
          {/* Mirrors modal-bcode's own field order (global.css's .form-grid, no
              col-span-2 there either) — Project Code, Billing Type, Rate, Effective
              From/To, Status — minus Billing Code (already the modal title), plus
              Project/Client appended the same way other View modals append fields
              the Edit form doesn't ask for directly (they're derived from Project
              Code server-side, not independently editable — see billing_codes.py). */}
          <div className="form-grid">
            <ReadOnlyField label="Project Code" value={viewingBCode.project_code_id} />
            <ReadOnlyField label="Billing Type" value={<Badge status={viewingBCode.billing_type} />} />
            <ReadOnlyField label="Rate (₹)" value={`₹${num(viewingBCode.rate)}${viewingBCode.billing_type === 'T&M' ? '/hr' : ''}`} />
            <ReadOnlyField label="Effective From" value={date(viewingBCode.effective_from)} />
            <ReadOnlyField label="Effective To" value={date(viewingBCode.effective_to)} />
            <ReadOnlyField label="Status" value={<Badge status={viewingBCode.status} />} />
            <ReadOnlyField label="Project" value={projectName(viewingBCode.project_id) || viewingBCode.project_id} />
            <ReadOnlyField label="Client" value={viewingBCode.client} />
          </div>
        </Modal>
      )}
    </div>
  );
}
