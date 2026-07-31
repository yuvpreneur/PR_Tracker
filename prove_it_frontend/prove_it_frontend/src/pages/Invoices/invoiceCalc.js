import { PAYMENT_TERMS } from '../../utils/constants.js';

export function computeDueDate(issueDate, paymentTerms) {
  const term = PAYMENT_TERMS.find(t => t.value === paymentTerms);
  if (!term || term.days == null || !issueDate) return null;
  const d = new Date(issueDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + term.days);
  return d.toISOString().slice(0, 10);
}

export function calcTotals(lineItems, discount, taxRate) {
  const subtotal = lineItems.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0);
  const disc = Number(discount) || 0;
  const taxable = Math.max(subtotal - disc, 0);
  const taxAmount = (taxable * (Number(taxRate) || 0)) / 100;
  const total = taxable + taxAmount;
  return { subtotal, taxAmount, total };
}
