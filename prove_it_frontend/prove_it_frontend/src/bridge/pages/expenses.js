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

// Project -> Project Code -> Billing Code is a strict chain: a project code belongs to
// exactly one project, and a billing code to exactly one project code. Each list is
// therefore narrowed by the selection above it, so the three fields can never be saved
// as a mismatched set. Both are exported so bridge/index.js's Edit prefill can rebuild
// the lists for the row's project/code before selecting its values — set() cannot select
// an <option> that isn't currently there.
export function populateExpProjectCodeSelect(projectId, keepValue) {
  const pcSel = field('modal-expense', 'project code');
  if (!pcSel || pcSel.tagName !== 'SELECT') return;
  const codes = projectId ? (Array.isArray(state.pcodes) ? state.pcodes : []).filter(c => c.project_id === projectId) : [];
  const prev = keepValue !== undefined ? keepValue : pcSel.value;
  pcSel.innerHTML = '<option value="">Select Project Code</option>' +
    codes.map(c => `<option value="${c.code}">${c.code}</option>`).join('');
  pcSel.value = codes.some(c => c.code === prev) ? prev : '';
}

export function populateExpBillingCodeSelect(projectCodeId, keepValue) {
  const bcSel = field('modal-expense', 'billing code');
  if (!bcSel || bcSel.tagName !== 'SELECT') return;
  const codes = projectCodeId ? (Array.isArray(state.bcodes) ? state.bcodes : []).filter(b => b.project_code_id === projectCodeId) : [];
  const prev = keepValue !== undefined ? keepValue : bcSel.value;
  bcSel.innerHTML = '<option value="">Select Billing Code</option>' +
    codes.map(b => `<option value="${b.code}">${b.code}</option>`).join('');
  bcSel.value = codes.some(b => b.code === prev) ? prev : '';
}

export function populateExpenseModalDropdowns() {
  const projSel = field('modal-expense', 'project');
  if (projSel && projSel.tagName === 'SELECT') {
    const prev = projSel.value;
    projSel.innerHTML = '<option value="">Select Project</option>' +
      (Array.isArray(state.projects) ? state.projects : []).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    if (prev) projSel.value = prev;

    // Changing the project re-filters the codes below it and drops anything that no
    // longer belongs. Guarded so repeated repopulation can't stack listeners.
    if (!projSel._expWired) {
      projSel._expWired = true;
      projSel.addEventListener('change', () => {
        populateExpProjectCodeSelect(projSel.value);
        populateExpBillingCodeSelect(field('modal-expense', 'project code')?.value);
      });
    }
  }
  populateExpProjectCodeSelect(projSel?.value);

  const pcSel = field('modal-expense', 'project code');
  if (pcSel && !pcSel._expWired) {
    pcSel._expWired = true;
    pcSel.addEventListener('change', () => populateExpBillingCodeSelect(pcSel.value));
  }
  populateExpBillingCodeSelect(pcSel?.value);
}

export async function loadExpenses() {
  const rows = await get('/api/expenses' + qs(state.pf['page-expenses'])).catch(() => []);
  state.expenses = rows;

  const page = document.getElementById('page-expenses');
  if (page && (Array.isArray(state.projects) ? state.projects : []).length) {
    page.querySelectorAll('select').forEach(sel => {
      if (sel.closest('[id^="modal"]') || sel.closest('.modal')) return;
      // ExpensesPage.jsx (React) owns #page-expenses now, including its own
      // Project filter select — don't clobber it (see isReactOwned() in shared/table.js).
      if (isReactOwned(sel)) return;
      if (!(sel.options[0]?.text || '').toLowerCase().includes('all projects')) return;
      const prev = sel.value;
      sel.innerHTML = '<option value="">All Projects</option>' +
        (Array.isArray(state.projects) ? state.projects : []).map(p => `<option value="${p.id}">${p.id} — ${p.name}</option>`).join('');
      if (prev && prev !== 'All Projects') sel.value = prev;
    });
  }
  populateExpenseModalDropdowns();

  renderTable('page-expenses', rows, [
    { k: 'project_id',      fn: r => (Array.isArray(state.projects) ? state.projects : []).find(p => p.id === r.project_id)?.name || r.project_id },
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
