import * as XLSX from 'xlsx';
import { toast } from '../../utils/toast.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Reproduces the shape of the original "Register of Payment of Wages/Salary" sheet
// (title row, grouped Earnings/Deductions/Company Contribution headers) from a run's
// computed lines — the compliance/audit artifact, not the day-to-day editing UI.
const ATTENDANCE_COLS = [
  ['S N', 'sn'], ['Code', 'emp_id'], ['Name', 'name'], ['Department', 'department'],
  ['Total Days', 'total_days'], ['Wk Off', 'wk_off'], ['Holiday', 'holiday'],
  ['Abs/LWP', 'abs_lwp'], ['Net Paid Days', 'net_paid_days'], ['Present Days', 'present_days'],
];
const EARNING_COLS = [
  ['Basic', 'basic'], ['HRA', 'hra'], ['CCA', 'cca'], ['Food Allowance', 'food_allowance'],
  ['Transport Allowance', 'transport_allowance'], ['Medical Allowance', 'medical_allowance'],
  ['Monthly Bonus', 'monthly_bonus'], ['Performance Incentive', 'performance_incentive'],
  ['Arrears', 'arrears'], ['LTA/LTC', 'lta'], ['Gross Earning', 'gross_earning'],
];
const DEDUCTION_COLS = [
  ['Professional Tax', 'professional_tax'], ['ESI', 'esi'], ['Provident Fund', 'pf'],
  ['TDS', 'tds'], ['Medical', 'medical'], ['Advance', 'advance_recovery'], ['Gross Deduction', 'gross_deduction'],
];
const NET_COL = [['Net Amt Payable', 'net_payable']];
const CONTRIBUTION_COLS = [
  ['Pension Cont.', 'pension_cont'], ['EPF Diff.', 'epf_diff'],
  ["Employer's PF Cont.", 'employer_pf_cont'], ["Employer's ESI Cont.", 'employer_esi_cont'],
  ['Total CTC', 'total_ctc'],
];

export function exportPayrollRegister(run) {
  const lines = run.lines || [];
  if (!lines.length) { toast('No employees in this run to export', 'info'); return; }

  const groups = [
    { title: null, cols: ATTENDANCE_COLS },
    { title: 'Earnings', cols: EARNING_COLS },
    { title: 'Deductions', cols: DEDUCTION_COLS },
    { title: null, cols: NET_COL },
    { title: 'Company Contribution', cols: CONTRIBUTION_COLS },
  ];
  const allCols = groups.flatMap(g => g.cols);

  const groupHeaderRow = [];
  const merges = [];
  let colIdx = 0;
  groups.forEach(g => {
    if (g.title) {
      groupHeaderRow[colIdx] = g.title;
      if (g.cols.length > 1) merges.push({ s: { r: 1, c: colIdx }, e: { r: 1, c: colIdx + g.cols.length - 1 } });
    }
    colIdx += g.cols.length;
  });

  const columnHeaderRow = allCols.map(([label]) => label);
  const dataRows = lines.map((l, i) => allCols.map(([, key]) => {
    if (key === 'sn') return i + 1;
    if (key === 'emp_id' || key === 'name' || key === 'department') return l[key] ?? '';
    return l[key] ?? 0;
  }));

  const titleRow = [`Register of Payment of Wages/Salary For the Month of ${MONTHS[run.period_month - 1]}/${run.period_year}`];
  const aoa = [titleRow, groupHeaderRow, columnHeaderRow, ...dataRows];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: allCols.length - 1 } }, ...merges];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Register');
  XLSX.writeFile(wb, `payroll_register_${run.period_year}_${String(run.period_month).padStart(2, '0')}.xlsx`);
  toast(`Exported payroll register for ${lines.length} employee${lines.length > 1 ? 's' : ''}`);
}
