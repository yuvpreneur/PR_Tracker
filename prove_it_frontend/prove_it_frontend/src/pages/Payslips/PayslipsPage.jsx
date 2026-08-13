import { useState } from 'react';
import { Receipt, ArrowLeft, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import usePayslips from './usePayslips.js';
import DataTable from '../../components/ui/DataTable.jsx';
import Button from '../../components/ui/Button.jsx';
import { formatMoney } from '../../utils/format.js';
import { toast } from '../../utils/toast.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const EARNING_FIELDS = [
  ['Basic', 'basic'], ['HRA', 'hra'], ['CCA', 'cca'], ['Food Allowance', 'food_allowance'],
  ['Transport Allowance', 'transport_allowance'], ['Medical Allowance', 'medical_allowance'],
  ['Monthly Bonus', 'monthly_bonus'], ['Performance Incentive', 'performance_incentive'],
  ['Arrears', 'arrears'], ['LTA/LTC', 'lta'],
];
const DEDUCTION_FIELDS = [
  ['Professional Tax', 'professional_tax'], ['ESI', 'esi'], ['Provident Fund', 'pf'],
  ['TDS', 'tds'], ['Medical', 'medical'], ['Advance', 'advance_recovery'],
];

function downloadPayslipPDF(slip) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(`Payslip — ${MONTHS[slip.period_month - 1]} ${slip.period_year}`, 14, 16);
  doc.setFontSize(10);
  doc.text(`${slip.name} (${slip.emp_id}) — ${slip.department}`, 14, 23);

  autoTable(doc, {
    startY: 30,
    head: [['Earnings', 'Amount']],
    body: EARNING_FIELDS.map(([label, key]) => [label, formatMoney(slip[key])]),
    foot: [['Gross Earning', formatMoney(slip.gross_earning)]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [0, 134, 173] },
  });
  autoTable(doc, {
    head: [['Deductions', 'Amount']],
    body: DEDUCTION_FIELDS.map(([label, key]) => [label, formatMoney(slip[key])]),
    foot: [['Gross Deduction', formatMoney(slip.gross_deduction)], ['Net Payable', formatMoney(slip.net_payable)]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [0, 134, 173] },
  });
  doc.save(`payslip_${slip.emp_id}_${slip.period_year}_${String(slip.period_month).padStart(2, '0')}.pdf`);
  toast('Payslip downloaded');
}

function PayslipDetail({ slip, onBack }) {
  return (
    <div>
      <div className="section-header">
        <h2 className="flex items-center gap-2">
          <button type="button" onClick={onBack} title="Back"><ArrowLeft size={18} /></button>
          <Receipt size={20} /> {MONTHS[slip.period_month - 1]} {slip.period_year}
        </h2>
        <Button variant="ghost" onClick={() => downloadPayslipPDF(slip)}><Download size={15} /> Download PDF</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card" style={{ padding: 20 }}>
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted">Attendance</h3>
          <div className="space-y-1.5 text-[13px]">
            <div className="flex justify-between"><span>Total Days</span><strong>{slip.total_days}</strong></div>
            <div className="flex justify-between"><span>Weekly Off</span><strong>{slip.wk_off}</strong></div>
            <div className="flex justify-between"><span>Holiday</span><strong>{slip.holiday}</strong></div>
            <div className="flex justify-between"><span>Absent / LWP</span><strong>{slip.abs_lwp}</strong></div>
            <div className="flex justify-between"><span>Net Paid Days</span><strong>{slip.net_paid_days}</strong></div>
            <div className="flex justify-between"><span>Present Days</span><strong>{slip.present_days}</strong></div>
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted">Earnings</h3>
          <div className="space-y-1.5 text-[13px]">
            {EARNING_FIELDS.map(([label, key]) => (
              <div className="flex justify-between" key={key}><span>{label}</span><span className="tabular-nums">{formatMoney(slip[key])}</span></div>
            ))}
            <div className="flex justify-between border-t pt-2 font-bold"><span>Gross Earning</span><span className="tabular-nums">{formatMoney(slip.gross_earning)}</span></div>
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted">Deductions</h3>
          <div className="space-y-1.5 text-[13px]">
            {DEDUCTION_FIELDS.map(([label, key]) => (
              <div className="flex justify-between" key={key}><span>{label}</span><span className="tabular-nums">{formatMoney(slip[key])}</span></div>
            ))}
            <div className="flex justify-between border-t pt-2 font-bold"><span>Gross Deduction</span><span className="tabular-nums">{formatMoney(slip.gross_deduction)}</span></div>
          </div>
        </div>

        <div className="card space-y-2" style={{ padding: 20 }}>
          <h3 className="mb-1 text-[13px] font-bold uppercase tracking-wide text-muted">Summary</h3>
          <div className="flex justify-between text-[13px]"><span>Gross Earning</span><span className="tabular-nums">{formatMoney(slip.gross_earning)}</span></div>
          <div className="flex justify-between text-[13px]"><span>Gross Deduction</span><span className="tabular-nums">{formatMoney(slip.gross_deduction)}</span></div>
          <div className="flex justify-between border-t pt-3 text-[16px] font-bold"><span>Net Payable</span><span className="tabular-nums">{formatMoney(slip.net_payable)}</span></div>
        </div>
      </div>
    </div>
  );
}

export default function PayslipsPage() {
  const { payslips, loading } = usePayslips();
  const [selected, setSelected] = useState(null);

  if (selected) return <PayslipDetail slip={selected} onBack={() => setSelected(null)} />;

  const columns = [
    { key: 'period', header: 'Period', render: r => `${MONTHS[r.period_month - 1]} ${r.period_year}` },
    { key: 'gross_earning', header: 'Gross Earning', render: r => formatMoney(r.gross_earning) },
    { key: 'gross_deduction', header: 'Gross Deduction', render: r => formatMoney(r.gross_deduction) },
    { key: 'net_payable', header: 'Net Payable', render: r => <strong>{formatMoney(r.net_payable)}</strong> },
  ];

  const renderExtraActions = row => (
    <button className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px]" onClick={() => setSelected(row)} title="View">
      View
    </button>
  );

  return (
    <div>
      <div className="section-header">
        <h2 className="flex items-center gap-2"><Receipt size={22} /> My Payslips</h2>
      </div>
      <div className="card table-wrap">
        <DataTable
          columns={columns}
          rows={payslips}
          getRowId={r => r.id}
          canEdit={false}
          canDelete={false}
          renderExtraActions={renderExtraActions}
          hideActionsColumn={false}
          emptyMessage={loading ? 'Loading…' : 'No payslips yet'}
        />
      </div>
    </div>
  );
}
