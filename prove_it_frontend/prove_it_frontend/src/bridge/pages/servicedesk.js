import { get, qs } from '../core/http.js';
import { state } from '../core/state.js';
import { badge, date } from '../shared/ui.js';
import { renderTable, ticketBtns } from '../shared/table.js';
import { field, setModalMode } from '../shared/modals.js';
import { can, isMine, noActionsColumn } from '../shared/permissions.js';

function ticketRowGuard(row) {
  const locked = row.status === 'Closed';
  return { noEdit: locked || !(can('Service Desk', 'edit') || isMine(row, 'requester')) };
}

// One place for the ticket modal's two personalities, so the heading, the button and
// the Status field can't drift out of sync with which mode is actually open.
export function setTicketModalMode(editing) {
  setModalMode('modal-ticket', editing
    ? { title: 'Update Service Desk Ticket', action: 'Update Ticket' }
    : { title: 'Create Service Desk Ticket', action: 'Create Ticket' });
  setTicketStatusVisible(editing);
}

// Tickets move Open -> In Progress -> Waiting Approval from the edit form's Status
// dropdown. The three end states are deliberately absent: Resolve, Close and Cancel each
// enforce something a field edit cannot (the approve permission, a prior Resolved state,
// and a mandatory audit reason respectively), so they stay on their own row buttons and
// tickets.py refuses them over PATCH.
export const TICKET_WORKFLOW_STATUSES = ['Open', 'In Progress', 'Waiting Approval'];

// `current` is the row's status. A Resolved ticket is still editable (only Closed
// locks the row), so its status has to be listed even though it is not a
// workflow state — otherwise the select would silently misreport it as Open. Picking a
// different one from there moves it back into the working states, which is allowed.
export function populateTicketStatusSelect(current) {
  const sel = field('modal-ticket', 'status');
  if (!sel || sel.tagName !== 'SELECT') return;
  const options = TICKET_WORKFLOW_STATUSES.includes(current) || !current
    ? TICKET_WORKFLOW_STATUSES
    : [current, ...TICKET_WORKFLOW_STATUSES];
  sel.innerHTML = options.map(st => `<option value="${st}">${st}</option>`).join('');
  sel.value = current || 'Open';
}

// Status is meaningless while creating — every new ticket starts Open (tickets.py sets it
// server-side) — so the field is shown only when editing rather than offering a choice
// that would be ignored.
export function setTicketStatusVisible(visible) {
  const group = document.getElementById('ticket-status-group');
  if (group) group.style.display = visible ? '' : 'none';
}

export function populateTicketProjectDropdown() {
  const sel = field('modal-ticket', 'project');
  if (!sel || sel.tagName !== 'SELECT') return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">Select Project</option>' +
    (Array.isArray(state.projects) ? state.projects : []).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
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
