import { get, qs } from '../core/http.js';
import { state } from '../core/state.js';
import { renderTable } from '../shared/table.js';
import { can, noActionsColumn } from '../shared/permissions.js';

export async function loadCustomers() {
  const rows = await get('/api/companies' + qs(state.pf['page-customers'])).catch(() => []);
  if (rows.length) state.companies = rows;
  renderTable('page-customers', rows, [
    { k: 'name',            fn: r => `<strong>${r.name}</strong>` },
    { k: 'primary_contact', fn: r => r.primary_contact || '—' },
    { k: 'email',           fn: r => r.email || '—' },
    { k: 'active_projects' },
    { k: 'lifetime_value',  fn: r => `₹${r.lifetime_value.toLocaleString('en-IN')}` },
  ], r => r.id, () => '', null, {
    noEdit: !can('Companies', 'edit'), noDelete: !can('Companies', 'delete'),
    hideActionsColumn: noActionsColumn('customers'),
  });
  // Lets the React-based CustomersPage (mounted as a portal into #page-customers)
  // know to refetch — it doesn't read this legacy render pipeline's output directly.
  document.dispatchEvent(new CustomEvent('customers:changed'));
}
