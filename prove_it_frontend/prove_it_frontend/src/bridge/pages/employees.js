import { get, qs } from '../core/http.js';
import { state } from '../core/state.js';
import { badge, date } from '../shared/ui.js';
import { renderTable } from '../shared/table.js';
import { field } from '../shared/modals.js';
import { can, noActionsColumn } from '../shared/permissions.js';

export async function loadEmployees() {
  const rows = await get('/api/employees' + qs(state.pf['page-employees'])).catch(() => []);
  if (rows.length) state.employees = rows;
  renderTable('page-employees', rows, [
    { k: 'emp_id',      fn: r => `<strong>${r.emp_id}</strong>` },
    { k: 'name' },
    { k: 'department',  fn: r => r.department  || '—' },
    { k: 'designation', fn: r => r.designation || '—' },
    { k: 'email' },
    { k: 'status',      fn: r => badge(r.status) },
    { k: 'billable',    fn: r => badge(r.billable ? 'Billable' : 'Non-Billable') },
  ], r => r.emp_id, () => '', null, {
    noEdit: !can('Employees', 'edit'), noDelete: !can('Employees', 'delete'),
    hideActionsColumn: noActionsColumn('employees'),
  });
  // Lets the React-based EmployeesPage (mounted as a portal into #page-employees)
  // know to refetch — it doesn't read this legacy render pipeline's output directly.
  document.dispatchEvent(new CustomEvent('employees:changed'));
}

export function populateCostEmployeeDropdown() {
  const sel = field('modal-cost', 'employee');
  if (!sel || sel.tagName !== 'SELECT') return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">Select Employee</option>' +
    state.employees.map(e => `<option value="${e.emp_id}">${e.emp_id} - ${e.name}</option>`).join('');
  if (prev) sel.value = prev;
  // Update the React Dropdown component with new options
  const options = [
    { value: '', label: 'Select Employee' },
    ...state.employees.map(e => ({ value: e.emp_id, label: `${e.emp_id} - ${e.name}` }))
  ];
  if (typeof window.__updateDropdownOptions === 'function') {
    window.__updateDropdownOptions('modal-cost', 'employee', options);
  }
}

export async function loadHourlyCosts() {
  // Fetches its own employee roster rather than relying on state.employees having already
  // been populated by a visit to the Employees page — a role like Finance User can set
  // Hourly Costs without ever having (or being able to) open Employees, so the dropdown
  // can't depend on that page having loaded first.
  const [rows, employees] = await Promise.all([
    get('/api/hourly-costs' + qs(state.pf['page-hourly-cost'])).catch(() => []),
    get('/api/employees').catch(() => []),
  ]);
  state.hourlyCosts = rows;
  if (employees.length) state.employees = employees;
  populateCostEmployeeDropdown();
  renderTable('page-hourly-cost', rows, [
    { k: 'emp_id',         fn: r => `<strong>${r.emp_id}</strong>` },
    { k: 'name',           fn: r => r.name || r.emp_id },
    { k: 'department',     fn: r => r.department || '—' },
    { k: 'hourly_cost',    fn: r => `<strong>₹${(r.hourly_cost || 0).toLocaleString('en-IN')}</strong>` },
    { k: 'effective_from', fn: r => date(r.effective_from) },
    { k: 'effective_to',   fn: r => r.effective_to
        ? `<span style="color:#334155">${date(r.effective_to)}</span>`
        : `<span style="color:#16A36C;font-weight:600">Current</span>` },
  ], r => r.id, costHistoryBtn, null, { noEdit: !can('Hourly Costs', 'edit'), noDelete: !can('Hourly Costs', 'delete') });
  // Lets the React-based HourlyCostsPage (mounted as a portal into #page-hourly-cost)
  // know to refetch — it doesn't read this legacy render pipeline's output directly.
  document.dispatchEvent(new CustomEvent('hourly-costs:changed'));
}

function costHistoryBtn(row) {
  return `<button class="btn btn-xs bridge-cost-history" data-empid="${row.emp_id}" ` +
    `style="padding:3px 12px;font-size:11px;background:#0086AD;color:#fff;border:none;border-radius:6px;cursor:pointer;margin-left:3px">` +
    `History</button>`;
}

export function showCostHistory(empId) {
  const empName = state.employees.find(e => e.emp_id === empId)?.name || empId;
  let panel = document.getElementById('cost-history-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'cost-history-panel';
    panel.style.cssText = 'display:none;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'width:480px;max-height:70vh;overflow-y:auto;background:#fff;border-radius:14px;' +
      'box-shadow:0 16px 48px rgba(0,0,0,.2);z-index:9999;border:1px solid #e2e8f0;';
    document.body.appendChild(panel);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') panel.style.display = 'none'; });
  }
  panel.innerHTML =
    `<div style="padding:16px 20px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center">` +
      `<div><div style="font-weight:700;font-size:15px;color:#0A2431">Cost History</div>` +
      `<div style="font-size:12px;color:#7C92A1">${empId} · ${empName}</div></div>` +
      `<button onclick="document.getElementById('cost-history-panel').style.display='none'" style="background:none;border:none;font-size:22px;color:#94a3b8;cursor:pointer;line-height:1">×</button>` +
    `</div>` +
    `<div id="cost-history-body" style="padding:12px 20px"><div style="text-align:center;padding:24px;color:#94a3b8">Loading…</div></div>`;
  panel.style.display = 'block';
  get(`/api/hourly-costs?emp_id=${empId}`).then(history => {
    const body = document.getElementById('cost-history-body');
    if (!body) return;
    if (!history || !history.length) {
      body.innerHTML = '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:13px">No history found</div>';
      return;
    }
    const sorted = [...history].sort((a, b) => (b.effective_from || '') > (a.effective_from || '') ? 1 : -1);
    body.innerHTML =
      `<table style="width:100%;border-collapse:collapse;font-size:13px">` +
      `<thead><tr style="color:#7C92A1;font-size:11px;text-transform:uppercase;letter-spacing:.5px">` +
        `<th style="padding:8px;text-align:left;border-bottom:2px solid #f1f5f9">Effective From</th>` +
        `<th style="padding:8px;text-align:left;border-bottom:2px solid #f1f5f9">Effective To</th>` +
        `<th style="padding:8px;text-align:right;border-bottom:2px solid #f1f5f9">Hourly Cost</th>` +
      `</tr></thead><tbody>` +
      sorted.map((h, i) =>
        `<tr style="border-bottom:1px solid #f8fafc${i === 0 ? ';background:#f0fdf4' : ''}">` +
          `<td style="padding:10px 8px">${date(h.effective_from)}</td>` +
          `<td style="padding:10px 8px">${h.effective_to
            ? `<span style="color:#334155">${date(h.effective_to)}</span>`
            : `<span style="color:#16A36C;font-weight:600">Current</span>`}</td>` +
          `<td style="padding:10px 8px;text-align:right;font-weight:700;color:#0A2431">₹${(h.hourly_cost || 0).toLocaleString('en-IN')}/hr</td>` +
        `</tr>`
      ).join('') +
      `</tbody></table>` +
      `<div style="padding:12px 0 4px;font-size:11px;color:#94a3b8">Showing all ${sorted.length} records · Latest rate highlighted</div>`;
  }).catch(() => {
    const body = document.getElementById('cost-history-body');
    if (body) body.innerHTML = '<div style="text-align:center;padding:24px;color:#ef4444;font-size:13px">Failed to load history</div>';
  });
}
