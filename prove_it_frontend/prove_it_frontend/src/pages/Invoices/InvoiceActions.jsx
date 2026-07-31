import { useState } from 'react';
import { Printer, Send, IndianRupee, Loader2, Ban } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import { formatMoney } from '../../utils/format.js';

export default function InvoiceActions({ invoice, canEdit, onSend, onVoid, onRecordPayment }) {
  const [pending, setPending] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState('');

  const openPay = () => {
    setAmount(invoice.balance > 0 ? String(invoice.balance) : '');
    setPayOpen(true);
  };

  async function run(action) {
    setPending(true);
    try { await action(); } catch { /* httpClient already toasted */ }
    finally { setPending(false); }
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <Button variant="ghost" onClick={() => window.print()}>
        <Printer size={15} /> Print / Save PDF
      </Button>

      {canEdit && invoice.status === 'draft' && (
        <Button disabled={pending} onClick={() => run(onSend)}>
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send / Mark Sent
        </Button>
      )}

      {canEdit && invoice.status === 'sent' && (
        <Button variant="ghost" onClick={openPay}>
          <IndianRupee size={15} /> Record Payment
        </Button>
      )}

      {canEdit && invoice.status !== 'void' && invoice.status !== 'paid' && (
        <Button variant="danger" disabled={pending} onClick={() => run(onVoid)}>
          <Ban size={15} /> Void
        </Button>
      )}

      {payOpen && (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setPayOpen(false); }}>
          <div className="modal" style={{ width: 400 }}>
            <div className="modal-header">
              <h3>Record a payment</h3>
              <button className="modal-close" onClick={() => setPayOpen(false)}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">Amount received ({invoice.currency})</label>
              <input
                type="number" step="any" className="form-control" autoFocus
                value={amount} onChange={e => setAmount(e.target.value)}
              />
              <p className="text-[12px] text-muted">Balance due: {formatMoney(invoice.balance, invoice.currency)}</p>
            </div>
            <div className="modal-footer">
              <Button variant="ghost" onClick={() => setPayOpen(false)} disabled={pending}>Cancel</Button>
              <Button
                disabled={pending || !(Number(amount) > 0) || Number(amount) > invoice.balance + 1e-6}
                onClick={() => run(async () => { await onRecordPayment(Number(amount)); setPayOpen(false); })}
              >
                {pending && <Loader2 size={15} className="animate-spin" />} Save Payment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
