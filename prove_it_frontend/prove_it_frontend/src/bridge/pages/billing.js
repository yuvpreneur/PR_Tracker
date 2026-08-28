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
  // Update the React Dropdown component
  const options = [{ value: '', label: 'Select Project Code' }, ...state.pcodes.map(pc => ({ value: pc.code, label: pc.code }))];
  if (typeof window.__updateDropdownOptions === 'function') {
    window.__updateDropdownOptions('modal-bcode', 'project code', options);
  }
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

// A billing code belongs to exactly one project (see billing_codes.py) — only ever offer
// the codes that actually belong to the selected project, so the two fields can't be
// combined into a mismatched pair. Exported so bridge/index.js's Edit prefill can refresh
// this list for the row's project before set()-ing its billing code (the value wouldn't
// "take" if it isn't currently a valid <option> in the select).
export function populateRecvBillingCodeSelect(projectId, keepValue) {
  const bcSel = field('modal-recv', 'billing code');
  if (!bcSel || bcSel.tagName !== 'SELECT') return;
  const codes = projectId ? state.bcodes.filter(b => b.project_id === projectId) : [];
  const prev = keepValue !== undefined ? keepValue : bcSel.value;
  bcSel.innerHTML = '<option value="">Select Billing Code</option>' +
    codes.map(b => `<option value="${b.code}">${b.code}</option>`).join('');
  bcSel.value = codes.some(b => b.code === prev) ? prev : '';
  // Update the React Dropdown component
  const options = [{ value: '', label: 'Select Billing Code' }, ...codes.map(b => ({ value: b.code, label: b.code }))];
  if (typeof window.__updateDropdownOptions === 'function') {
    window.__updateDropdownOptions('modal-recv', 'billing code', options);
  }
}

export function populateReceivableModalDropdowns() {
  const projSel = field('modal-recv', 'project');
  if (projSel && projSel.tagName === 'SELECT') {
    const prev = projSel.value;
    projSel.innerHTML = '<option value="">Select Project</option>' +
      state.projects.map(p => `<option value="${p.id}">${p.id} - ${p.name}</option>`).join('');
    if (prev) projSel.value = prev;
    // Update the React Dropdown component
    const options = [{ value: '', label: 'Select Project' }, ...state.projects.map(p => ({ value: p.id, label: `${p.id} - ${p.name}` }))];
    if (typeof window.__updateDropdownOptions === 'function') {
      window.__updateDropdownOptions('modal-recv', 'project', options);
    }

    // Re-filter (and drop any now-mismatched selection) whenever the project changes.
    if (!projSel._recvWired) {
      projSel._recvWired = true;
      projSel.addEventListener('change', () => populateRecvBillingCodeSelect(projSel.value));
    }
  }
  populateRecvBillingCodeSelect(projSel?.value);
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
