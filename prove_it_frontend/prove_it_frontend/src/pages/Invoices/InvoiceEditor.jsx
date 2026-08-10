import { useMemo, useState } from 'react';
import { Plus, Trash2, Loader2, Save, Send } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import { toast } from '../../utils/toast.js';
import { formatMoney } from '../../utils/format.js';
import { CURRENCIES, PAYMENT_TERMS } from '../../utils/constants.js';
import { computeDueDate, calcTotals } from './invoiceCalc.js';

const emptyLine = () => ({ description: '', qty: '1', unit_price: '0' });
const today = () => new Date().toISOString().slice(0, 10);

function nextInvoiceNo(invoices) {
  const year = new Date().getFullYear();
  const count = invoices.filter(i => i.invoice_no?.includes(String(year))).length;
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
}

export default function InvoiceEditor({ companies, projects, invoices, initialData, createInvoice, updateInvoice, onDone, onCancel }) {
  const isEdit = !!initialData;
  const [client, setClient] = useState(initialData?.client || '');
  const [projectId, setProjectId] = useState(initialData?.project_id || '');
  const [invoiceNo, setInvoiceNo] = useState(initialData?.invoice_no || nextInvoiceNo(invoices));
  const [currency, setCurrency] = useState(initialData?.currency || 'INR');
  const [issueDate, setIssueDate] = useState(initialData?.issue_date || today());
  const [paymentTerms, setPaymentTerms] = useState(initialData?.payment_terms || 'net30');
  const [dueDate, setDueDate] = useState(initialData?.due_date || computeDueDate(today(), 'net30'));
  const [lineItems, setLineItems] = useState(
    initialData?.line_items?.length
      ? initialData.line_items.map(l => ({ description: l.description, qty: String(l.qty), unit_price: String(l.unit_price) }))
      : [emptyLine()]
  );
  const [discount, setDiscount] = useState(String(initialData?.discount ?? 0));
  const [taxRate, setTaxRate] = useState(String(initialData?.tax_rate ?? 0));
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [saving, setSaving] = useState(false);

  const { subtotal, taxAmount, total } = useMemo(
    () => calcTotals(lineItems, discount, taxRate),
    [lineItems, discount, taxRate],
  );

  function setLine(i, patch) {
    setLineItems(ls => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function onIssueDateChange(v) {
    setIssueDate(v);
    if (paymentTerms !== 'custom') setDueDate(computeDueDate(v, paymentTerms));
  }
  function onTermsChange(v) {
    setPaymentTerms(v);
    if (v !== 'custom') setDueDate(computeDueDate(issueDate, v));
  }
  function onProjectChange(v) {
    setProjectId(v);
    const p = projects.find(x => x.id === v);
    if (p?.client && !client) setClient(p.client);
  }

  async function handleSave(status) {
    if (!client.trim()) return toast('Bill-to client is required', 'error');
    if (!invoiceNo.trim()) return toast('Invoice number is required', 'error');
    if (!lineItems.some(l => l.description.trim())) return toast('Add at least one line item', 'error');

    const payload = {
      project_id: projectId || null,
      client: client.trim(),
      invoice_no: invoiceNo.trim(),
      currency,
      issue_date: issueDate,
      payment_terms: paymentTerms,
      ...(paymentTerms === 'custom' ? { due_date: dueDate } : {}),
      line_items: lineItems
        .filter(l => l.description.trim())
        .map(l => ({ description: l.description.trim(), qty: Number(l.qty) || 0, unit_price: Number(l.unit_price) || 0 })),
      discount: Number(discount) || 0,
      tax_rate: Number(taxRate) || 0,
      notes: notes.trim() || null,
    };
    if (!isEdit) payload.status = status;

    setSaving(true);
    try {
      const saved = isEdit ? await updateInvoice(initialData.id, payload) : await createInvoice(payload);
      toast(isEdit ? 'Invoice updated' : status === 'sent' ? 'Invoice created and sent' : 'Invoice saved as draft');
      onDone(saved);
    } catch {
      // httpClient already toasted the error
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card" style={{ padding: 20 }}>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Bill to (Client)</label>
            <input
              className="form-control"
              list="invoice-client-options"
              value={client}
              onChange={e => setClient(e.target.value)}
              placeholder="Client / company name"
            />
            <datalist id="invoice-client-options">
              {companies.map(c => <option key={c.id} value={c.name} />)}
            </datalist>
          </div>
          <div className="form-group">
            <label className="form-label">Project (optional)</label>
            <select className="form-control" value={projectId} onChange={e => onProjectChange(e.target.value)}>
              <option value="">No project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Invoice #</label>
            <input className="form-control" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Currency</label>
            <select className="form-control" value={currency} onChange={e => setCurrency(e.target.value)}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Issue date</label>
            <input type="date" className="form-control" value={issueDate} onChange={e => onIssueDateChange(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Payment terms</label>
            <select className="form-control" value={paymentTerms} onChange={e => onTermsChange(e.target.value)}>
              {PAYMENT_TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Due date</label>
            <input
              type="date"
              className="form-control"
              value={dueDate || ''}
              onChange={e => { setDueDate(e.target.value); setPaymentTerms('custom'); }}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="mb-3 hidden grid-cols-[1fr_90px_130px_130px_40px] gap-2 text-[11px] font-black uppercase tracking-wide text-muted sm:grid">
          <span>Description</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Unit price</span>
          <span className="text-right">Amount</span>
          <span />
        </div>
        <div className="space-y-2">
          {lineItems.map((l, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_90px_130px_130px_40px] sm:items-center">
              <input
                className="form-control col-span-2 sm:col-span-1"
                placeholder="Item / service description"
                value={l.description}
                onChange={e => setLine(i, { description: e.target.value })}
              />
              <input
                type="number" step="any" className="form-control text-right"
                value={l.qty} onChange={e => setLine(i, { qty: e.target.value })}
              />
              <input
                type="number" step="any" className="form-control text-right"
                value={l.unit_price} onChange={e => setLine(i, { unit_price: e.target.value })}
              />
              <div className="flex items-center justify-end px-1 text-[13px] tabular-nums">
                {formatMoney((Number(l.qty) || 0) * (Number(l.unit_price) || 0), currency)}
              </div>
              <button
                type="button"
                className="justify-self-end text-muted"
                onClick={() => setLineItems(ls => ls.filter((_, idx) => idx !== i))}
                disabled={lineItems.length === 1}
                title="Remove line"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Button type="button" variant="ghost" className="!px-3 !py-1.5 text-[12px]" onClick={() => setLineItems(ls => [...ls, emptyLine()])}>
            <Plus size={14} /> Add line
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card" style={{ padding: 20 }}>
          <div className="form-group">
            <label className="form-label">Notes (shown on invoice)</label>
            <textarea
              className="form-control" rows={4} value={notes}
              onChange={e => setNotes(e.target.value)} placeholder="Thank you for your business!"
            />
          </div>
        </div>
        <div className="card space-y-2" style={{ padding: 20 }}>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted">Subtotal</span>
            <span className="tabular-nums">{formatMoney(subtotal, currency)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[13px]">
            <span className="text-muted">Discount</span>
            <input
              type="number" step="any" className="form-control" style={{ width: 130, textAlign: 'right' }}
              value={discount} onChange={e => setDiscount(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between gap-2 text-[13px]">
            <span className="text-muted">Tax rate %</span>
            <input
              type="number" step="any" className="form-control" style={{ width: 130, textAlign: 'right' }}
              value={taxRate} onChange={e => setTaxRate(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted">Tax</span>
            <span className="tabular-nums">{formatMoney(taxAmount, currency)}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-3 text-[16px] font-bold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(total, currency)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        {!isEdit && (
          <Button variant="ghost" disabled={saving} onClick={() => handleSave('draft')}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save Draft
          </Button>
        )}
        <Button disabled={saving} onClick={() => handleSave(isEdit ? undefined : 'sent')}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {isEdit ? 'Save Changes' : 'Save & Mark Sent'}
        </Button>
      </div>
    </div>
  );
}
