import { get, qs } from '../core/http.js';
import { state } from '../core/state.js';
import { badge } from '../shared/ui.js';
import { renderTable } from '../shared/table.js';
import { can, noActionsColumn } from '../shared/permissions.js';

export async function loadCompanies() {
  const rows = await get('/api/companies' + qs(state.pf['page-companies'])).catch(() => []);
  if (rows.length) state.companies = rows;
  renderTable('page-companies', rows, [
    { k: 'name',             fn: r => `<strong>${r.name}</strong>` },
    { k: 'industry' },
    { k: 'primary_contact',  fn: r => r.primary_contact || '—' },
    { k: 'active_projects' },
    { k: 'status',           fn: r => badge(r.status) },
  ], r => r.id, () => '', null, {
    noEdit: !can('Companies', 'edit'), noDelete: !can('Companies', 'delete'),
    hideActionsColumn: noActionsColumn('companies'),
  });
  // Lets the React-based CompaniesPage (mounted as a portal into #page-companies)
  // know to refetch — it doesn't read this legacy render pipeline's output directly.
  document.dispatchEvent(new CustomEvent('companies:changed'));
}
