import { get, qs } from '../core/http.js';
import { state } from '../core/state.js';
import { toast, periodRange } from '../shared/ui.js';
import { renderTable } from '../shared/table.js';
import { openModal } from '../shared/modals.js';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { canExportOnPage } from '../shared/permissions.js';

// Exported so the React ReportsPage can derive its row labels from the same
// source of truth instead of duplicating title strings.
export const REPORTS = {
  'project-revenue': {
    title: 'Project-wise Revenue',
    endpoint: '/api/reports/project-profitability',
    filters: ['project_id', 'period'],
    idKey: 'project_id',
    columns: [
      { k: 'project_id', label: 'Project Code' },
      { k: 'project_name', label: 'Project Name' },
      { k: 'client', label: 'Client' },
      { k: 'revenue_received', label: 'Revenue Received (INR)' },
    ],
  },
  'project-expenses': {
    title: 'Project-wise Expenses',
    endpoint: '/api/reports/project-profitability',
    filters: ['project_id', 'period'],
    idKey: 'project_id',
    columns: [
      { k: 'project_id', label: 'Project Code' },
      { k: 'project_name', label: 'Project Name' },
      { k: 'client', label: 'Client' },
      { k: 'direct_expenses', label: 'Direct Expenses (INR)' },
    ],
  },
  'project-employee-cost': {
    title: 'Project-wise Employee Cost',
    endpoint: '/api/reports/project-profitability',
    filters: ['project_id', 'period'],
    idKey: 'project_id',
    columns: [
      { k: 'project_id', label: 'Project Code' },
      { k: 'project_name', label: 'Project Name' },
      { k: 'total_hours', label: 'Total Hours' },
      { k: 'employee_cost', label: 'Employee Cost (INR)' },
    ],
  },
  'project-profitability': {
    title: 'Project Profitability',
    endpoint: '/api/reports/project-profitability',
    filters: ['project_id', 'period'],
    idKey: 'project_id',
    columns: [
      { k: 'project_id', label: 'Project Code' },
      { k: 'project_name', label: 'Project Name' },
      { k: 'client', label: 'Client' },
      { k: 'status', label: 'Status' },
      { k: 'total_hours', label: 'Total Hours' },
      { k: 'employee_cost', label: 'Employee Cost' },
      { k: 'direct_expenses', label: 'Direct Expenses' },
      { k: 'total_cost', label: 'Total Cost' },
      { k: 'revenue_received', label: 'Revenue Received' },
      { k: 'gross_profit', label: 'Gross Profit' },
      { k: 'margin_pct', label: 'Margin %' },
    ],
  },
  'billing-code-report': {
    title: 'Billing Code-wise Report',
    endpoint: '/api/reports/billing-code-summary',
    filters: ['project_id', 'period'],
    idKey: 'code',
    columns: [
      { k: 'code', label: 'Billing Code' },
      { k: 'project_id', label: 'Project' },
      { k: 'client', label: 'Client' },
      { k: 'billing_type', label: 'Type' },
      { k: 'rate', label: 'Rate' },
      { k: 'total_hours', label: 'Total Hours' },
      { k: 'direct_expenses', label: 'Expenses' },
      { k: 'total_billed', label: 'Billed' },
      { k: 'total_received', label: 'Received' },
    ],
  },
  'employee-hours': {
    title: 'Employee-wise Hours',
    endpoint: '/api/reports/employee-utilization',
    filters: ['emp_id', 'period'],
    idKey: 'emp_id',
    columns: [
      { k: 'emp_id', label: 'Emp ID' },
      { k: 'name', label: 'Name' },
      { k: 'department', label: 'Department' },
      { k: 'total_hours', label: 'Total Hours' },
    ],
  },
  'employee-cost': {
    title: 'Employee-wise Cost',
    endpoint: '/api/reports/employee-utilization',
    filters: ['emp_id', 'period'],
    idKey: 'emp_id',
    columns: [
      { k: 'emp_id', label: 'Emp ID' },
      { k: 'name', label: 'Name' },
      { k: 'department', label: 'Department' },
      { k: 'total_hours', label: 'Total Hours' },
      { k: 'hourly_cost', label: 'Hourly Cost' },
      { k: 'total_cost', label: 'Total Cost' },
    ],
  },
  'billable-nonbillable': {
    title: 'Billable vs Non-Billable Hours',
    endpoint: '/api/reports/employee-utilization',
    filters: ['emp_id', 'period'],
    idKey: 'emp_id',
    columns: [
      { k: 'emp_id', label: 'Emp ID' },
      { k: 'name', label: 'Name' },
      { k: 'billable_hours', label: 'Billable Hours' },
      { k: 'non_billable_hours', label: 'Non-Billable Hours' },
      { k: 'utilization_pct', label: 'Utilization %' },
    ],
  },
  'timesheet-approval': {
    title: 'Timesheet Approval Report',
    endpoint: '/api/timesheets/',
    filters: ['project_id', 'emp_id', 'periodDates'],
    idKey: 'id',
    columns: [
      { k: 'id', label: 'ID' },
      { k: 'emp_id', label: 'Emp ID' },
      { k: 'project_id', label: 'Project' },
      { k: 'entry_date', label: 'Date' },
      { k: 'hours', label: 'Hours' },
      { k: 'status', label: 'Status' },
    ],
  },
  'receivables-aging': {
    title: 'Receivables Aging',
    endpoint: '/api/reports/receivables-aging',
    filters: ['project_id'],
    idKey: 'bucket',
    extract: data => Object.entries(data.aging_buckets || {}).map(([bucket, outstanding]) => ({ bucket, outstanding })),
    columns: [
      { k: 'bucket', label: 'Bucket' },
      { k: 'outstanding', label: 'Outstanding (INR)' },
    ],
  },
  'outstanding-payments': {
    title: 'Outstanding Payments',
    endpoint: '/api/receivables/',
    filters: ['project_id', 'periodDates'],
    idKey: 'id',
    extract: rows => (rows || []).filter(r => r.balance > 0),
    columns: [
      { k: 'project_id', label: 'Project' },
      { k: 'client', label: 'Client' },
      { k: 'invoice_no', label: 'Invoice No' },
      { k: 'invoice_amount', label: 'Invoice Amount' },
      { k: 'received_amount', label: 'Received' },
      { k: 'balance', label: 'Balance' },
      { k: 'due_date', label: 'Due Date' },
      { k: 'status', label: 'Status' },
    ],
  },
  'expense-approval': {
    title: 'Expense Approval Report',
    endpoint: '/api/expenses/',
    filters: ['project_id', 'periodDates'],
    idKey: 'id',
    columns: [
      { k: 'id', label: 'ID' },
      { k: 'project_id', label: 'Project' },
      { k: 'category', label: 'Category' },
      { k: 'expense_date', label: 'Date' },
      { k: 'amount', label: 'Amount' },
      { k: 'status', label: 'Status' },
      { k: 'submitted_by', label: 'Submitted By' },
    ],
  },
  'audit-log-report': {
    title: 'Audit Log Report',
    endpoint: '/api/audit-log/',
    filters: ['periodDates'],
    idKey: 'id',
    extract: data => data?.logs || data || [],
    columns: [
      { k: 'timestamp', label: 'Timestamp' },
      { k: 'user', label: 'User' },
      { k: 'module', label: 'Module' },
      { k: 'action', label: 'Action' },
      { k: 'detail', label: 'Detail' },
    ],
  },
};

