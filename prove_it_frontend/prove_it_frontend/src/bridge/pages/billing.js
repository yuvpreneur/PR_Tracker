import { get, qs } from '../core/http.js';
import { state } from '../core/state.js';
import { badge, date, num } from '../shared/ui.js';
import { renderTable } from '../shared/table.js';
import { field } from '../shared/modals.js';
import { can, noActionsColumn } from '../shared/permissions.js';

export function populateBCodeProjectCodeDropdown() {
  const sel = field('modal-bcode', 'project code');
  if (!sel || sel.tagName !== 'SELECT') return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">Select Project Code</option>' +
    state.pcodes.map(pc => `<option value="${pc.code}">${pc.code}</option>`).join('');
  if (prev) sel.value = prev;
}

export async function loadBillingCodes() {
  const rows = await get('/api/billing-codes' + qs(state.pf['page-billing-codes'])).catch(() => []);
  if (rows.length) state.bcodes = rows;
  populateBCodeProjectCodeDropdown();
  renderTable('page-billing-codes', rows, [
    { k: 'code',            fn: r => `<strong>${r.code}</strong>` },
    { k: 'project_code_id' },
    { k: 'project_id',      fn: r => state.projects.find(p => p.id === r.project_id)?.name || r.project_id },
    { k: 'client',          fn: r => r.client || '—' },
    { k: 'billing_type',    fn: r => badge(r.billing_type) },
    { k: 'rate',            fn: r => `₹${num(r.rate)}${r.billing_type === 'T&M' ? '/hr' : ''}` },
    { k: 'status',          fn: r => badge(r.status) },
    { k: 'effective_from',  fn: r => date(r.effective_from) },
    { k: 'effective_to',    fn: r => date(r.effective_to) },
  ], r => r.code, () => '', null, {
    noEdit: !can('Billing Codes', 'edit'), noDelete: !can('Billing Codes', 'delete'),
    hideActionsColumn: noActionsColumn('billing-codes'),
  });
  // Lets the React-based BillingCodesPage (mounted as a portal into #page-billing-codes)
  // know to refetch — it doesn't read this legacy render pipeline's output directly.
  document.dispatchEvent(new CustomEvent('billing-codes:changed'));
}

export function populateReceivableModalDropdowns() {
  const projSel = field('modal-recv', 'project');
  if (projSel && projSel.tagName === 'SELECT') {
    const prev = projSel.value;
    projSel.innerHTML = '<option value="">Select Project</option>' +
      state.projects.map(p => `<option value="${p.id}">${p.id} - ${p.name}</option>`).join('');
    if (prev) projSel.value = prev;
  }
  const bcSel = field('modal-recv', 'billing code');
  if (bcSel && bcSel.tagName === 'SELECT') {
    const prev = bcSel.value;
    bcSel.innerHTML = '<option value="">Select Billing Code</option>' +
      state.bcodes.map(b => `<option value="${b.code}">${b.code}</option>`).join('');
    if (prev) bcSel.value = prev;
  }
}

export async function loadReceivables() {
  const rows = await get('/api/receivables' + qs(state.pf['page-receivables'])).catch(() => []);
  state.receivables = rows;
  populateReceivableModalDropdowns();
  renderTable('page-receivables', rows, [
    { k: 'project_id',      fn: r => state.projects.find(p => p.id === r.project_id)?.name || r.project_id },
    { k: 'billing_code_id', fn: r => r.billing_code_id || '—' },
    { k: 'client' },
    { k: 'invoice_no' },
    { k: 'invoice_date',    fn: r => date(r.invoice_date) },
    { k: 'invoice_amount',  fn: r => `₹${num(r.invoice_amount)}` },
    { k: 'received_amount', fn: r => `₹${num(r.received_amount)}` },
    { k: 'balance',         fn: r => `₹${num(r.balance)}` },
    { k: 'due_date',        fn: r => date(r.due_date) },
    { k: 'status',          fn: r => badge(r.status) },
  ], r => r.id, () => '', null, {
    noEdit: !can('Receivables', 'edit'), noDelete: !can('Receivables', 'delete'),
    hideActionsColumn: noActionsColumn('receivables'),
  });
  // Lets the React-based ReceivablesPage (mounted as a portal into #page-receivables)
  // know to refetch — it doesn't read this legacy render pipeline's output directly.
  document.dispatchEvent(new CustomEvent('receivables:changed'));
}
