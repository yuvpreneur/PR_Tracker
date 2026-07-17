import { get, qs } from '../core/http.js';
import { state } from '../core/state.js';
import { badge, date, setText } from '../shared/ui.js';
import { renderTable, approveBtns } from '../shared/table.js';
import { field } from '../shared/modals.js';
import { noActionsColumn } from '../shared/permissions.js';

function populateLeaveEmployeeDropdown() {
  const sel = field('modal-leave', 'employee');
  if (!sel || sel.tagName !== 'SELECT') return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">Select Employee</option>' +
    state.employees.map(e => `<option value="${e.emp_id}">${e.emp_id} - ${e.name}</option>`).join('');
  if (prev) sel.value = prev;
}

export async function loadLeave() {
  const rows = await get('/api/leave' + qs(state.pf['page-leave'])).catch(() => []);
  populateLeaveEmployeeDropdown();

  const summary = await get('/api/leave/summary').catch(() => null);
  if (summary) {
    setText('leave-stat-balance', `${summary.balance} days`);
    setText('leave-stat-pending', String(summary.pending));
    setText('leave-stat-taken', `${summary.taken_this_year} days`);
  }

  renderTable('page-leave', rows, [
    { k: 'name' },
    { k: 'leave_type' },
    { k: 'from_date', fn: r => date(r.from_date) },
    { k: 'to_date',   fn: r => date(r.to_date) },
    { k: 'days' },
    { k: 'status',    fn: r => badge(r.status) },
  ], r => r.id, approveBtns('Leave', 'name'), null, {
    noEdit: true, noDelete: true, hideActionsColumn: noActionsColumn('leave'),
  });
  // Lets the React-based LeavePage (mounted as a portal into #page-leave) know to
  // refetch — it doesn't read this legacy render pipeline's output directly.
  document.dispatchEvent(new CustomEvent('leave:changed'));
}
