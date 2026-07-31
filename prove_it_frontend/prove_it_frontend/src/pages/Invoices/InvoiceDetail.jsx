import { ArrowLeft } from 'lucide-react';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import InvoiceActions from './InvoiceActions.jsx';
import { date, formatMoney } from '../../utils/format.js';

export default function InvoiceDetail({ invoice, projects, canEdit, sendInvoice, recordPayment, voidInvoice, onBack }) {
  const project = projects.find(p => p.id === invoice.project_id);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft size={15} /> Back to Invoices</Button>
        <InvoiceActions
          invoice={invoice}
          canEdit={canEdit}
          onSend={() => sendInvoice(invoice.id)}
          onVoid={() => voidInvoice(invoice.id)}
          onRecordPayment={amount => recordPayment(invoice.id, amount)}
        />
      </div>

      <div id="invoice-print-area" className="card" style={{ padding: 32 }}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[22px] font-black">Invoice {invoice.invoice_no}</h2>
            <p className="text-[13px] text-muted">Issue date: {date(invoice.issue_date)} · Due: {date(invoice.due_date)}</p>
          </div>
          <Badge status={invoice.display_status} />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="form-label">Bill to</div>
            <div className="text-[14px] font-semibold">{invoice.client}</div>
          </div>
          {project && (
            <div>
              <div className="form-label">Project</div>
              <div className="text-[14px] font-semibold">{project.name}</div>
            </div>
          )}
        </div>

        <table className="mt-6 w-full text-[13px]">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left">Description</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit price</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.line_items.map((l, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2">{l.description}</td>
                <td className="py-2 text-right">{l.qty}</td>
                <td className="py-2 text-right">{formatMoney(l.unit_price, invoice.currency)}</td>
                <td className="py-2 text-right">{formatMoney(l.qty * l.unit_price, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-full max-w-xs space-y-1.5 text-[13px]">
          <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{formatMoney(invoice.subtotal, invoice.currency)}</span></div>
          {invoice.discount > 0 && (
            <div className="flex justify-between"><span className="text-muted">Discount</span><span>-{formatMoney(invoice.discount, invoice.currency)}</span></div>
          )}
          {invoice.tax_rate > 0 && (
            <div className="flex justify-between"><span className="text-muted">Tax ({invoice.tax_rate}%)</span><span>{formatMoney(invoice.tax_amount, invoice.currency)}</span></div>
          )}
          <div className="flex justify-between border-t pt-2 text-[15px] font-bold"><span>Total</span><span>{formatMoney(invoice.total, invoice.currency)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Received</span><span>{formatMoney(invoice.received_amount, invoice.currency)}</span></div>
          <div className="flex justify-between font-semibold"><span>Balance due</span><span>{formatMoney(invoice.balance, invoice.currency)}</span></div>
        </div>

        {invoice.notes && <div className="mt-6 text-[13px] text-muted">{invoice.notes}</div>}
      </div>
    </div>
  );
}
