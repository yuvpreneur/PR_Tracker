import { get, qs } from '../core/http.js';
import { state } from '../core/state.js';
import { badge, date } from '../shared/ui.js';
import { renderTable, ticketBtns } from '../shared/table.js';
import { field } from '../shared/modals.js';
import { can, isMine, noActionsColumn } from '../shared/permissions.js';

function ticketRowGuard(row) {
  const locked = ['Closed', 'Cancelled'].includes(row.status);
  return { noEdit: locked || !(can('Service Desk', 'edit') || isMine(row, 'requester')) };
}

function populateTicketProjectDropdown() {
  const sel = field('modal-ticket', 'project');
  if (!sel || sel.tagName !== 'SELECT') return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">Select Project</option>' +
    state.projects.map(p => `<option value="${p.id}">${p.id} · ${p.name}</option>`).join('');
  if (prev) sel.value = prev;
}

export async function loadServiceDesk() {
  const rows = await get('/api/tickets' + qs(state.pf['page-service-desk'])).catch(() => []);
  state.tickets = rows;
  populateTicketProjectDropdown();
  renderTable('page-service-desk', rows, [
    { k: 'ticket_no',    fn: r => `<strong>${r.ticket_no || r.id}</strong>` },
    { k: 'subject' },
    { k: 'project_id',   fn: r => r.project_id || '—' },
    { k: 'requester' },
    { k: 'queue',        fn: r => r.queue || '—' },
    { k: 'priority',     fn: r => badge(r.priority) },
    { k: 'status',       fn: r => badge(r.status) },
    { k: 'sla_deadline', fn: r => r.sla_deadline ? date(r.sla_deadline) : '—' },
  ], r => r.id, ticketBtns, null, {
    noDelete: true, rowGuard: ticketRowGuard, hideActionsColumn: noActionsColumn('service-desk'),
  });
  // Lets the React-based ServiceDeskPage (mounted as a portal into #page-service-desk)
  // know to refetch — it doesn't read this legacy render pipeline's output directly.
  document.dispatchEvent(new CustomEvent('service-desk:changed'));
}
