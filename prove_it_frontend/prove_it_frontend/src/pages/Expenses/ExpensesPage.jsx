import { useMemo, useRef, useState } from 'react';
import { Wallet, Plus, Search, Upload, Paperclip, Check, X } from 'lucide-react';
import useExpenses from './useExpenses.js';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Dropdown from '../../components/ui/Dropdown.jsx';
import Modal from '../../components/ui/Modal.jsx';
import ReadOnlyField from '../../components/ui/ReadOnlyField.jsx';
import { date } from '../../utils/format.js';
import { viewAttachment, uploadFile } from '../../services/httpClient.js';
import usePermissions from '../../hooks/usePermissions.js';
import { openModal, startCreate, resetFields, set, setPendingReceipt } from '../../bridge/shared/modals.js';
import { extractReceiptFields } from './receiptOcr.js';

const CATEGORIES = ['Travel', 'Software', 'Vendor', 'Material', 'Misc'];

export default function ExpensesPage() {
  const { can, canCreateOnPage, isMine, role, noActionsColumn } = usePermissions();
  const { expenses, projects, loading } = useExpenses();
  const [projectId, setProjectId] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [extracting, setExtracting] = useState(false);
  const uploadInputRef = useRef(null);
  // The expense currently shown in the read-only View modal (row click) — same pattern
  // as every other page: a separate look-only surface, not the Edit form (modal-expense,
  // still reachable only from the kebab menu's Edit item).
  const [viewingExpense, setViewingExpense] = useState(null);

  const projectsArray = Array.isArray(projects) ? projects : [];
  const projectName = id => projectsArray.find(p => p.id === id)?.name;

  const columns = useMemo(() => [
    { key: 'project_id', header: 'Project', render: r => projectName(r.project_id) || r.project_id },
    { key: 'project_code_id', header: 'Project Code', render: r => r.project_code_id || '—', align: 'center' },
    { key: 'billing_code_id', header: 'Billing Code', render: r => r.billing_code_id || '—', align: 'center' },
    { key: 'category', header: 'Category', render: r => <Badge status={r.category} />, align: 'center' },
    { key: 'expense_date', header: 'Date', render: r => date(r.expense_date), align: 'center' },
    { key: 'amount', header: 'Amount', render: r => `₹${r.amount.toLocaleString('en-IN')}`, align: 'center' },
    { key: 'vendor', header: 'Vendor', render: r => r.vendor || '—', align: 'center' },
    {
      key: 'receipt_url',
      header: 'Receipt',
      render: r => (r.receipt_url ? (
        <button type="button" className="text-[12px] underline" onClick={() => viewAttachment(r.receipt_url)}><Paperclip size={13} /> View</button>
      ) : '—'),
      align: 'center',
    },
    { key: 'status', header: 'Status', render: r => <Badge status={r.status} />, align: 'center' },
    {
      key: 'reject_reason',
      header: 'Reason',
      // Rejected rows show the approver's rejection reason (more relevant at that point than
      // why it was submitted); every other status falls back to the submitter's own
      // description of the expense.
      render: r => (r.status === 'Rejected' ? (r.reject_reason || '—') : (r.description || '—')),
      align: 'center',
    },
  ], [projectsArray]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (Array.isArray(expenses) ? expenses : []).filter(e => {
      if (projectId && e.project_id !== projectId) return false;
      if (category && e.category !== category) return false;
      if (status && e.status !== status) return false;
      if (q && !`${projectName(e.project_id) || ''} ${e.vendor || ''} ${e.project_code_id || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [expenses, projects, projectId, category, status, search]);

  const handleNew = () => {
    resetFields('modal-expense');
    startCreate('page-expenses');
    openModal('modal-expense');
  };

  const handleUploadClick = () => uploadInputRef.current?.click();

  const handleFileSelected = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setExtracting(true);
    try {
      // OCR runs entirely client-side (tesseract.js/WASM) so it can go in parallel with
      // the attachment upload — neither depends on the other's result.
      const [fields, uploaded] = await Promise.all([
        extractReceiptFields(file),
        uploadFile('/api/expenses/attachments', file),
      ]);
      if (!uploaded) return;
      resetFields('modal-expense');
      startCreate('page-expenses');
      if (fields.category) set('modal-expense', 'expense category', fields.category);
      if (fields.expense_date) set('modal-expense', 'expense date', fields.expense_date);
      if (fields.amount != null) set('modal-expense', 'amount', fields.amount);
      if (fields.vendor) set('modal-expense', 'vendor name', fields.vendor);
      if (fields.description) set('modal-expense', 'description', fields.description);
      setPendingReceipt('modal-expense', uploaded.receipt_url, uploaded.filename);
      openModal('modal-expense');
    } catch {
      // toast already shown by uploadFile on failure
    } finally {
      setExtracting(false);
    }
  };

  // Expenses is self-service again — the submitter can edit their own Pending entry,
  // matching expenses.py's update() (no self-service delete, even for your own pending
  // entry — that stays permission-gated, same as the backend).
  const canEditRow = row => can('Expenses', 'edit') || (isMine(row, 'submitted_by') && row.status === 'Pending');
  const canDeleteRow = () => can('Expenses', 'delete');

  // Two-stage chain (expenses.py): Manager confirms business purpose (Pending -> Pending
  // Finance), then Finance validates policy and posts payment (Pending Finance ->
  // Approved). The blanket Expenses:approve permission can't distinguish the two stages,
  // so this checks the row's own status against the viewer's role directly, same as the
  // backend does.
  const canActOnStage = row => {
    if (role === 'Admin') return true;
    if (row.status === 'Pending') return role === 'Manager';
    if (row.status === 'Pending Finance') return role === 'Finance User';
    return false;
  };

  // Styled to match KebabMenu's own Edit item exactly (flat row, icon + label, same
  // hover) rather than the small bordered pills these used to be as standalone buttons
  // next to it — they now land inside that same popover as `extra` (see DataTable).
  const menuItemStyle = {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '7px 10px', border: 'none', background: 'transparent',
    cursor: 'pointer', fontSize: 12, fontWeight: 600, borderRadius: 6, textAlign: 'left',
  };
  const onMenuItemHover = e => (e.currentTarget.style.background = 'var(--soft)');
  const onMenuItemUnhover = e => (e.currentTarget.style.background = 'transparent');

  const renderExtraActions = row => {
    if (row.status !== 'Pending' && row.status !== 'Pending Finance') return null;
    if (isMine(row, 'submitted_by') || !canActOnStage(row)) return null;
    return (
      <>
        <button
          className="bridge-approve" data-page="page-expenses" data-id={row.id} title="Approve"
          style={{ ...menuItemStyle, color: '#16A36C' }}
          onMouseEnter={onMenuItemHover} onMouseLeave={onMenuItemUnhover}
        >
          <Check size={13} /> Approve
        </button>
        <button
          className="bridge-reject" data-page="page-expenses" data-id={row.id} title="Reject"
          style={{ ...menuItemStyle, color: '#C4574A' }}
          onMouseEnter={onMenuItemHover} onMouseLeave={onMenuItemUnhover}
        >
          <X size={13} /> Reject
        </button>
      </>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h2><Wallet size={22} /> Expenses</h2>
        {canCreateOnPage('expenses') && (
          <div className="flex items-end gap-2">
            <button type="button" className="btn btn-ghost" style={{ color: 'var(--rose)', borderColor: 'var(--rose)' }} onClick={handleUploadClick} disabled={extracting}>
              {extracting ? 'Analyzing…' : (<><Upload size={14} /> Upload File</>)}
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={handleFileSelected}
            />
            <Button variant="primary" onClick={handleNew}><Plus size={15} /> Add Expense</Button>
          </div>
        )}
      </div>

      <div className="filter-bar">
        <Dropdown
          value={projectId}
          onChange={setProjectId}
          options={[
            { value: '', label: 'All Projects' },
            ...(Array.isArray(projects) ? projects : []).map(p => ({ value: p.id, label: `${p.id} — ${p.name}` }))
          ]}
          placeholder="All Projects"
          style={{ width: '200px' }}
        />
        <Dropdown
          value={category}
          onChange={setCategory}
          options={[
            { value: '', label: 'All Categories' },
            ...CATEGORIES.map(c => ({ value: c, label: c }))
          ]}
          placeholder="All Categories"
          style={{ width: '160px' }}
        />
        <Dropdown
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'All Status' },
            { value: 'Pending', label: 'Pending' },
            { value: 'Pending Finance', label: 'Pending Finance' },
            { value: 'Approved', label: 'Approved' },
            { value: 'Rejected', label: 'Rejected' }
          ]}
          placeholder="All Status"
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
          getRowId={r => r.id}
          pageId="page-expenses"
          canEdit={canEditRow}
          canDelete={canDeleteRow}
          renderExtraActions={renderExtraActions}
          hideActionsColumn={noActionsColumn('expenses')}
          actionsAsKebab
          onRowClick={setViewingExpense}
          emptyMessage={loading ? 'Loading…' : 'No records found'}
        />
      </div>

      {viewingExpense && (
        <Modal
          title={`${viewingExpense.submitted_by} — ${date(viewingExpense.expense_date)}`}
          onClose={() => setViewingExpense(null)}
        >
          {/* Mirrors modal-expense's own field order (global.css's .form-grid) —
              Project, Project Code, Billing Code, Category, Amount, Vendor, then
              Description and the Receipt attachment full-width — minus Expense Date
              (already the modal title alongside who submitted it). project_id is
              resolved to a name like the table does; project_code_id/billing_code_id
              stay raw, also matching the table. Appends Status/Submitted By/Manager
              Approved By/Approved By/Reject Reason as separate fields, rather than the
              table's single combined "Reason" column that swaps between description
              and reject_reason depending on status — a detail view has room to show
              both plainly instead of picking one. */}
          <div className="form-grid">
            <ReadOnlyField label="Project" value={projectName(viewingExpense.project_id) || viewingExpense.project_id} />
            <ReadOnlyField label="Project Code" value={viewingExpense.project_code_id} />
            <ReadOnlyField label="Billing Code" value={viewingExpense.billing_code_id} />
            <ReadOnlyField label="Category" value={<Badge status={viewingExpense.category} />} />
            <ReadOnlyField label="Amount (₹)" value={`₹${viewingExpense.amount.toLocaleString('en-IN')}`} />
            <ReadOnlyField label="Vendor" value={viewingExpense.vendor} />
            <ReadOnlyField label="Description" value={viewingExpense.description} wide />
            <ReadOnlyField
              label="Receipt"
              wide
              value={viewingExpense.receipt_url ? (
                <button type="button" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', fontSize: 14 }} onClick={() => viewAttachment(viewingExpense.receipt_url)}>
                  <Paperclip size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />View
                </button>
              ) : null}
            />
            <ReadOnlyField label="Status" value={<Badge status={viewingExpense.status} />} />
            <ReadOnlyField label="Submitted By" value={viewingExpense.submitted_by} />
            <ReadOnlyField label="Manager Approved By" value={viewingExpense.manager_approved_by} />
            <ReadOnlyField label="Approved By" value={viewingExpense.approved_by} />
            <ReadOnlyField label="Reject Reason" value={viewingExpense.status === 'Rejected' ? viewingExpense.reject_reason : null} wide />
          </div>
        </Modal>
      )}
    </div>
  );
}
