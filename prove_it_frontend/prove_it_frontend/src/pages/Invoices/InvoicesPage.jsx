import { useMemo, useState } from 'react';
import { FileText, Plus, Pencil, Trash2, IndianRupee, Wallet, Clock, AlertTriangle } from 'lucide-react';
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
import { MicroIcons } from '../../components/ui/MicroIcons.jsx';

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
    { key: 'client', header: 'Client', align: 'center' },
    { key: 'project_id', header: 'Project', render: r => projects.find(p => p.id === r.project_id)?.name || '—', align: 'center' },
    { key: 'total', header: 'Total', render: r => formatMoney(r.total, r.currency), align: 'center' },
    { key: 'issue_date', header: 'Issue Date', render: r => date(r.issue_date), align: 'center' },
    { key: 'due_date', header: 'Due Date', render: r => date(r.due_date), align: 'center' },
    { key: 'status', header: 'Status', render: r => <Badge status={r.display_status} />, align: 'center' },
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

  // Styled to match KebabMenu's own Edit/Delete items exactly (flat row, icon + label,
  // same hover) rather than the small bordered pills these used to be as standalone
  // buttons — they now land inside that same popover as `extra` (see DataTable). These
  // stay plain onClick handlers (not the bridge-edit/bridge-delete convention other
  // pages use) since Invoices already manages its own view/edit/delete via local state.
  const menuItemStyle = {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '7px 10px', border: 'none', background: 'transparent',
    cursor: 'pointer', fontSize: 12, fontWeight: 600, borderRadius: 6, textAlign: 'left',
  };
  const onMenuItemHover = e => (e.currentTarget.style.background = 'var(--soft)');
  const onMenuItemUnhover = e => (e.currentTarget.style.background = 'transparent');

  // No "View" item here anymore — the row itself is now the View trigger (onRowClick
  // below), same as every other page's kebab (Edit/Delete only, View lives on the row).
  // Keeping a View item too would just be the same action twice.
  const renderExtraActions = row => (
    <>
      {canEdit && row.status === 'draft' && (
        <button
          style={{ ...menuItemStyle, color: 'var(--ink)' }}
          onMouseEnter={onMenuItemHover} onMouseLeave={onMenuItemUnhover}
          onClick={() => handleEditDraft(row)} title="Edit"
        >
          <Pencil size={13} /> Edit
        </button>
      )}
      {canDelete && row.status === 'draft' && (
        <button
          style={{ ...menuItemStyle, color: '#C4574A' }}
          onMouseEnter={onMenuItemHover} onMouseLeave={onMenuItemUnhover}
          onClick={() => handleDelete(row)} title="Delete"
        >
          <Trash2 size={13} /> Delete
        </button>
      )}
    </>
  );

  if (view === 'new') {
    return (
      <div>
        <div className="page-header">
          <h2>
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
        <div className="page-header">
          <h2><FileText size={22} /> Invoice {selectedInvoice.invoice_no}</h2>
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
      <div className="page-header">
        <h2><FileText size={22} /> Invoices</h2>
        {canCreateOnPage('invoices') && (
          <Button variant="primary" onClick={handleNew}><Plus size={15} /> New Invoice</Button>
        )}
      </div>

      <div className="mb-5 grid grid-cols-4 gap-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        <StatCard label="Total Billed" value={loading || !summary ? '—' : formatMoney(summary.total_billed, 'INR')} sub="" color="var(--color-accent)" icon={IndianRupee} microIcon={MicroIcons.DocumentTick} />
        <StatCard label="Received" value={loading || !summary ? '—' : formatMoney(summary.total_received, 'INR')} sub="" color="var(--color-green)" icon={Wallet} microIcon={MicroIcons.GrowthChart} />
        <StatCard label="Outstanding" value={loading || !summary ? '—' : formatMoney(summary.outstanding, 'INR')} sub="" color="var(--color-amber)" icon={Clock} microIcon={MicroIcons.ClockCheck} />
        <StatCard label="Overdue" value={loading || !summary ? '—' : formatMoney(summary.overdue, 'INR')} sub="" color="var(--color-red)" icon={AlertTriangle} microIcon={MicroIcons.Target} />
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
          actionsAsKebab
          onRowClick={handleView}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>
    </div>
  );
}
