import { get, post, patch, qs } from '../core/http.js';
import { state } from '../core/state.js';
import { username } from '../core/cache.js';
import { badge, date, num, toast } from '../shared/ui.js';
import { renderTable } from '../shared/table.js';
import { closeModal, openModal } from '../shared/modals.js';
import { can, isMine, noActionsColumn } from '../shared/permissions.js';

function leadRowGuard(row) {
  return {
    noEdit: !(can('Lead Management', 'edit') || isMine(row, 'owner')),
    noDelete: !can('Lead Management', 'delete'),
  };
}

export async function loadLeads() {
  const rows = await get('/api/leads' + qs(state.pf['page-leads'])).catch(() => []);
  state.leads = rows;
  renderTable('page-leads', rows, [
    { k: 'lead_id',       fn: r => `<strong>${r.lead_id}</strong>` },
    { k: 'company' },
    { k: 'value',         fn: r => `₹${num(r.value)}` },
    { k: 'source',        fn: r => r.source || '—' },
    { k: 'owner',         fn: r => `<span class="owner-chip">${r.owner}</span>` },
    { k: 'access',        fn: () => '—' },
    { k: 'stage',         fn: r => badge(r.stage) },
    { k: 'followup_date', fn: r => r.followup_date ? date(r.followup_date) : '—' },
  ], r => r.lead_id, () => '', '#page-leads .table-wrap table tbody', {
    rowGuard: leadRowGuard, hideActionsColumn: noActionsColumn('leads'),
  });
  // Lets the React-based LeadsPage (mounted as a portal into #page-leads) know to
  // refetch — it doesn't read this legacy render pipeline's output directly.
  document.dispatchEvent(new CustomEvent('leads:changed'));
}

function populateLeadProjectsSelect() {
  const select = document.getElementById('edit-lead-projects');
  if (!select) return;
  const names = [...new Set(state.projects.map(p => p.name).filter(Boolean))].sort();
  if (names.length) select.innerHTML = names.map(n => `<option>${n}</option>`).join('');
}

async function loadLeadNotes(leadId) {
  const box = document.getElementById('lead-note-timeline');
  if (!box) return;
  const notes = await get(`/api/leads/${leadId}/notes`).catch(() => []);
  box.innerHTML = notes.length
    ? notes.map(n => `<div class="lead-note"><div class="lead-note-head"><span>${n.by}</span><span>${n.at}</span></div><div class="lead-note-body">${n.text}</div></div>`).join('')
    : '<div style="color:#94a3b8;font-size:12px;padding:8px 0">No notes yet.</div>';
}

export function openLeadEditor(row) {
  document.getElementById('edit-lead-id').value = row.lead_id;
  document.getElementById('edit-lead-company').value = row.company || '';
  document.getElementById('edit-lead-contact').value = row.contact || '';
  document.getElementById('edit-lead-email').value = row.email || '';
  document.getElementById('edit-lead-value').value = row.value ?? 0;
  document.getElementById('edit-lead-followup').value = row.followup_date || '';
  populateLeadProjectsSelect();
  const ownerSel = document.getElementById('edit-lead-owner');
  if (ownerSel) ownerSel.value = row.owner || '';
  const stageSel = document.getElementById('edit-lead-stage');
  if (stageSel) stageSel.value = row.stage || 'New';
  const projSelect = document.getElementById('edit-lead-projects');
  if (projSelect) Array.from(projSelect.options).forEach(o => { o.selected = (row.projects || []).includes(o.value || o.textContent); });
  const pillsBox = document.getElementById('edit-lead-project-pills');
  if (pillsBox) pillsBox.innerHTML = (row.projects || []).map(p => `<span class="project-pill">${p}</span>`).join('');
  const noteInput = document.getElementById('lead-note-input');
  if (noteInput) noteInput.value = '';
  loadLeadNotes(row.lead_id);
  openModal('modal-lead-edit');
}

function wireLeadAssignmentFilter() {
  const sel = Array.from(document.querySelectorAll('#page-leads .lead-controls select'))
    .find(s => (s.options[0]?.text || '').toLowerCase().includes('my assigned leads'));
  if (!sel) return;
  sel.addEventListener('change', () => {
    const mine = sel.value === 'My Assigned Leads' || sel.value === 'Self Added Leads';
    state.pf['page-leads'] = { ...state.pf['page-leads'], owner: mine ? username() : undefined };
    loadLeads();
  });
}

function wireLeadRefreshButton() {
  const btn = document.getElementById('leads-refresh-btn');
  if (!btn) return;
  btn.addEventListener('click', () => { loadLeads(); toast('Leads refreshed'); });
}

export function wireLeadManager() {
  wireLeadAssignmentFilter();
  wireLeadRefreshButton();

  window.saveLeadDetails = async function () {
    const id = document.getElementById('edit-lead-id')?.value;
    if (!id) return;
    const projSelect = document.getElementById('edit-lead-projects');
    const projects = Array.from(projSelect?.selectedOptions || []).map(o => o.value || o.textContent).join(',');
    const body = {
      company:       document.getElementById('edit-lead-company')?.value,
      contact:       document.getElementById('edit-lead-contact')?.value   || null,
      email:         document.getElementById('edit-lead-email')?.value     || null,
      value:         parseFloat(document.getElementById('edit-lead-value')?.value) || 0,
      owner:         document.getElementById('edit-lead-owner')?.value,
      stage:         document.getElementById('edit-lead-stage')?.value,
      followup_date: document.getElementById('edit-lead-followup')?.value  || null,
      projects:      projects || null,
    };
    try { await patch(`/api/leads/${id}`, body); toast('Lead saved'); closeModal('modal-lead-edit'); loadLeads(); }
    catch { /* toast shown by patch */ }
  };

  window.addLeadNote = async function () {
    const id = document.getElementById('edit-lead-id')?.value;
    const inp = document.getElementById('lead-note-input');
    const note = inp?.value?.trim();
    if (!id || !note) return;
    try { await post(`/api/leads/${id}/notes`, { text: note }); if (inp) inp.value = ''; loadLeadNotes(id); toast('Note added'); }
    catch { /* toast shown by post */ }
  };
}
