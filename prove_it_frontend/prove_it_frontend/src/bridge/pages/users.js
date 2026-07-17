import { get, qs } from '../core/http.js';
import { state } from '../core/state.js';
import { badge } from '../shared/ui.js';
import { renderTable } from '../shared/table.js';
import { noActionsColumn } from '../shared/permissions.js';

export async function loadUsers() {
  const rows = await get('/api/users' + qs(state.pf['page-users'])).catch(() => []);
  state.users = rows;
  renderTable('page-users', rows, [
    { k: 'username', fn: r => `<strong>${r.username}</strong>` },
    { k: 'name' },
    { k: 'email' },
    { k: 'role',      fn: r => badge(r.role) },
    { k: 'projects',  fn: () => '—' },
    { k: 'is_active', fn: r => badge(r.is_active ? 'Active' : 'Inactive') },
  ], r => r.id, () => '', null, {
    noEdit: state.currentUser?.role !== 'Admin', noDelete: state.currentUser?.role !== 'Admin',
    hideActionsColumn: noActionsColumn('users'),
  });
  // Lets the React-based UsersPage (mounted as a portal into #page-users) know to
  // refetch — it doesn't read this legacy render pipeline's output directly.
  document.dispatchEvent(new CustomEvent('users:changed'));
}