function buildParams(cfg) {
  const pf = state.pf['page-reports'] || {};
  const periodVal = document.getElementById('reports-period')?.value;
  const params = {};
  cfg.filters.forEach(f => {
    if (f === 'project_id') params.project_id = pf.project_id;
    else if (f === 'emp_id') params.emp_id = pf.emp_id;
    else if (f === 'period') { if (periodVal) params.period = periodVal; }
    else if (f === 'periodDates') { if (periodVal) Object.assign(params, periodRange(periodVal)); }
  });
  return params;
}

async function fetchReportRows(cfg) {
  const raw = await get(cfg.endpoint + qs(buildParams(cfg))).catch(() => null);
  if (raw === null) return null;
  return cfg.extract ? cfg.extract(raw) : raw;
}

export async function openReportView(key) {
  const cfg = REPORTS[key];
  if (!cfg) return;
  const rows = await fetchReportRows(cfg);
  if (rows === null) return;

  const title = document.getElementById('report-view-title');
  if (title) title.textContent = cfg.title;
  const meta = document.getElementById('report-view-meta');
  if (meta) meta.textContent = `${rows.length} record${rows.length === 1 ? '' : 's'}`;
  const thead = document.getElementById('report-view-thead');
  if (thead) thead.innerHTML = '<tr>' + cfg.columns.map(c => `<th>${c.label}</th>`).join('') + '<th></th></tr>';

  renderTable(null, rows, cfg.columns.map(c => ({ k: c.k })), r => r[cfg.idKey] ?? '', () => '',
    '#modal-report-view tbody', { noEdit: true, noDelete: true });

  openModal('modal-report-view');
}

export async function handleReportExport(key, format) {
  const cfg = REPORTS[key];
  if (!cfg) return;
  const rows = await fetchReportRows(cfg);
  if (rows === null) return;
  if (!rows.length) { toast('No data to export', 'info'); return; }

  const headers = cfg.columns.map(c => c.label);
  const aoa = rows.map(r => cfg.columns.map(c => r[c.k] ?? ''));
  const stamp = new Date().toISOString().slice(0, 10);
  const fname = key.replace(/-/g, '_');

  if (format === 'excel') {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...aoa]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, cfg.title.slice(0, 31));
    XLSX.writeFile(wb, `${fname}_${stamp}.xlsx`);
    toast(`Exported ${rows.length} row${rows.length > 1 ? 's' : ''} to Excel`);
  } else if (format === 'pdf') {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(cfg.title, 14, 14);
    autoTable(doc, {
      head: [headers],
      body: aoa,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 134, 173] },
    });
    doc.save(`${fname}_${stamp}.pdf`);
    toast(`Exported ${rows.length} row${rows.length > 1 ? 's' : ''} to PDF`);
  }
}

export function loadReports() {
  const page = document.getElementById('page-reports');
  if (!page) return;
  const search = (state.pf['page-reports']?.search || '').toLowerCase();
  const exportAllowed = canExportOnPage('reports');
  page.querySelectorAll('.perm-row[data-report-key]').forEach(row => {
    const label = (row.querySelector('span')?.textContent || '').toLowerCase();
    row.style.display = !search || label.includes(search) ? '' : 'none';
    row.querySelectorAll('.report-export-btn, .report-export-option').forEach(el => {
      el.style.display = exportAllowed ? '' : 'none';
    });
  });
}
