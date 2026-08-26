import { useMemo, useState } from 'react';
import { Pencil, Loader2, Search } from 'lucide-react';
import useEmployeeFieldGroup from './useEmployeeFieldGroup.js';
import Modal from '../../components/ui/Modal.jsx';
import Button from '../../components/ui/Button.jsx';
import { toast } from '../../utils/toast.js';
import usePermissions from '../../hooks/usePermissions.js';

function FieldGroupForm({ employee, fields, readOnlyKeys, onSave, onCancel }) {
  const readOnlyFields = fields.filter(f => readOnlyKeys.includes(f.key));
  const editableFields = fields.filter(f => !readOnlyKeys.includes(f.key));
  const [form, setForm] = useState(() => Object.fromEntries(editableFields.map(f => [f.key, employee[f.key] || ''])));
  const [saving, setSaving] = useState(false);

  const setField = (key, value) => setForm(f => ({ ...f, [key]: value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {readOnlyFields.length > 0 && (
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
          {readOnlyFields.map(f => (
            <div key={f.key}>
              <div className="text-[11px] font-black uppercase tracking-wide text-muted">{f.label}</div>
              <div className="text-[13px]">{employee[f.key] || '—'}</div>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {editableFields.map(f => (
          <div className="form-group" key={f.key}>
            <label className="form-label">{f.label}</label>
            <input className="form-control" value={form[f.key]} onChange={e => setField(f.key, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving && <Loader2 size={15} className="animate-spin" />} Save</Button>
      </div>
    </form>
  );
}

// Generic "list employees with a field group, edit one via modal" tab — shared by Bank &
// Statutory / Job Details / Employee Details, which differ only in API path, field list,
// and which of those fields (if any) are read-only here because the Employees page
// already owns them.
export default function EmployeeFieldGroupTab({ basePath, fields, previewKeys, readOnlyKeys = [], modalTitlePrefix }) {
  const { can } = usePermissions();
  const canEdit = can('Payroll', 'edit');
  const { employees, loading, updateFields } = useEmployeeFieldGroup(basePath);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);

  const previewFields = useMemo(() => fields.filter(f => previewKeys.includes(f.key)), [fields, previewKeys]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(e => `${e.emp_id} ${e.name}`.toLowerCase().includes(q));
  }, [employees, search]);

  const handleSave = async form => {
    try {
      await updateFields(editing.emp_id, form);
      toast('Details saved');
      setEditing(null);
    } catch { /* toasted */ }
  };

  return (
    <div>
      <div className="filter-bar">
        <div className="relative" style={{ flex: 1, minWidth: 180 }}>
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="form-control"
            style={{ width: '100%', paddingLeft: 32 }}
            placeholder="Search employees…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card table-wrap overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              {['Code', 'Name', ...previewFields.map(f => f.label), ''].map((h, i) => (
                <th key={i} className="px-3.5 py-3 text-[11px] font-black uppercase tracking-wide" style={{ textAlign: i === 0 ? 'left' : 'center', color: '#000000' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={previewFields.length + 3} className="p-8 text-center text-[13px] text-slate-400">
                  {loading ? 'Loading…' : 'No employees found'}
                </td>
              </tr>
            )}
            {filtered.map(e => (
              <tr key={e.emp_id} className="border-b border-slate-100">
                <td className="px-3 py-2.5"><strong>{e.emp_id}</strong></td>
                <td className="px-3 py-2.5" style={{ textAlign: 'center' }}>{e.name}</td>
                {previewFields.map(f => <td key={f.key} className="px-3 py-2.5" style={{ textAlign: 'center' }}>{e[f.key] || '—'}</td>)}
                <td className="whitespace-nowrap px-3 py-2" style={{ textAlign: 'center' }}>
                  {canEdit && (
                    <button
                      className="inline-flex items-center rounded-md px-2.5 py-1 text-[11px]"
                      onClick={() => setEditing(e)}
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={`${modalTitlePrefix} — ${editing.name}`} onClose={() => setEditing(null)} width={640}>
          <FieldGroupForm employee={editing} fields={fields} readOnlyKeys={readOnlyKeys} onSave={handleSave} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}
