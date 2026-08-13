import { Fragment, useState } from 'react';
import { ArrowLeft, Check, XCircle, Trash2, Download, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { formatMoney } from '../../utils/format.js';
import { toast } from '../../utils/toast.js';
import usePermissions from '../../hooks/usePermissions.js';
import { exportPayrollRegister } from './payrollExport.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ATTENDANCE_FIELDS = [
  { key: 'total_days', label: 'Total Days' }, { key: 'wk_off', label: 'Wk Off' },
  { key: 'holiday', label: 'Holiday' }, { key: 'abs_lwp', label: 'Abs/LWP' },
  { key: 'net_paid_days', label: 'Net Paid Days' }, { key: 'present_days', label: 'Present Days' },
];
const DEDUCTION_FIELDS = [
  { key: 'professional_tax', label: 'Professional Tax' }, { key: 'esi', label: 'ESI' },
  { key: 'pf', label: 'Provident Fund' }, { key: 'tds', label: 'TDS' },
  { key: 'medical', label: 'Medical' }, { key: 'advance_recovery', label: 'Advance' },
];
const CONTRIBUTION_FIELDS = [
  { key: 'pension_cont', label: 'Pension Cont.' }, { key: 'epf_diff', label: 'EPF Diff.' },
  { key: 'employer_pf_cont', label: "Employer's PF Cont." }, { key: 'employer_esi_cont', label: "Employer's ESI Cont." },
];
const EARNING_FIELDS = [
  { key: 'basic', label: 'Basic' }, { key: 'hra', label: 'HRA' }, { key: 'cca', label: 'CCA' },
  { key: 'food_allowance', label: 'Food Allowance' }, { key: 'transport_allowance', label: 'Transport Allowance' },
  { key: 'medical_allowance', label: 'Medical Allowance' }, { key: 'monthly_bonus', label: 'Monthly Bonus' },
  { key: 'performance_incentive', label: 'Performance Incentive' }, { key: 'arrears', label: 'Arrears' }, { key: 'lta', label: 'LTA/LTC' },
];
const EDITABLE_KEYS = [...ATTENDANCE_FIELDS, ...DEDUCTION_FIELDS, ...CONTRIBUTION_FIELDS].map(f => f.key);

