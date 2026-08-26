import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, Loader2 } from 'lucide-react';
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
const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = n => String(n).padStart(2, '0');
const toISO = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;
// JS Date.getDay(): Sunday=0..Saturday=6. Stored weekly-off convention (matches the
// backend's Python date.weekday()): Monday=0..Sunday=6. Every calendar cell needs the
// conversion to check membership in the saved weeklyOff.weekdays set.
const toPythonWeekday = jsDay => (jsDay + 6) % 7;

const COLUMNS = [
  { key: 'date', header: 'Date', render: r => date(r.date) },
  { key: 'name', header: 'Holiday' },
];

function HolidayForm({ initialDate, onSave, onCancel }) {
  const [form, setForm] = useState({ date: initialDate || new Date().toISOString().slice(0, 10), name: '' });
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
      <div className="modal-footer">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" style={{ background: 'var(--rose)', color: '#ffffff' }} disabled={saving}>{saving && <Loader2 size={15} className="animate-spin" />} Save</button>
      </div>
    </form>
  );
}

function MonthCalendar({ year, month, holidaysByDate, weeklyOffSet, onPrev, onNext, onToday, canEdit, onDayClick }) {
  const todayISO = useMemo(() => {
    const t = new Date();
    return toISO(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list = [];
    for (let i = 0; i < firstDay; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(d);
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [year, month]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onPrev} className="rounded-md border border-line p-1" title="Previous month"><ChevronLeft size={16} /></button>
          <h4 className="w-40 text-center text-[14px] font-bold">{MONTHS[month]} {year}</h4>
          <button type="button" onClick={onNext} className="rounded-md border border-line p-1" title="Next month"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {DAY_HEADERS.map(h => (
          <div key={h} className="pb-1 text-center text-[11px] font-black uppercase tracking-wide text-black">{h}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const iso = toISO(year, month, d);
          const holiday = holidaysByDate[iso];
          const isWeeklyOff = weeklyOffSet.has(toPythonWeekday(new Date(year, month, d).getDay()));
          const isToday = iso === todayISO;
          const clickable = canEdit && !holiday && onDayClick;
          return (
            <div
              key={i}
              onClick={clickable ? () => onDayClick(iso) : undefined}
              title={holiday ? holiday.name : undefined}
              className={`flex min-h-15 flex-col gap-1 rounded-lg border p-1.5 text-[11px] ${clickable ? 'cursor-pointer hover:opacity-80' : ''} ${isToday ? 'ring-2 ring-offset-1' : ''}`}
              style={{
                borderColor: holiday ? 'var(--rose)' : isWeeklyOff ? 'var(--rose-soft)' : 'var(--color-line, #e2e8f0)',
                background: holiday ? 'var(--rose-soft)' : isWeeklyOff ? 'rgba(232,96,122,0.06)' : '#fff',
                ...(isToday ? { '--tw-ring-color': 'var(--rose)' } : {}),
              }}
            >
              <span className={`text-[12px] ${holiday ? 'font-bold' : isWeeklyOff ? 'text-muted' : ''}`} style={holiday ? { color: 'var(--rose)' } : {}}>{d}</span>
              {holiday && <span className="truncate font-semibold" style={{ color: 'var(--rose)' }}>{holiday.name}</span>}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--rose-soft)' }} /> Holiday</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'rgba(232,96,122,0.15)' }} /> Weekly Off</span>
      </div>
    </div>
  );
}

export default function HolidaysPage() {
  const { can } = usePermissions();
  const { holidays, weeklyOff, loading, createHoliday, deleteHoliday, saveWeeklyOff } = useHolidays();
  const [modalOpen, setModalOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState(null);
  const [savingWeekly, setSavingWeekly] = useState(false);
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  // Editing the calendar/weekly-off pattern feeds Payroll's attendance calc, so it stays
  // gated on the Payroll permission even though this is its own People & Time page —
  // viewing is open to every role (Admin/Manager/Finance User/Employee), same as before.
  const canEdit = can('Payroll', 'edit');

  const weeklyOffSet = useMemo(() => new Set(weeklyOff.weekdays || []), [weeklyOff]);
  const holidaysByDate = useMemo(() => Object.fromEntries(holidays.map(h => [h.date, h])), [holidays]);

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

  const openAddModal = isoDate => { setPrefillDate(isoDate || null); setModalOpen(true); };

  const renderExtraActions = row => canEdit && (
    <button className="inline-flex items-center rounded-md px-2.5 py-1 text-[11px] text-red" onClick={() => handleDelete(row)} title="Delete">
      <Trash2 size={13} />
    </button>
  );

  return (
    <div>
      <div className="page-header">
        <h2><CalendarDays size={22} /> Holidays & Weekly Off</h2>
      </div>

      <div className="space-y-5">
        <div className="card" style={{ padding: 20 }}>
          <h3 className="mb-3 text-[14px] font-bold">Weekly Off Pattern</h3>
          <p className="mb-3 text-[13px] text-muted">Days marked here count as "Wk Off" in every payroll run's attendance calc.</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map(w => {
              const active = weeklyOffSet.has(w.value);
              return (
                <button
                  key={w.value}
                  type="button"
                  disabled={!canEdit || savingWeekly}
                  onClick={() => toggleWeekday(w.value)}
                  className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold ${active ? 'border-transparent text-white' : 'border-line bg-white/80'}`}
                  style={active ? { background: 'var(--rose)', borderColor: 'var(--rose)', color: '#ffffff' } : undefined}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-[14px] font-bold">Calendar</h3>
            {canEdit && <Button variant="primary" onClick={() => openAddModal(null)}><Plus size={15} /> Add Holiday</Button>}
          </div>
          <MonthCalendar
            year={view.year}
            month={view.month}
            holidaysByDate={holidaysByDate}
            weeklyOffSet={weeklyOffSet}
            canEdit={canEdit}
            onDayClick={openAddModal}
            onPrev={() => setView(v => (v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }))}
            onNext={() => setView(v => (v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 }))}
            onToday={() => setView({ year: now.getFullYear(), month: now.getMonth() })}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 0 }}>
            <h3 className="text-[14px] font-bold">All Holidays</h3>
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
      </div>

      {modalOpen && (
        <Modal title="Add Holiday" onClose={() => setModalOpen(false)}>
          <HolidayForm
            initialDate={prefillDate}
            onSave={async payload => { try { await createHoliday(payload); toast('Holiday added'); setModalOpen(false); } catch { /* toasted */ } }}
            onCancel={() => setModalOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}
