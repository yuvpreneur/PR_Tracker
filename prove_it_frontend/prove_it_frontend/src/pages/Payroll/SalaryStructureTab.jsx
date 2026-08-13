import { useMemo, useState } from 'react';
import { Plus, Loader2, Pencil, Trash2 } from 'lucide-react';
import useSalaryStructures from './useSalaryStructures.js';
import useEmployees from '../Employees/useEmployees.js';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { date, formatMoney } from '../../utils/format.js';
import { toast } from '../../utils/toast.js';
import usePermissions from '../../hooks/usePermissions.js';

const COMPONENT_FIELDS = [
  { key: 'basic', label: 'Basic' },
  { key: 'hra', label: 'HRA' },
  { key: 'cca', label: 'CCA' },
  { key: 'food_allowance', label: 'Food Allowance' },
  { key: 'transport_allowance', label: 'Transport Allowance' },
  { key: 'medical_allowance', label: 'Medical Allowance' },
  { key: 'monthly_bonus', label: 'Monthly Bonus' },
  { key: 'performance_incentive', label: 'Performance Incentive' },
  { key: 'arrears', label: 'Arrears' },
  { key: 'lta', label: 'LTA / LTC' },
];

function emptyForm(empId = '') {
  const form = { emp_id: empId, effective_from: new Date().toISOString().slice(0, 10), effective_to: '' };
  COMPONENT_FIELDS.forEach(f => { form[f.key] = '0'; });
  return form;
}

function StructureForm({ employees, initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial.id;

  const grossPreview = useMemo(
    () => COMPONENT_FIELDS.reduce((sum, f) => sum + (Number(form[f.key]) || 0), 0),
    [form],
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.emp_id) return toast('Select an employee', 'error');
    if (!form.effective_from) return toast('Effective from date is required', 'error');
    const payload = { effective_from: form.effective_from, effective_to: form.effective_to || null };
    COMPONENT_FIELDS.forEach(f => { payload[f.key] = Number(form[f.key]) || 0; });
    if (!isEdit) payload.emp_id = form.emp_id;

    setSaving(true);
    try {
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Employee</label>
          <select
            className="form-control" value={form.emp_id} disabled={isEdit}
            onChange={e => setForm(f => ({ ...f, emp_id: e.target.value }))}
          >
            <option value="">Select employee</option>
            {employees.map(e => <option key={e.emp_id} value={e.emp_id}>{e.name} ({e.emp_id})</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Effective From</label>
          <input type="date" className="form-control" value={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Effective To (blank = current)</label>
          <input type="date" className="form-control" value={form.effective_to} onChange={e => setForm(f => ({ ...f, effective_to: e.target.value }))} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {COMPONENT_FIELDS.map(f => (
          <div className="form-group" key={f.key}>
            <label className="form-label">{f.label}</label>
            <input
              type="number" step="any" className="form-control text-right"
              value={form[f.key]} onChange={e => setForm(fm => ({ ...fm, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t pt-3 text-[14px] font-bold">
        <span>Gross Salary</span>
        <span className="tabular-nums">{formatMoney(grossPreview)}</span>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 size={15} className="animate-spin" />} Save
        </Button>
      </div>
    </form>
  );
}

export default function SalaryStructureTab() {
  const { can } = usePermissions();
  const { structures, loading, createStructure, updateStructure, deleteStructure } = useSalaryStructures();
  const { employees } = useEmployees();
  const [modalRow, setModalRow] = useState(null); // null = closed, {} = new, row = edit
  const canEdit = can('Payroll', 'edit');
  const canDelete = can('Payroll', 'delete');

  const columns = useMemo(() => [
    { key: 'emp_id', header: 'Emp ID', render: r => <strong>{r.emp_id}</strong> },
    { key: 'name', header: 'Name' },
    { key: 'department', header: 'Department' },
    { key: 'basic', header: 'Basic', render: r => formatMoney(r.basic) },
    { key: 'gross_salary', header: 'Gross Salary', render: r => <strong>{formatMoney(r.gross_salary)}</strong> },
    { key: 'effective_from', header: 'Effective From', render: r => date(r.effective_from) },
    {
      key: 'effective_to', header: 'Effective To',
      render: r => r.effective_to ? date(r.effective_to) : <span style={{ color: '#16A36C', fontWeight: 600 }}>Current</span>,
    },
  ], []);

  const handleSave = async payload => {
    try {
      if (modalRow?.id) await updateStructure(modalRow.id, payload);
      else await createStructure(payload);
      toast('Salary structure saved');
      setModalRow(null);
    } catch { /* httpClient already toasted */ }
  };

  const handleDelete = async row => {
    if (!window.confirm(`Delete this salary structure row for ${row.name}?`)) return;
    try { await deleteStructure(row.id); toast('Deleted'); } catch { /* toasted */ }
  };

  const renderExtraActions = row => (
    <>
      {canEdit && (
        <button className="mr-1 inline-flex items-center rounded-md px-2.5 py-1 text-[11px]" onClick={() => setModalRow(row)} title="Edit">
          <Pencil size={13} />
        </button>
      )}
      {canDelete && (
        <button className="inline-flex items-center rounded-md px-2.5 py-1 text-[11px] text-red" onClick={() => handleDelete(row)} title="Delete">
          <Trash2 size={13} />
        </button>
      )}
    </>
  );

  return (
    <div>
      <div className="section-header">
        <h3 className="text-[14px] font-bold">Salary Structure</h3>
        {canEdit && <Button variant="primary" onClick={() => setModalRow({})}><Plus size={15} /> New Structure</Button>}
      </div>

      <div className="card table-wrap">
        <DataTable
          columns={columns}
          rows={structures}
          getRowId={r => r.id}
          canEdit={false}
          canDelete={false}
          renderExtraActions={renderExtraActions}
          hideActionsColumn={!canEdit && !canDelete}
          emptyMessage={loading ? 'Loading…' : 'No salary structures yet'}
        />
      </div>

      {modalRow && (
        <Modal title={modalRow.id ? 'Edit Salary Structure' : 'New Salary Structure'} onClose={() => setModalRow(null)} width={640}>
          <StructureForm
            employees={employees}
            initial={modalRow.id ? { ...modalRow, effective_to: modalRow.effective_to || '' } : emptyForm()}
            onSave={handleSave}
            onCancel={() => setModalRow(null)}
          />
        </Modal>
      )}
    </div>
  );
}
