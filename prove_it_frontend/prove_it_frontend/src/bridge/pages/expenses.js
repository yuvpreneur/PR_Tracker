import { get, qs } from '../core/http.js';
import { state } from '../core/state.js';
import { badge, date } from '../shared/ui.js';
import { renderTable, approveBtns, isReactOwned } from '../shared/table.js';
import { field } from '../shared/modals.js';
import { can, isMine, noActionsColumn } from '../shared/permissions.js';

function expRowGuard(row) {
  const mine = isMine(row, 'submitted_by');
  const pending = row.status === 'Pending';
  return {
    noEdit:   !(can('Expenses', 'edit')   || (mine && pending)),
    noDelete: !(can('Expenses', 'delete') || (mine && pending)),
  };
}

export function populateExpenseModalDropdowns() {
  const projSel = field('modal-expense', 'project');
  if (projSel && projSel.tagName === 'SELECT') {
    const prev = projSel.value;
    projSel.innerHTML = '<option value="">Select Project</option>' +
      state.projects.map(p => `<option value="${p.id}">${p.id} - ${p.name}</option>`).join('');
    if (prev) projSel.value = prev;
  }
  const pcSel = field('modal-expense', 'project code');
  if (pcSel && pcSel.tagName === 'SELECT') {
    const prev = pcSel.value;
    pcSel.innerHTML = '<option value="">Select Project Code</option>' +
      state.pcodes.map(c => `<option value="${c.code}">${c.code}</option>`).join('');
    if (prev) pcSel.value = prev;
  }
  const bcSel = field('modal-expense', 'billing code');
  if (bcSel && bcSel.tagName === 'SELECT') {
    const prev = bcSel.value;
    bcSel.innerHTML = '<option value="">Select Billing Code</option>' +
      state.bcodes.map(b => `<option value="${b.code}">${b.code}</option>`).join('');
    if (prev) bcSel.value = prev;
  }
}

export async function loadExpenses() {
  const rows = await get('/api/expenses' + qs(state.pf['page-expenses'])).catch(() => []);
  state.expenses = rows;

  const page = document.getElementById('page-expenses');
  if (page && state.projects.length) {
    page.querySelectorAll('select').forEach(sel => {
      if (sel.closest('[id^="modal"]') || sel.closest('.modal')) return;
      // ExpensesPage.jsx (React) owns #page-expenses now, including its own
      // Project filter select — don't clobber it (see isReactOwned() in shared/table.js).
      if (isReactOwned(sel)) return;
      if (!(sel.options[0]?.text || '').toLowerCase().includes('all projects')) return;
      const prev = sel.value;
      sel.innerHTML = '<option value="">All Projects</option>' +
        state.projects.map(p => `<option value="${p.id}">${p.id} — ${p.name}</option>`).join('');
      if (prev && prev !== 'All Projects') sel.value = prev;
    });
  }
  populateExpenseModalDropdowns();

  renderTable('page-expenses', rows, [
    { k: 'project_id',      fn: r => state.projects.find(p => p.id === r.project_id)?.name || r.project_id },
    { k: 'project_code_id', fn: r => r.project_code_id || '—' },
    { k: 'billing_code_id', fn: r => r.billing_code_id || '—' },
    { k: 'category',        fn: r => badge(r.category) },
    { k: 'expense_date',    fn: r => date(r.expense_date) },
    { k: 'amount',          fn: r => `₹${r.amount.toLocaleString('en-IN')}` },
    { k: 'vendor',          fn: r => r.vendor || '—' },
    { k: 'status',          fn: r => badge(r.status) },
  ], r => r.id, approveBtns('Expenses', 'submitted_by'), null, { rowGuard: expRowGuard, hideActionsColumn: noActionsColumn('expenses') });
  // Lets the React-based ExpensesPage (mounted as a portal into #page-expenses)
  // know to refetch — it doesn't read this legacy render pipeline's output directly.
  document.dispatchEvent(new CustomEvent('expenses:changed'));
}
