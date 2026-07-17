import useCustomers from './useCustomers.js';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { can, canCreateOnPage } from '../../bridge/shared/permissions.js';
import { openModal, startCreate } from '../../bridge/shared/modals.js';

const COLUMNS = [
  { key: 'name', header: 'Customer', render: r => <strong>{r.name}</strong> },
  { key: 'primary_contact', header: 'Contact', render: r => r.primary_contact || '—' },
  { key: 'email', header: 'Email', render: r => r.email || '—' },
  { key: 'active_projects', header: 'Active Projects' },
  { key: 'lifetime_value', header: 'Lifetime Value', render: r => `₹${r.lifetime_value.toLocaleString('en-IN')}` },
];

export default function CustomersPage() {
  const { customers, loading } = useCustomers();

  const handleNew = () => {
    startCreate('page-customers');
    openModal('modal-company');
  };

  return (
    <div>
      <div className="section-header">
        <h2>Customers</h2>
        {canCreateOnPage('customers') && (
          <Button variant="primary" onClick={handleNew}>+ New Customer</Button>
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
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>
    </div>
  );
}
