import { useMemo } from 'react';
import useInvoices from './useInvoices.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { date } from '../../bridge/shared/ui.js';
import { can, canCreateOnPage } from '../../bridge/shared/permissions.js';
import { openModal, startCreate } from '../../bridge/shared/modals.js';

export default function InvoicesPage() {
  const { invoices, projects, loading } = useInvoices();

  const columns = useMemo(() => [
    { key: 'invoice_no', header: 'Invoice #' },
    { key: 'client', header: 'Client' },
    { key: 'project_id', header: 'Project', render: r => projects.find(p => p.id === r.project_id)?.name || r.project_id },
    { key: 'invoice_amount', header: 'Amount', render: r => `₹${r.invoice_amount.toLocaleString('en-IN')}` },
    { key: 'invoice_date', header: 'Date', render: r => date(r.invoice_date) },
    { key: 'status', header: 'Status', render: r => <Badge status={r.status} /> },
  ], [projects]);

  const handleNew = () => {
    startCreate('page-invoices');
    openModal('modal-recv');
  };

  // View is always available; Edit (shares modal-recv with Receivables) is gated
  // by Receivables' own edit permission — mirrors the legacy invoiceActionBtns()
  // exactly, so DataTable's own canEdit/canDelete slots stay unused here.
  const renderExtraActions = row => (
    <>
      <button className="bridge-view mr-1 rounded-md px-2.5 py-0.5 text-[11px]" data-page="page-invoices" data-id={row.id} title="View">View</button>
      {can('Receivables', 'edit') && (
        <button className="bridge-edit rounded-md px-2.5 py-0.5 text-[11px]" data-page="page-invoices" data-id={row.id} title="Edit">Edit</button>
      )}
    </>
  );

  return (
    <div>
      <div className="section-header">
        <h2>Invoices</h2>
        {canCreateOnPage('invoices') && (
          <Button variant="primary" onClick={handleNew}>+ New Invoice</Button>
        )}
      </div>

      <div className="card table-wrap">
        <DataTable
          columns={columns}
          rows={invoices}
          getRowId={r => r.id}
          pageId="page-invoices"
          canEdit={false}
          canDelete={false}
          renderExtraActions={renderExtraActions}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>
    </div>
  );
}
