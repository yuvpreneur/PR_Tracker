import { get, qs } from '../core/http.js';
import { state } from '../core/state.js';
import { badge, date } from '../shared/ui.js';
import { renderTable } from '../shared/table.js';
import { openModal } from '../shared/modals.js';
import { populateReceivableModalDropdowns } from './billing.js';
import { can } from '../shared/permissions.js';

function invoiceActionBtns(row, id, pageId) {
  const editBtn = can('Receivables', 'edit')
    ? `<button class="btn btn-primary btn-sm bridge-edit" data-page="${pageId}" data-id="${id}">Edit</button>`
    : '';
  return `<button class="btn btn-ghost btn-sm bridge-view" data-page="${pageId}" data-id="${id}" style="margin-right:6px">View</button>` + editBtn;
}

export async function loadInvoices() {
  const rows = await get('/api/receivables' + qs(state.pf['page-invoices'])).catch(() => []);
  state.invoices = rows;
  populateReceivableModalDropdowns();

  renderTable('page-invoices', rows, [
    { k: 'invoice_no' },
    { k: 'client' },
    { k: 'project_id',     fn: r => state.projects.find(p => p.id === r.project_id)?.name || r.project_id },
    { k: 'invoice_amount', fn: r => `₹${r.invoice_amount.toLocaleString('en-IN')}` },
    { k: 'invoice_date',   fn: r => date(r.invoice_date) },
    { k: 'status',         fn: r => badge(r.status) },
  ], r => r.id, invoiceActionBtns, null, { noEdit: true, noDelete: true });
  // Lets the React-based InvoicesPage (mounted as a portal into #page-invoices)
  // know to refetch — it doesn't read this legacy render pipeline's output directly.
  document.dispatchEvent(new CustomEvent('invoices:changed'));
}

function ensureInvoiceViewModal() {
  if (document.getElementById('modal-invoice-view')) return;
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.id = 'modal-invoice-view';
  el.innerHTML =
    '<div class="modal">' +
      '<div class="modal-header"><h3>Invoice Details</h3><button class="modal-close" onclick="closeModal(\'modal-invoice-view\')">×</button></div>' +
      '<div class="form-grid" id="invoice-view-body"></div>' +
      '<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal(\'modal-invoice-view\')">Close</button></div>' +
    '</div>';
  document.body.appendChild(el);
  el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
}

export function openInvoiceView(row) {
  ensureInvoiceViewModal();
  const projectName = state.projects.find(p => p.id === row.project_id)?.name || row.project_id;
  const field = (label, value) =>
    `<div class="form-group"><label class="form-label">${label}</label>` +
    `<div style="padding:9px 12px;background:#f8fafc;border-radius:8px;font-size:14px">${value}</div></div>`;
  document.getElementById('invoice-view-body').innerHTML =
    field('Invoice Number', row.invoice_no) +
    field('Client', row.client) +
    field('Project', projectName) +
    field('Invoice Date', date(row.invoice_date)) +
    field('Due Date', date(row.due_date)) +
    field('Invoice Amount', `₹${row.invoice_amount.toLocaleString('en-IN')}`) +
    field('Received Amount', `₹${row.received_amount.toLocaleString('en-IN')}`) +
    field('Balance', `₹${row.balance.toLocaleString('en-IN')}`) +
    field('Status', badge(row.status));
  openModal('modal-invoice-view');
}
