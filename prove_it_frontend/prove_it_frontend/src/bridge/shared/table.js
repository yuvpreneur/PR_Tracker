import { badge } from './ui.js';
import { can, isMine } from './permissions.js';

// True once a DOM node has been rendered/claimed by React (it stamps a
// `__reactFiber$…`/`__reactProps$…`/`__reactContainer$…` property directly onto
// every host node it manages, regardless of React version). A migrated page's
// portal-mounted DataTable renders its own <table><tbody> inside the same
// #page-<id> container this function's default selector targets — since the
// legacy per-page loader (loadProjects(), etc.) keeps running on every nav click
// (not just once at boot), an unguarded `tbody.innerHTML = …` here would silently
// overwrite React-owned rows. That doesn't fail immediately, but corrupts React's
// fiber tree: the next time that page's own state changes the row set (a filter,
// a refetch with different data), React tries to remove/reorder <tr> nodes via
// stale references and throws "removeChild ... not a child of this node",
// repeatedly, which can unmount the whole app. Bail out instead — a migrated
// page's own React component already owns rendering this table.
export function isReactOwned(el) {
  return !!el && Object.keys(el).some(k => k.startsWith('__reactFiber') || k.startsWith('__reactProps') || k.startsWith('__reactContainer'));
}

export function renderTable(pageId, rows, cols, idFn, extraBtns = () => '', tableSelector = null, opts = {}) {
  const tbody = document.querySelector(tableSelector || `#${pageId} table tbody`);
  if (!tbody || isReactOwned(tbody)) return;

  // Hide the whole Actions column (header + every row's cell) rather than leaving a
  // permanently-empty one when the current user's role can never act on this table at all.
  if (opts.hideActionsColumn !== undefined) {
    const headerCell = tbody.closest('table')?.querySelector('thead th:last-child');
    if (headerCell) headerCell.style.display = opts.hideActionsColumn ? 'none' : '';
  }

  if (!rows.length) {
    const colspan = cols.length + (opts.hideActionsColumn ? 0 : 1);
    tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center;padding:32px;color:#94a3b8;font-size:13px">No records found</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(row => {
    const id = idFn(row);
    // rowGuard lets self-service pages override noEdit/noDelete per row (e.g. an
    // Employee may edit their OWN pending entry even without blanket edit permission).
    const rowOpts = opts.rowGuard ? { ...opts, ...opts.rowGuard(row) } : opts;
    const cells = cols.map(c => `<td style="font-size:13px;padding:10px 12px">${c.fn ? c.fn(row) : (row[c.k] ?? '—')}</td>`).join('');
    if (opts.hideActionsColumn) {
      return `<tr data-id="${id}" style="border-bottom:1px solid #f1f5f9">${cells}</tr>`;
    }
    const actions =
      (rowOpts.noEdit ? '' : `<button class="btn btn-xs bridge-edit" data-page="${pageId}" data-id="${id}" title="Edit" style="padding:3px 9px;font-size:11px;margin-right:3px;border-radius:6px">✏️</button>`) +
      (rowOpts.noDelete ? '' : `<button class="btn btn-xs bridge-delete" data-page="${pageId}" data-id="${id}" title="Delete" style="padding:3px 9px;font-size:11px;color:#ef4444;border-radius:6px">🗑️</button>`) +
      extraBtns(row, id, pageId);
    return `<tr data-id="${id}" style="border-bottom:1px solid #f1f5f9">${cells}<td style="padding:8px 12px;white-space:nowrap">${actions}</td></tr>`;
  }).join('');
}

// Factory — module/ownerField vary per page (e.g. Timesheets/Leave denormalize
// the submitter's name onto `name`, Expenses onto `submitted_by`). Suppresses the buttons
// when the role lacks approve permission on that module, or the row is the caller's own
// (self-approval is blocked backend-side too — never offer it as an option here).
export function approveBtns(module, ownerField = 'name') {
  return (row, id, pageId) => {
    const s = row.status || row.approval_status || '';
    if (s !== 'Pending') return '';
    if (!can(module, 'approve') || isMine(row, ownerField)) return '';
    return `<button class="btn btn-xs bridge-approve" data-page="${pageId}" data-id="${id}" style="padding:3px 9px;font-size:11px;color:#22c55e;margin-left:3px;border-radius:6px">✓ Approve</button>` +
           `<button class="btn btn-xs bridge-reject"  data-page="${pageId}" data-id="${id}" style="padding:3px 9px;font-size:11px;color:#ef4444;border-radius:6px">✗ Reject</button>`;
  };
}

export function ticketBtns(row, id, pageId) {
  const canManage = can('Service Desk', 'approve');
  const mine = isMine(row, 'requester');
  if (['Open', 'In Progress', 'Waiting Approval'].includes(row.status)) {
    if (!canManage) return '';
    return `<button class="btn btn-xs bridge-resolve" data-page="${pageId}" data-id="${id}" style="padding:3px 9px;font-size:11px;color:#22c55e;margin-left:3px;border-radius:6px">✓ Resolve</button>`;
  }
  if (row.status === 'Resolved') {
    if (!canManage && !mine) return '';
    return `<button class="btn btn-xs bridge-close" data-page="${pageId}" data-id="${id}" style="padding:3px 9px;font-size:11px;color:#64748b;margin-left:3px;border-radius:6px">Close</button>`;
  }
  return '';
}
