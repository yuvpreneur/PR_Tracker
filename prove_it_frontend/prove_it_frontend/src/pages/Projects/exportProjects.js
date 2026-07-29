import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from '../../utils/toast.js';

const EXPORT_HEADERS = ['Project Code', 'Project Name', 'Client', 'Manager', 'Status', 'Start Date', 'End Date', 'Budget (INR)', 'Est. Revenue (INR)', 'Est. Expense (INR)'];

const toRows = rows => rows.map(r => [
  r.id, r.name, r.client, r.manager, r.status,
  r.start_date || '', r.end_date || '',
  r.budget || 0, r.est_revenue || 0, r.est_expense || 0,
]);

export function exportProjectsCSV(rows) {
  if (!rows.length) { toast('No data to export', 'info'); return; }
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [EXPORT_HEADERS, ...toRows(rows)].map(row => row.map(escape).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `projects_${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast(`Exported ${rows.length} project${rows.length > 1 ? 's' : ''} to CSV`);
}

export function exportProjectsXLSX(rows) {
  if (!rows.length) { toast('No data to export', 'info'); return; }
  const ws = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...toRows(rows)]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Projects');
  XLSX.writeFile(wb, `projects_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast(`Exported ${rows.length} project${rows.length > 1 ? 's' : ''} to Excel`);
}

export function exportProjectsPDF(rows) {
  if (!rows.length) { toast('No data to export', 'info'); return; }
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text('Projects', 14, 14);
  autoTable(doc, {
    head: [EXPORT_HEADERS],
    body: toRows(rows),
    startY: 20,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [0, 134, 173] },
  });
  doc.save(`projects_${new Date().toISOString().slice(0, 10)}.pdf`);
  toast(`Exported ${rows.length} project${rows.length > 1 ? 's' : ''} to PDF`);
}
