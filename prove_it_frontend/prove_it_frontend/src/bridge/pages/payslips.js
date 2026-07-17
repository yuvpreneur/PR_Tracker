import { get } from '../core/http.js';
import { toast } from '../shared/ui.js';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

let cachedMe = null;
async function currentUser() {
  if (cachedMe) return cachedMe;
  cachedMe = await get('/api/auth/me').catch(() => null);
  return cachedMe;
}

function parseAmount(text) {
  return parseFloat(String(text).replace(/[^\d.]/g, '')) || 0;
}

async function downloadPayslip(row) {
  const cells = Array.from(row.children).map(td => td.textContent.trim());
  const [month, gross, deductions, net] = cells;
  const me = await currentUser();

  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Prove IT Catalysts', 14, 18);
  doc.setFontSize(11);
  doc.text('Salary Slip', 14, 26);

  doc.setFontSize(10);
  doc.text(`Employee: ${me?.name || 'Employee'}`, 14, 38);
  doc.text(`Employee ID: ${me?.username || '—'}`, 14, 44);
  doc.text(`Role: ${me?.role || '—'}`, 14, 50);
  doc.text(`Pay Period: ${month}`, 14, 56);

  autoTable(doc, {
    startY: 64,
    head: [['Component', 'Amount (₹)']],
    body: [
      ['Gross Pay', num(parseAmount(gross))],
      ['Deductions', num(parseAmount(deductions))],
      ['Net Pay', num(parseAmount(net))],
    ],
    styles: { fontSize: 10 },
    headStyles: { fillColor: [0, 134, 173] },
  });

  doc.save(`Payslip_${month.replace(/\s+/g, '_')}.pdf`);
  toast(`Payslip for ${month} downloaded`);
}

function num(n) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function wirePayslipDownloads() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.bridge-payslip-download');
    if (!btn) return;
    const row = btn.closest('tr');
    if (!row) return;
    downloadPayslip(row);
  });
}
