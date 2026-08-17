import { useMemo, useRef, useState } from 'react';
import { Upload, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import usePayRegister from './usePayRegister.js';
import { COLUMNS, SECTION_COLUMN_COUNTS } from './payRegisterColumns.js';
import Button from '../../components/ui/Button.jsx';
import { toast } from '../../utils/toast.js';
import { payPeriodLabel as formatPeriod } from '../../utils/format.js';
import usePermissions from '../../hooks/usePermissions.js';

const fmtNum = v => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('en-IN'));
const fmtText = v => (v === null || v === undefined || v === '' ? '—' : v);

// The Payslip header needs a company name/address — normally read straight from the
// uploaded file's own title block (see payroll.py's _detect_company_info), but not every
// file carries one. This is the "if not, enter it by hand" fallback, shown only when
// something's actually missing.
function CompanyInfoForm({ register, onSave }) {
  const [name, setName] = useState(register.company_name || '');
  const [address, setAddress] = useState(register.company_address || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ company_name: name, company_address: address });
      toast('Company info saved');
    } catch { /* toasted */ } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-slate-50 p-3">
      <div className="text-[12px] text-muted" style={{ width: '100%' }}>
        This file's title block didn't have a company name/address for the Payslip header — enter it here.
      </div>
      <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px' }}>
        <label className="form-label">Company Name</label>
        <input className="form-control" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="form-group" style={{ marginBottom: 0, flex: '2 1 320px' }}>
        <label className="form-label">Company Address</label>
        <input className="form-control" value={address} onChange={e => setAddress(e.target.value)} />
      </div>
      <Button type="submit" disabled={saving}>{saving && <Loader2 size={15} className="animate-spin" />} Save</Button>
    </form>
  );
}

export default function PayRegisterTab() {
  const { can } = usePermissions();
  const canEdit = can('Payroll', 'edit');
  const canDelete = can('Payroll', 'delete');
  const { periods, period, setPeriod, register, loading, uploading, upload, remove, saveCompanyInfo } = usePayRegister();
  const fileInputRef = useRef(null);

  const handleFileChange = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = await upload(file);
      if (data) toast(`Pay Register uploaded for ${formatPeriod(data.period)}`);
    } catch { /* toasted by uploadFile */ }
  };

  const handleDelete = async () => {
    if (!register) return;
    if (!window.confirm(`Delete the Pay Register for ${formatPeriod(register.period)}? This cannot be undone.`)) return;
    try { await remove(register.period); toast('Pay Register deleted'); } catch { /* toasted */ }
  };

  const employees = register?.employees || [];
  const totals = register?.totals || {};
  const unmatched = useMemo(() => employees.filter(e => e.employee_found === false), [employees]);

  return (
    <div>
      {(canEdit || canDelete) && (
        <div className="mb-4 flex justify-end gap-2">
          {canDelete && register && (
            <Button variant="danger" onClick={handleDelete}>
              <Trash2 size={15} /> Delete
            </Button>
          )}
          {canEdit && (
            <>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xlsm" hidden onChange={handleFileChange} />
              <Button variant="primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                {uploading ? 'Uploading…' : 'Upload Pay Register'}
              </Button>
            </>
          )}
        </div>
      )}

      {periods.length > 0 && (
        <div className="filter-bar">
          <select className="form-control" value={period || ''} onChange={e => setPeriod(e.target.value)}>
            {periods.map(p => <option key={p.period} value={p.period}>{formatPeriod(p.period)}</option>)}
          </select>
        </div>
      )}

      {canEdit && register && (!register.company_name || !register.company_address) && (
        <CompanyInfoForm register={register} onSave={saveCompanyInfo} />
      )}

      {unmatched.length > 0 && (
        <div
          className="mb-4 flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-[13px]"
          style={{ borderColor: 'var(--amber)', background: 'var(--amber-soft)' }}
        >
          <AlertTriangle size={16} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>{unmatched.length} employee{unmatched.length === 1 ? '' : 's'} in this file {unmatched.length === 1 ? "doesn't" : "don't"} match any Employee record:</strong>{' '}
            {unmatched.map((e, i) => (
              <span key={e.code || i}>
                {i > 0 && ', '}
                {e.code || '—'} – {e.name || '—'}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card table-wrap overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[13px]" style={{ whiteSpace: 'nowrap' }}>
          <thead>
            <tr>
              {SECTION_COLUMN_COUNTS.filter(s => s.count > 0).map(s => (
                <th key={s.key} colSpan={s.count} className="border-b border-line bg-slate-50 px-3.5 py-2 text-left text-[11px] font-black uppercase tracking-wide text-muted">
                  {s.label}
                </th>
              ))}
            </tr>
            <tr>
              {COLUMNS.map(c => (
                <th key={c.key} className="px-3.5 py-3 text-left text-[11px] font-black uppercase tracking-wide text-muted">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="p-8 text-center text-[13px] text-slate-400">
                  {loading ? 'Loading…' : (periods.length === 0 ? 'No Pay Register uploaded yet' : 'No employee rows for this period')}
                </td>
              </tr>
            )}
            {employees.map((row, i) => (
              <tr
                key={row.code || i}
                className="border-b border-slate-100"
                style={row.employee_found === false ? { background: 'var(--amber-soft)' } : undefined}
              >
                {COLUMNS.map((c, ci) => (
                  <td key={c.key} className="px-3 py-2.5">
                    {ci === 1 && row.employee_found === false ? (
                      <span title="Not found in Employees" className="inline-flex items-center gap-1">
                        <AlertTriangle size={13} style={{ color: 'var(--amber)' }} />
                        {fmtText(row[c.key])}
                      </span>
                    ) : (
                      c.type === 'number' ? fmtNum(row[c.key]) : fmtText(row[c.key])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {employees.length > 0 && (
            <tfoot>
              <tr aria-hidden="true">
                <td colSpan={COLUMNS.length} style={{ height: 18, padding: 0, border: 'none' }} />
              </tr>
              <tr className="border-t-2 font-bold" style={{ borderColor: 'var(--color-brand)', background: 'rgba(0,134,173,0.06)' }}>
                {COLUMNS.map((c, i) => (
                  <td key={c.key} className="px-3 py-3">
                    {i === 2 ? <span className="text-[11px] font-black uppercase tracking-wide">Total</span> : (c.type === 'number' && totals[c.key] != null ? fmtNum(totals[c.key]) : '')}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
