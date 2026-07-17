import { get, qs } from '../core/http.js';
import { state } from '../core/state.js';
import { badge, date, periodRange } from '../shared/ui.js';
import { renderTable, approveBtns, isReactOwned } from '../shared/table.js';
import { field } from '../shared/modals.js';
import { can, isMine, noActionsColumn } from '../shared/permissions.js';

function tsRowGuard(row) {
  const mine = isMine(row, 'name');
  const pending = row.status === 'Pending';
  return {
    noEdit:   !(can('Timesheets', 'edit')   || (mine && pending)),
    noDelete: !(can('Timesheets', 'delete') || (mine && pending)),
  };
}

function populateTimesheetModalDropdowns() {
  const projSel = field('modal-timesheet', 'project');
  if (projSel && projSel.tagName === 'SELECT') {
    const prev = projSel.value;
    projSel.innerHTML = '<option value="">Select Project</option>' +
      state.projects.map(p => `<option value="${p.id}">${p.id} - ${p.name}</option>`).join('');
    if (prev) projSel.value = prev;
  }
  const bcSel = field('modal-timesheet', 'billing code');
  if (bcSel && bcSel.tagName === 'SELECT') {
    const prev = bcSel.value;
    bcSel.innerHTML = '<option value="">Select Billing Code</option>' +
      state.bcodes.map(b => `<option value="${b.code}">${b.code}</option>`).join('');
    if (prev) bcSel.value = prev;
  }
}

export async function loadTimesheets() {
  const period = document.getElementById('ts-period')?.value || '';
  const range  = tsPeriodRange(period);
  const params = { ...state.pf['page-timesheets'], ...range };

  const rows = await get('/api/timesheets' + qs(params)).catch(() => []);
  state.timesheets = rows;
  populateTsFilterDropdowns();
  populateTimesheetModalDropdowns();

  renderTable('page-timesheets', rows, [
    { k: 'emp_id',          fn: r => `<strong>${r.emp_id}</strong>` },
    { k: 'name',            fn: r => r.name || r.emp_id },
    { k: 'entry_date',      fn: r => date(r.entry_date) },
    { k: 'project_id' },
    { k: 'billing_code_id', fn: r => r.billing_code_id || '—' },
    { k: 'hours',           fn: r => `<strong>${r.hours}h</strong>` },
    { k: 'billable',        fn: r => badge(r.billable ? 'Billable' : 'Non-Billable') },
    { k: 'status',          fn: r => badge(r.status) },
  ], r => r.id, approveBtns('Timesheets', 'name'), null, { rowGuard: tsRowGuard, hideActionsColumn: noActionsColumn('timesheets') });
  // Lets the React-based TimesheetsPage (mounted as a portal into #page-timesheets)
  // know to refetch — it doesn't read this legacy render pipeline's output directly.
  document.dispatchEvent(new CustomEvent('timesheets:changed'));
}

// period -> {date_from, date_to} for timesheet period selector (all-time = no filter)
function tsPeriodRange(period) {
  if (!period) return {};
  return periodRange(period);
}

function populateTsFilterDropdowns() {
  const page = document.getElementById('page-timesheets');
  if (!page) return;
  page.querySelectorAll('select').forEach(sel => {
    if (sel.id === 'ts-period') return;
    if (sel.closest('[id^="modal"]') || sel.closest('.modal')) return;
    // TimesheetsPage.jsx (React) owns #page-timesheets now, including its own
    // Project/Billing Code filter selects — don't clobber them (see isReactOwned()
    // in shared/table.js).
    if (isReactOwned(sel)) return;
    const txt  = (sel.options[0]?.text || '').toLowerCase();
    const prev = sel.value;

    if (txt.includes('all projects') && state.projects.length) {
      sel.innerHTML = '<option value="">All Projects</option>' +
        state.projects.map(p => `<option value="${p.id}">${p.id} — ${p.name}</option>`).join('');
      if (prev && prev !== 'All Projects') sel.value = prev;
    } else if (txt.includes('all billing codes') && state.bcodes.length) {
      const usedCodes = [...new Set(state.bcodes.map(b => b.code))].sort();
      sel.innerHTML = '<option value="">All Billing Codes</option>' +
        usedCodes.map(c => `<option value="${c}">${c}</option>`).join('');
      if (prev && prev !== 'All Billing Codes') sel.value = prev;
    }
  });
}
