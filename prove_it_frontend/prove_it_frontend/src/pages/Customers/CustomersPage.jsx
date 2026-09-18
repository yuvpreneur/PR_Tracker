import { useState } from 'react';
import { Handshake, Plus } from 'lucide-react';
import useCustomers from './useCustomers.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import ReadOnlyField from '../../components/ui/ReadOnlyField.jsx';
import { openModal, startCreate, resetFields, setModalMode } from '../../bridge/shared/modals.js';
import usePermissions from '../../hooks/usePermissions.js';

const COLUMNS = [
  { key: 'name', header: 'Customer', render: r => <strong>{r.name}</strong> },
  { key: 'primary_contact', header: 'Contact', render: r => r.primary_contact || '—', align: 'center' },
  { key: 'email', header: 'Email', render: r => r.email || '—', align: 'center' },
  { key: 'phone', header: 'Phone', render: r => r.phone || '—', align: 'center' },
  { key: 'gstin', header: 'GSTIN', render: r => r.gstin || '—', align: 'center' },
  { key: 'active_projects', header: 'Active Projects', align: 'center' },
  { key: 'lifetime_value', header: 'Lifetime Value', render: r => `₹${r.lifetime_value.toLocaleString('en-IN')}`, align: 'center' },
];

export default function CustomersPage() {
  const { can, canCreateOnPage } = usePermissions();
  const { customers, loading } = useCustomers();
  // The customer currently shown in the read-only View modal (row click) — same pattern
  // (and, since Customers is a finance-facing view of the same Company records as
  // Clients, the exact same field set/order) as CompaniesPage.jsx's own View modal.
  const [viewingCustomer, setViewingCustomer] = useState(null);

  const handleNew = () => {
    resetFields('modal-company');
    startCreate('page-customers');
    setModalMode('modal-company', { title: 'Add Customer' });
    openModal('modal-company');
  };

  return (
    <div>
      <div className="page-header">
        <h2><Handshake size={22} /> Customers</h2>
        {canCreateOnPage('customers') && (
          <Button variant="primary" onClick={handleNew}><Plus size={15} /> New Customer</Button>
        )}
      </div>

      <div className="card table-wrap">
        <DataTable
          columns={COLUMNS}
          rows={customers}
          getRowId={r => r.id}
          pageId="page-customers"
          canEdit={can('Companies', 'edit')}
          canDelete={can('Companies', 'delete')}
          actionsAsKebab
          onRowClick={setViewingCustomer}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>

      {viewingCustomer && (
        <Modal title={viewingCustomer.name} onClose={() => setViewingCustomer(null)}>
          {/* Identical field set/order to CompaniesPage.jsx's own View modal — same
              Company records, same modal-company Edit form, just viewed from the
              finance-facing Customers page instead of Clients. */}
          <div className="form-grid">
            <ReadOnlyField label="Industry" value={viewingCustomer.industry} />
            <ReadOnlyField label="Primary Contact" value={viewingCustomer.primary_contact} />
            <ReadOnlyField label="Email" value={viewingCustomer.email} />
            <ReadOnlyField label="Phone" value={viewingCustomer.phone} />
            <ReadOnlyField label="GSTIN" value={viewingCustomer.gstin} />
            <ReadOnlyField label="Status" value={<Badge status={viewingCustomer.status} />} />
            <ReadOnlyField label="Billing Address" value={viewingCustomer.billing_address} wide />
            <ReadOnlyField label="Active Projects" value={viewingCustomer.active_projects} />
            <ReadOnlyField label="Lifetime Value" value={`₹${(viewingCustomer.lifetime_value || 0).toLocaleString('en-IN')}`} />
            <ReadOnlyField
              label="PR Manager"
              wide
              value={
                <span title={viewingCustomer.pm_missing_fields?.length ? `Needs: ${viewingCustomer.pm_missing_fields.join(', ')}` : undefined}>
                  <Badge status={viewingCustomer.pm_sync_status} />
                </span>
              }
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
