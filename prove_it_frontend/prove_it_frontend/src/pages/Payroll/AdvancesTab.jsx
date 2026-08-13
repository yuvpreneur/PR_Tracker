import { useMemo, useState } from 'react';
import { Plus, Loader2, XCircle } from 'lucide-react';
import useAdvances from './useAdvances.js';
import useEmployees from '../Employees/useEmployees.js';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { date, formatMoney } from '../../utils/format.js';
import { toast } from '../../utils/toast.js';
import usePermissions from '../../hooks/usePermissions.js';

function AdvanceForm({ employees, onSave, onCancel }) {
  const [form, setForm] = useState({ emp_id: '', amount: '', date_issued: new Date().toISOString().slice(0, 10), monthly_recovery: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.emp_id) return toast('Select an employee', 'error');
    if (!Number(form.amount) || Number(form.amount) <= 0) return toast('Amount must be greater than 0', 'error');
    if (!Number(form.monthly_recovery) || Number(form.monthly_recovery) <= 0) return toast('Monthly recovery must be greater than 0', 'error');
    setSaving(true);
    try {
      await onSave({
        emp_id: form.emp_id, date_issued: form.date_issued,
        amount: Number(form.amount), monthly_recovery: Number(form.monthly_recovery),
      });
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="form-group">
        <label className="form-label">Employee</label>
        <select className="form-control" value={form.emp_id} onChange={e => setForm(f => ({ ...f, emp_id: e.target.value }))}>
          <option value="">Select employee</option>
          {employees.map(e => <option key={e.emp_id} value={e.emp_id}>{e.name} ({e.emp_id})</option>)}
        </select>
      </div>
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Amount</label>
          <input type="number" step="any" className="form-control text-right" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Date Issued</label>
          <input type="date" className="form-control" value={form.date_issued} onChange={e => setForm(f => ({ ...f, date_issued: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Monthly Recovery</label>
          <input type="number" step="any" className="form-control text-right" value={form.monthly_recovery} onChange={e => setForm(f => ({ ...f, monthly_recovery: e.target.value }))} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving && <Loader2 size={15} className="animate-spin" />} Issue Advance</Button>
      </div>
    </form>
  );
}

export default function AdvancesTab() {
  const { can } = usePermissions();
  const { advances, loading, createAdvance, closeAdvance, deleteAdvance } = useAdvances();
  const { employees } = useEmployees();
  const [modalOpen, setModalOpen] = useState(false);
  const canEdit = can('Payroll', 'edit');
  const canCreate = can('Payroll', 'create');
  const canDelete = can('Payroll', 'delete');

  const columns = useMemo(() => [
    { key: 'emp_id', header: 'Emp ID', render: r => <strong>{r.emp_id}</strong> },
    { key: 'name', header: 'Name' },
    { key: 'amount', header: 'Amount', render: r => formatMoney(r.amount) },
    { key: 'monthly_recovery', header: 'Monthly Recovery', render: r => formatMoney(r.monthly_recovery) },
    { key: 'balance_remaining', header: 'Balance Remaining', render: r => <strong>{formatMoney(r.balance_remaining)}</strong> },
    { key: 'date_issued', header: 'Date Issued', render: r => date(r.date_issued) },
    { key: 'status', header: 'Status', render: r => <Badge status={r.status} /> },
  ], []);

  const handleClose = async row => {
    if (!window.confirm(`Close this advance for ${row.name}? The remaining balance will no longer be recovered.`)) return;
    try { await closeAdvance(row.id); toast('Advance closed'); } catch { /* toasted */ }
  };

  const handleDelete = async row => {
    if (!window.confirm(`Delete this advance for ${row.name}?`)) return;
    try { await deleteAdvance(row.id); toast('Deleted'); } catch { /* toasted */ }
  };

  const renderExtraActions = row => (
    <>
      {canEdit && row.status === 'Active' && (
        <button className="mr-1 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px]" onClick={() => handleClose(row)} title="Close">
          <XCircle size={13} /> Close
        </button>
      )}
      {canDelete && row.balance_remaining === row.amount && (
        <button className="inline-flex items-center rounded-md px-2.5 py-1 text-[11px] text-red" onClick={() => handleDelete(row)} title="Delete">
          Delete
        </button>
      )}
    </>
  );

  return (
    <div>
      <div className="section-header">
        <h3 className="text-[14px] font-bold">Advances</h3>
        {canCreate && <Button variant="primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Issue Advance</Button>}
      </div>

      <div className="card table-wrap">
        <DataTable
          columns={columns}
          rows={advances}
          getRowId={r => r.id}
          canEdit={false}
          canDelete={false}
          renderExtraActions={renderExtraActions}
          hideActionsColumn={!canEdit && !canDelete}
          emptyMessage={loading ? 'Loading…' : 'No advances issued yet'}
        />
      </div>

      {modalOpen && (
        <Modal title="Issue Advance" onClose={() => setModalOpen(false)}>
          <AdvanceForm
            employees={employees}
            onSave={async payload => { try { await createAdvance(payload); toast('Advance issued'); setModalOpen(false); } catch { /* toasted */ } }}
            onCancel={() => setModalOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}
