import { useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import useHolidays from './useHolidays.js';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { date } from '../../utils/format.js';
import { toast } from '../../utils/toast.js';
import usePermissions from '../../hooks/usePermissions.js';

const WEEKDAYS = [
  { value: 0, label: 'Monday' }, { value: 1, label: 'Tuesday' }, { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' }, { value: 4, label: 'Friday' }, { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
];

const COLUMNS = [
  { key: 'date', header: 'Date', render: r => date(r.date) },
  { key: 'name', header: 'Holiday' },
];

function HolidayForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), name: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast('Holiday name is required', 'error');
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="form-group">
        <label className="form-label">Date</label>
        <input type="date" className="form-control" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
      </div>
      <div className="form-group">
        <label className="form-label">Holiday Name</label>
        <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Independence Day" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving && <Loader2 size={15} className="animate-spin" />} Save</Button>
      </div>
    </form>
  );
}

export default function HolidaysWeeklyOffTab() {
  const { can } = usePermissions();
  const { holidays, weeklyOff, loading, createHoliday, deleteHoliday, saveWeeklyOff } = useHolidays();
  const [modalOpen, setModalOpen] = useState(false);
  const [savingWeekly, setSavingWeekly] = useState(false);
  const canEdit = can('Payroll', 'edit');

  const toggleWeekday = day => {
    const current = weeklyOff.weekdays || [];
    const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    setSavingWeekly(true);
    saveWeeklyOff({ weekdays: next }).then(() => toast('Weekly off pattern saved')).finally(() => setSavingWeekly(false));
  };

  const handleDelete = async row => {
    if (!window.confirm(`Delete holiday "${row.name}"?`)) return;
    try { await deleteHoliday(row.id); toast('Deleted'); } catch { /* toasted */ }
  };

  const renderExtraActions = row => canEdit && (
    <button className="inline-flex items-center rounded-md px-2.5 py-1 text-[11px] text-red" onClick={() => handleDelete(row)} title="Delete">
      <Trash2 size={13} />
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="card" style={{ padding: 20 }}>
        <h3 className="mb-3 text-[14px] font-bold">Weekly Off Pattern</h3>
        <p className="mb-3 text-[13px] text-muted">Days marked here count as "Wk Off" in every payroll run's attendance calc.</p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map(w => {
            const active = (weeklyOff.weekdays || []).includes(w.value);
            return (
              <button
                key={w.value}
                type="button"
                disabled={!canEdit || savingWeekly}
                onClick={() => toggleWeekday(w.value)}
                className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold ${active ? 'border-transparent text-white' : 'border-line bg-white/80'}`}
                style={active ? { background: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-2))' } : undefined}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="section-header">
          <h3 className="text-[14px] font-bold">Holidays Calendar</h3>
          {canEdit && <Button variant="primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Add Holiday</Button>}
        </div>
        <div className="card table-wrap">
          <DataTable
            columns={COLUMNS}
            rows={holidays}
            getRowId={r => r.id}
            canEdit={false}
            canDelete={false}
            renderExtraActions={renderExtraActions}
            hideActionsColumn={!canEdit}
            emptyMessage={loading ? 'Loading…' : 'No holidays added yet'}
          />
        </div>
      </div>

      {modalOpen && (
        <Modal title="Add Holiday" onClose={() => setModalOpen(false)}>
          <HolidayForm
            onSave={async payload => { try { await createHoliday(payload); toast('Holiday added'); setModalOpen(false); } catch { /* toasted */ } }}
            onCancel={() => setModalOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}
