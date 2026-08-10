import { useMemo, useState } from 'react';
import { FileText, Plus, Eye, Pencil, Trash2, IndianRupee, Wallet, Clock, AlertTriangle } from 'lucide-react';
import useInvoices from './useInvoices.js';
import InvoiceEditor from './InvoiceEditor.jsx';
import InvoiceDetail from './InvoiceDetail.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import { date, formatMoney } from '../../utils/format.js';
import { toast } from '../../utils/toast.js';
import usePermissions from '../../hooks/usePermissions.js';

export default function InvoicesPage() {
  const { can, canCreateOnPage } = usePermissions();
  const {
    invoices, companies, projects, summary, loading,
    createInvoice, updateInvoice, sendInvoice, recordPayment, voidInvoice, deleteInvoice,
  } = useInvoices();

  const [view, setView] = useState('list'); // 'list' | 'new' | 'detail'
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editingDraft, setEditingDraft] = useState(null);

  const canEdit = can('Invoices', 'edit');
  const canDelete = can('Invoices', 'delete');

  const columns = useMemo(() => [
    { key: 'invoice_no', header: 'Invoice #' },
    { key: 'client', header: 'Client' },
    { key: 'project_id', header: 'Project', render: r => projects.find(p => p.id === r.project_id)?.name || '—' },
    { key: 'total', header: 'Total', render: r => formatMoney(r.total, r.currency) },
    { key: 'issue_date', header: 'Issue Date', render: r => date(r.issue_date) },
    { key: 'due_date', header: 'Due Date', render: r => date(r.due_date) },
    { key: 'status', header: 'Status', render: r => <Badge status={r.display_status} /> },
  ], [projects]);

  const handleNew = () => { setEditingDraft(null); setView('new'); };
  const handleEditDraft = row => { setEditingDraft(row); setView('new'); };
  const handleView = row => { setSelectedInvoice(row); setView('detail'); };

  const handleDelete = async row => {
    if (!window.confirm(`Delete draft invoice ${row.invoice_no}?`)) return;
    try { await deleteInvoice(row.id); toast('Invoice deleted'); }
    catch { /* httpClient already toasted */ }
  };

  // Wrapped so the open detail view reflects the result immediately, instead of
  // waiting on useInvoices()'s background list refresh to catch up.
  const handleSend = async id => { const updated = await sendInvoice(id); setSelectedInvoice(updated); return updated; };
  const handleRecordPayment = async (id, amount) => { const updated = await recordPayment(id, amount); setSelectedInvoice(updated); return updated; };
  const handleVoid = async id => { const updated = await voidInvoice(id); setSelectedInvoice(updated); return updated; };

  const renderExtraActions = row => (
    <>
      <button className="mr-1 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px]" onClick={() => handleView(row)} title="View">
        <Eye size={13} /> View
      </button>
      {canEdit && row.status === 'draft' && (
        <button className="mr-1 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px]" onClick={() => handleEditDraft(row)} title="Edit">
          <Pencil size={13} /> Edit
        </button>
      )}
      {canDelete && row.status === 'draft' && (
        <button className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] text-red" onClick={() => handleDelete(row)} title="Delete">
          <Trash2 size={13} /> Delete
        </button>
      )}
    </>
  );

  if (view === 'new') {
    return (
      <div>
        <div className="section-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={22} /> {editingDraft ? 'Edit Invoice' : 'New Invoice'}
          </h2>
        </div>
        <InvoiceEditor
          companies={companies}
          projects={projects}
          invoices={invoices}
          initialData={editingDraft}
          createInvoice={createInvoice}
          updateInvoice={updateInvoice}
          onDone={saved => { setSelectedInvoice(saved); setView('detail'); }}
          onCancel={() => setView('list')}
        />
      </div>
    );
  }

  if (view === 'detail' && selectedInvoice) {
    return (
      <div>
        <div className="section-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><FileText size={22} /> Invoice {selectedInvoice.invoice_no}</h2>
        </div>
        <InvoiceDetail
          invoice={selectedInvoice}
          projects={projects}
          canEdit={canEdit}
          sendInvoice={handleSend}
          recordPayment={handleRecordPayment}
          voidInvoice={handleVoid}
          onBack={() => setView('list')}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><FileText size={22} /> Invoices</h2>
        {canCreateOnPage('invoices') && (
          <Button variant="primary" onClick={handleNew}><Plus size={15} /> New Invoice</Button>
        )}
      </div>

      <div className="mb-5 grid grid-cols-4 gap-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        <StatCard label="Total Billed" value={loading || !summary ? '—' : formatMoney(summary.total_billed, 'INR')} sub="" color="var(--color-accent)" icon={IndianRupee} />
        <StatCard label="Received" value={loading || !summary ? '—' : formatMoney(summary.total_received, 'INR')} sub="" color="var(--color-green)" icon={Wallet} />
        <StatCard label="Outstanding" value={loading || !summary ? '—' : formatMoney(summary.outstanding, 'INR')} sub="" color="var(--color-amber)" icon={Clock} />
        <StatCard label="Overdue" value={loading || !summary ? '—' : formatMoney(summary.overdue, 'INR')} sub="" color="var(--color-red)" icon={AlertTriangle} />
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