function FieldGroup({ title, fields, form, set, disabled }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-muted">{title}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {fields.map(f => (
          <div className="form-group" key={f.key}>
            <label className="form-label">{f.label}</label>
            <input
              type="number" step="any" className="form-control text-right"
              value={form[f.key]} disabled={disabled}
              onChange={e => set(f.key, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function LinePanel({ line, editable, onSave }) {
  const [form, setForm] = useState(Object.fromEntries(EDITABLE_KEYS.map(k => [k, line[k]])));
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  async function handleSave() {
    setSaving(true);
    try {
      const patch = {};
      EDITABLE_KEYS.forEach(k => { patch[k] = Number(form[k]) || 0; });
      await onSave(patch);
      toast('Payroll line updated');
    } catch { /* httpClient already toasted */ }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4 border-t p-4">
      <FieldGroup title="Attendance" fields={ATTENDANCE_FIELDS} form={form} set={set} disabled={!editable} />
      <div>
        <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-muted">Sanctioned Earnings (reference — edit via Salary Structure)</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-[13px]">
          {EARNING_FIELDS.map(f => (
            <div key={f.key} className="flex justify-between gap-2 rounded-md bg-slate-50 px-2 py-1">
              <span className="text-muted">{f.label}</span>
              <span className="tabular-nums">{formatMoney(line[`actual_${f.key}`])}</span>
            </div>
          ))}
        </div>
      </div>
      <FieldGroup title="Deductions" fields={DEDUCTION_FIELDS} form={form} set={set} disabled={!editable} />
      <FieldGroup title="Employer Contribution" fields={CONTRIBUTION_FIELDS} form={form} set={set} disabled={!editable} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-[13px]">
        <div className="flex flex-wrap gap-4">
          <span>Gross Earning: <strong>{formatMoney(line.gross_earning)}</strong></span>
          <span>Gross Deduction: <strong>{formatMoney(line.gross_deduction)}</strong></span>
          <span>Net Payable: <strong>{formatMoney(line.net_payable)}</strong></span>
          <span>Total CTC: <strong>{formatMoney(line.total_ctc)}</strong></span>
        </div>
        {editable && (
          <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 size={15} className="animate-spin" />} Save Line</Button>
        )}
      </div>
    </div>
  );
}

export default function RunEditor({ run, setRun, updateLine, finalizeRun, voidRun, deleteRun, onBack }) {
  const { can } = usePermissions();
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState(false);
  const canEdit = can('Payroll', 'edit');
  const canDelete = can('Payroll', 'delete');
  const isDraft = run.status === 'Draft';
  const lines = run.lines || [];

  const handleLineSave = (lineId, patch) =>
    updateLine(run.id, lineId, patch).then(updated => {
      setRun(r => ({ ...r, lines: r.lines.map(l => (l.id === lineId ? updated : l)) }));
    });

  const handleFinalize = async () => {
    if (!window.confirm(`Finalize payroll for ${MONTHS[run.period_month - 1]} ${run.period_year}? This locks every line and recovers advance balances.`)) return;
    setBusy(true);
    try { setRun(await finalizeRun(run.id)); toast('Payroll run finalized'); }
    catch { /* toasted */ }
    finally { setBusy(false); }
  };

  const handleVoid = async () => {
    if (!window.confirm('Void this finalized run? Advance recoveries will be reversed. This cannot be undone.')) return;
    setBusy(true);
    try { setRun(await voidRun(run.id)); toast('Payroll run voided'); }
    catch { /* toasted */ }
    finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this draft payroll run?')) return;
    try { await deleteRun(run.id); toast('Draft run deleted'); onBack(); } catch { /* toasted */ }
  };

  return (
    <div>
      <div className="section-header">
        <h3 className="flex items-center gap-2 text-[14px] font-bold">
          <button type="button" onClick={onBack} title="Back to runs"><ArrowLeft size={16} /></button>
          {MONTHS[run.period_month - 1]} {run.period_year} <Badge status={run.status} />
        </h3>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => exportPayrollRegister(run)}><Download size={15} /> Export Register</Button>
          {isDraft && canDelete && (
            <Button variant="danger" onClick={handleDelete} disabled={busy}><Trash2 size={15} /> Delete</Button>
          )}
          {isDraft && canEdit && (
            <Button onClick={handleFinalize} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Finalize</Button>
          )}
          {run.status === 'Finalized' && canEdit && (
            <Button variant="danger" onClick={handleVoid} disabled={busy}><XCircle size={15} /> Void</Button>
          )}
        </div>
      </div>

      <div className="card table-wrap">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              {['Name', 'Department', 'Present Days', 'Gross Earning', 'Gross Deduction', 'Net Payable', ''].map(h => (
                <th key={h} className="px-3.5 py-3 text-left text-[11px] font-black uppercase tracking-wide text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map(line => (
              <Fragment key={line.id}>
                <tr className="border-b border-slate-100">
                  <td className="px-3 py-2.5"><strong>{line.name}</strong> <span className="text-muted">({line.emp_id})</span></td>
                  <td className="px-3 py-2.5">{line.department}</td>
                  <td className="px-3 py-2.5">{line.present_days}</td>
                  <td className="px-3 py-2.5">{formatMoney(line.gross_earning)}</td>
                  <td className="px-3 py-2.5">{formatMoney(line.gross_deduction)}</td>
                  <td className="px-3 py-2.5"><strong>{formatMoney(line.net_payable)}</strong></td>
                  <td className="px-3 py-2.5">
                    <button type="button" onClick={() => setExpanded(expanded === line.id ? null : line.id)} title="Details">
                      {expanded === line.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </td>
                </tr>
                {expanded === line.id && (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <LinePanel line={line} editable={isDraft && canEdit} onSave={patch => handleLineSave(line.id, patch)} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {lines.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-slate-400">No employees in this run</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
