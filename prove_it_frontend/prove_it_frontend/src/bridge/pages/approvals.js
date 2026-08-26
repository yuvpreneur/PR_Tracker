import { get } from '../core/http.js';
import { state } from '../core/state.js';
import { badge, date, num } from '../shared/ui.js';
import { openModal } from '../shared/modals.js';
import { isReactOwned } from '../shared/table.js';
import { iconSvg } from '../shared/icons.js';

const TYPE_LABEL = { timesheets: 'Timesheet', expenses: 'Expense', leave: 'Leave', access: 'Access Control' };
const TYPE_COLOR = { Timesheet: '#3b82f6', Expense: '#f59e0b', Leave: '#7c3aed', 'Access Control': '#64748b' };

function describeApproval(r) {
  switch (r._mod) {
    case 'timesheets': return { name: r.name || r.emp_id, detail: `${r.hours}h – ${r.project_id} – ${date(r.entry_date)}` };
    case 'expenses':   return { name: r.submitted_by, detail: `₹${num(r.amount)} – ${r.category}${r.vendor ? ' / ' + r.vendor : ''}` };
    case 'leave':      return { name: r.name || r.emp_id, detail: `${r.leave_type} – ${date(r.from_date)} to ${date(r.to_date)} – ${r.days}d` };
    case 'access':     return { name: r.requester, detail: `Access to ${r.page}${r.project ? ' (' + r.project + ')' : ''}` };
    default:           return { name: '—', detail: '' };
  }
}

function ensureApprovalsList() {
  let list = document.getElementById('approvals-list');
  if (list) return list;
  const card = document.querySelector('#page-approvals .card');
  // ApprovalsPage.jsx (React) owns #page-approvals now — its Pending Approvals
  // card matches this same selector. Bail rather than tearing out React-managed
  // children (see isReactOwned() in shared/table.js for why that corrupts things).
  if (!card || isReactOwned(card)) return null;
  const title = card.querySelector('.card-section-title');
  Array.from(card.children).forEach(child => { if (child !== title) child.remove(); });
  list = document.createElement('div');
  list.id = 'approvals-list';
  card.appendChild(list);
  return list;
}

export function renderApprovalsTable(filter) {
  const list = ensureApprovalsList();
  if (!list) return;
  const rows = filter ? state.approvalsAll.filter(r => r._mod === filter) : state.approvalsAll;
  list.innerHTML = rows.length
    ? rows.map(r => {
        const { name, detail } = describeApproval(r);
        return `<div class="approval-item">
          ${badge(TYPE_LABEL[r._mod] || r._mod, TYPE_COLOR)}
          <div class="approval-info">
            <div class="approval-name">${name}</div>
            <div class="approval-detail">${detail}</div>
          </div>
          <div class="approval-actions">
            <button class="btn btn-success btn-sm bridge-approve" data-module="${r._mod}" data-id="${r.id}">${iconSvg('Check')} Approve</button>
            <button class="btn btn-danger btn-sm bridge-reject" data-module="${r._mod}" data-id="${r.id}">${iconSvg('X')} Reject</button>
            <button class="btn btn-ghost btn-sm bridge-view" data-module="${r._mod}" data-id="${r.id}">${iconSvg('Eye')} View</button>
          </div>
        </div>`;
      }).join('')
    : `<div style="text-align:center;padding:32px;color:#94a3b8;font-size:13px">No pending ${filter ? (TYPE_LABEL[filter] || filter) : ''} approvals</div>`;
}

export async function loadApprovals() {
  const data = await get('/api/approvals/pending').catch(() => null);
  if (!data) return;

  state.approvalsAll = [
    ...(data.timesheets      || []).map(r => ({ ...r, _mod: 'timesheets' })),
    ...(data.expenses        || []).map(r => ({ ...r, _mod: 'expenses' })),
    ...(data.leave           || []).map(r => ({ ...r, _mod: 'leave' })),
    ...(data.access_requests || []).map(r => ({ ...r, _mod: 'access' })),
  ];

  const ts    = (data.timesheets      || []).length;
  const exp   = (data.expenses        || []).length;
  const leave = (data.leave           || []).length;
  const acc   = (data.access_requests || []).length;
  const elTs    = document.getElementById('appr-stat-ts');
  const elExp   = document.getElementById('appr-stat-exp');
  const elLeave = document.getElementById('appr-stat-leave');
  const elAcc   = document.getElementById('appr-stat-access');
  if (elTs)    elTs.textContent    = ts;
  if (elExp)   elExp.textContent   = exp;
  if (elLeave) elLeave.textContent = leave;
  if (elAcc)   elAcc.textContent   = acc;

  const filter = document.getElementById('appr-type-filter')?.value || '';
  renderApprovalsTable(filter);

  const sel = document.getElementById('appr-type-filter');
  if (sel && !sel._wired) {
    sel._wired = true;
    sel.addEventListener('change', () => renderApprovalsTable(sel.value));
  }
  // Lets the React-based ApprovalsPage (mounted as a portal into #page-approvals)
  // know to refetch — it doesn't read this legacy render pipeline's output directly.
  document.dispatchEvent(new CustomEvent('approvals:changed'));
}

function ensureApprovalViewModal() {
  if (document.getElementById('modal-approval-view')) return;
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.id = 'modal-approval-view';
  el.innerHTML =
    '<div class="modal">' +
      '<div class="modal-header"><h3>Approval Details</h3><button class="modal-close" onclick="closeModal(\'modal-approval-view\')">×</button></div>' +
      '<div class="form-grid" id="approval-view-body"></div>' +
      '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'modal-approval-view\')">Close</button></div>' +
    '</div>';
  document.body.appendChild(el);
  el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
}

export function openApprovalView(row) {
  ensureApprovalViewModal();
  const field = (label, value) =>
    `<div class="form-group"><label class="form-label">${label}</label>` +
    `<div style="padding:9px 12px;background:rgba(232,96,122,.08);border-radius:8px;font-size:14px">${value ?? '—'}</div></div>`;

  let fields = field('Type', TYPE_LABEL[row._mod] || row._mod);
  if (row._mod === 'timesheets') {
    fields += field('Employee', row.name || row.emp_id) + field('Project', row.project_id) +
      field('Hours', `${row.hours}h`) + field('Date', date(row.entry_date));
  } else if (row._mod === 'expenses') {
    fields += field('Submitted By', row.submitted_by) + field('Category', row.category) +
      field('Amount', `₹${row.amount.toLocaleString('en-IN')}`) + field('Vendor', row.vendor || '—') +
      field('Project', row.project_id) + field('Date', date(row.expense_date)) +
      field('Stage', row.status === 'Pending Finance' ? 'Awaiting Finance (policy + payment)' : 'Awaiting Manager (business purpose)');
  } else if (row._mod === 'leave') {
    fields += field('Employee', row.name || row.emp_id) + field('Type', row.leave_type) +
      field('From', date(row.from_date)) + field('To', date(row.to_date)) + field('Days', row.days) +
      field('Reason', row.reason || '—');
  } else if (row._mod === 'access') {
    fields += field('Requester', row.requester) +
      (row.request_type === 'project'
        ? field('Requested Project', row.project_id)
        : field('Page', row.page) + field('Project Context', row.project || '—')) +
      field('Reason', row.reason || '—');
  }
  document.getElementById('approval-view-body').innerHTML = fields;
  openModal('modal-approval-view');
}
