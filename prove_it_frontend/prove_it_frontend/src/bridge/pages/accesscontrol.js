import { get, post } from '../core/http.js';
import { state } from '../core/state.js';
import { toast } from '../shared/ui.js';
import { field, set, closeModal } from '../shared/modals.js';
import { PAGE_MODULE_MAP } from '../shared/permissions.js';

// Mirrors app.core.permissions.MODULES exactly — every module the dynamic Roles &
// Permissions matrix knows about is individually grantable/deniable here per employee.
// (Dashboard/Users/Roles/Access Control/Audit/Settings are deliberately not part of this
// list — they're always-visible or hardcoded-Admin-only regardless of Page Access.)
const PAGES = [
  'Companies', 'Projects', 'Project Codes', 'Billing Codes', 'Employees', 'Hourly Costs',
  'Timesheets', 'Expenses', 'Attendance', 'Leave', 'Service Desk', 'Receivables',
  'Lead Management', 'Reports', 'Approvals',
];

function accessCard(n) {
  return document.querySelectorAll('#page-access-control .access-grid .access-card')[n];
}

function populateEmployeeSelect() {
  const sel = accessCard(0)?.querySelector('select.form-control');
  if (!sel || !state.employees.length) return;
  const prev = sel.value;
  sel.innerHTML = state.employees.map(e => `<option value="${e.emp_id}">${e.name} · ${e.designation || e.role || e.department || ''}</option>`).join('');
  if (prev) sel.value = prev;
}

async function loadPageAccess(empId) {
  const list = accessCard(0)?.querySelector('.access-list');
  if (!list) return;
  const rows = empId ? await get(`/api/access-control/pages/${empId}`).catch(() => []) : [];
  const allowed = new Set(rows.filter(r => r.allowed).map(r => r.page));
  list.innerHTML = PAGES.map(p =>
    `<label><input type="checkbox" data-page="${p}" ${allowed.has(p) ? 'checked' : ''}> ${p}</label>`).join('');
}

async function savePageAccess() {
  const empId = accessCard(0)?.querySelector('select.form-control')?.value;
  if (!empId) { toast('Select an employee first', 'error'); return; }
  const boxes = accessCard(0).querySelectorAll('.access-list input[type="checkbox"]');
  const permissions = Array.from(boxes).map(cb => ({ page: cb.dataset.page, allowed: cb.checked }));
  await post('/api/access-control/pages', { emp_id: empId, permissions });
  toast('Page access saved');
}

async function loadProjectAccess(empId) {
  const list = accessCard(1)?.querySelector('.project-list');
  if (!list || !state.projects.length) return;
  const rows = empId ? await get(`/api/access-control/projects/${empId}`).catch(() => []) : [];
  const allowed = new Set(rows.filter(r => r.allowed).map(r => r.project_id));
  list.innerHTML = state.projects.map(p =>
    `<label><input type="checkbox" data-project="${p.id}" ${allowed.has(p.id) ? 'checked' : ''}> ${p.name}</label>`).join('');
}

async function saveProjectAccess() {
  const empId = accessCard(0)?.querySelector('select.form-control')?.value;
  if (!empId) { toast('Select an employee first', 'error'); return; }
  const boxes = accessCard(1).querySelectorAll('.project-list input[type="checkbox"]');
  const permissions = Array.from(boxes).map(cb => ({ project_id: cb.dataset.project, allowed: cb.checked }));
  await post('/api/access-control/projects', { emp_id: empId, permissions });
  toast('Project access saved');
}

async function refreshForSelectedEmployee() {
  const empId = accessCard(0)?.querySelector('select.form-control')?.value;
  await Promise.all([loadPageAccess(empId), loadProjectAccess(empId)]);
}

function requestBadgeClass(status) {
  return status === 'Approved' ? 'badge-green' : status === 'Rejected' ? 'badge-red' : 'badge-amber';
}

export async function loadAccessRequests() {
  const rows = await get('/api/access-control/requests').catch(() => []);
  state.accessRequests = rows;
  const list = document.getElementById('access-request-list');
  if (!list) return;
  list.innerHTML = rows.length ? rows.map(r => {
    const actions = r.status === 'Pending'
      ? `<button class="btn btn-success btn-sm bridge-req-approve" data-id="${r.id}">Approve</button> <button class="btn btn-danger btn-sm bridge-req-reject" data-id="${r.id}">Reject</button>`
      : `<button class="btn btn-ghost btn-sm bridge-req-audit" data-requester="${r.requester}">Audit</button>`;
    return `<div class="request-row"><strong>${r.requester} requested ${r.page}</strong><span class="badge ${requestBadgeClass(r.status)}">${r.status}</span><span>${r.project || '—'}</span><div>${actions}</div></div>`;
  }).join('') : `<div style="text-align:center;padding:20px;color:#94a3b8;font-size:13px">No access requests</div>`;
}

// ── Lead Management Projects (saved reference config — does not gate real lead creation) ──

function populateLeadProjectSelect() {
  const sel = document.getElementById('lead-project-select');
  if (!sel || !state.projects.length) return;
  const prev = sel.value;
  sel.innerHTML = state.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  if (prev) sel.value = prev;
}

async function loadLeadProjectSettings() {
  const box = document.getElementById('lead-project-map');
  if (!box) return;
  const rows = await get('/api/access-control/lead-project-settings').catch(() => []);
  box.innerHTML = rows.map(r => {
    const proj = state.projects.find(p => p.id === r.project_id);
    return `<div class="lead-project-row"><div><strong>${proj ? proj.name : r.project_id}</strong><small>Default stage: ${r.default_stage}</small></div><span class="badge badge-green">Active</span></div>`;
  }).join('');
}

async function addLeadProjectSetting() {
  const projectId = document.getElementById('lead-project-select')?.value;
  const stage = document.getElementById('lead-project-stage')?.value || 'New';
  if (!projectId) { toast('Select a project first', 'error'); return; }
  await post('/api/access-control/lead-project-settings', { project_id: projectId, default_stage: stage });
  toast('Saved to Lead Management');
  loadLeadProjectSettings();
}

// ── Custom Pages (saved config only — does not add a working page/nav item to the app) ──

function populateCustomPageProjectList() {
  const container = document.querySelector('#modal-page .project-list');
  if (container && state.projects.length) {
    container.innerHTML = state.projects.map(p => `<label><input type="checkbox" value="${p.id}"> ${p.name}</label>`).join('');
  }
}

export async function saveCustomPage() {
  const name = field('modal-page', 'page name')?.value?.trim();
  if (!name) { toast('Page Name required', 'error'); return; }
  const icon = field('modal-page', 'page icon')?.value?.trim() || null;
  const visibility = field('modal-page', 'default visibility')?.value || 'Admin only';
  const projectBoxes = Array.from(document.querySelectorAll('#modal-page .project-list input[type="checkbox"]:checked'));
  const accessBoxes = Array.from(document.querySelectorAll('#modal-page .access-list input[type="checkbox"]:checked'));

  await post('/api/access-control/custom-pages', {
    name, icon, visibility,
    projects: projectBoxes.map(cb => cb.value),
    initial_access: accessBoxes.map(cb => cb.closest('label').textContent.trim()),
  });
  toast('Page configuration saved (reference only — not added to the live navigation)');
  closeModal('modal-page');
  loadCustomPages();
}

function customPageBadgeClass(visibility) {
  return visibility === 'Admin only' ? 'badge-muted' : 'badge-green';
}

async function loadCustomPages() {
  const rows = await get('/api/access-control/custom-pages').catch(() => []);
  // AccessControlPage.jsx (React) owns #page-access-control now and has no
  // '#custom-pages-list' id to find (deliberately, so this DOM write below just
  // no-ops instead of clobbering React-managed content) — it listens for this
  // event instead to refetch and render its own Custom Pages list.
  document.dispatchEvent(new CustomEvent('custom-pages:changed'));
  const list = document.getElementById('custom-pages-list');
  if (!list) return;
  list.innerHTML = rows.length ? rows.map(p => `
    <div class="lead-project-row">
      <div><strong>${p.icon ? p.icon + ' ' : ''}${p.name}</strong><small>${(p.projects || []).length} project(s) · ${(p.initial_access || []).length} role(s) granted</small></div>
      <span class="badge ${customPageBadgeClass(p.visibility)}">${p.visibility}</span>
    </div>`).join('')
    : `<div style="text-align:center;padding:14px;color:#94a3b8;font-size:13px">No custom pages configured yet</div>`;
}

// The "New Page Name" / "Visible To" fields sitting directly on the Custom Pages card
// were previously pure decoration — never read by anything. Clicking "Configure Page" now
// carries them into the real modal instead of discarding them.
function prefillCustomPageModal() {
  const card = accessCard(3);
  if (!card) return;
  const name = card.querySelector('.form-group input.form-control')?.value?.trim();
  const visibility = card.querySelector('.form-group select.form-control')?.value;
  if (name) set('modal-page', 'page name', name);
  if (visibility) set('modal-page', 'default visibility', visibility);
}

// ── Access Requests (No Access page's "Request Access" flow) ─────────────────────

export async function submitPageAccessRequest() {
  const pageId = state.blockedPageId;
  const module = pageId ? PAGE_MODULE_MAP[pageId] : null;
  if (!module) { toast('This page cannot be requested', 'error'); return; }
  const project = document.getElementById('request-project-context')?.value || null;
  const reason = document.getElementById('request-access-reason')?.value?.trim() || null;
  await post('/api/access-control/requests', { page: module, project, reason });
  toast('Access request submitted — an Admin will review it');
  loadAccessRequests();
}

// "+ Assign Project" (page header) used to open the unrelated "Create New Project" form.
// Assigning project access to an employee is what the Assigned Projects card already does
// — this just brings it into view instead of opening the wrong modal.
function focusAssignedProjectsCard() {
  accessCard(1)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  accessCard(0)?.querySelector('select.form-control')?.focus();
}

export async function loadAccessControl() {
  populateEmployeeSelect();
  populateLeadProjectSelect();
  populateCustomPageProjectList();
  await Promise.all([refreshForSelectedEmployee(), loadAccessRequests(), loadLeadProjectSettings(), loadCustomPages()]);

  const empSelect = accessCard(0)?.querySelector('select.form-control');
  if (empSelect && !empSelect._wired) { empSelect._wired = true; empSelect.addEventListener('change', refreshForSelectedEmployee); }

  const saveBtn = accessCard(0)?.querySelector('.btn-primary');
  if (saveBtn && !saveBtn._wired) { saveBtn._wired = true; saveBtn.addEventListener('click', savePageAccess); }

  const updateBtn = accessCard(1)?.querySelector('.btn-primary');
  if (updateBtn && !updateBtn._wired) { updateBtn._wired = true; updateBtn.addEventListener('click', saveProjectAccess); }

  const leadBtn = accessCard(2)?.querySelector('.btn-primary');
  if (leadBtn && !leadBtn._wired) {
    leadBtn._wired = true;
    leadBtn.removeAttribute('onclick');
    leadBtn.addEventListener('click', addLeadProjectSetting);
  }

  const configureBtn = accessCard(3)?.querySelector('.btn-primary');
  if (configureBtn && !configureBtn._wired) { configureBtn._wired = true; configureBtn.addEventListener('click', prefillCustomPageModal); }

  const assignProjectBtn = document.querySelector('#page-access-control .section-header .btn-primary');
  if (assignProjectBtn && !assignProjectBtn._wired) {
    assignProjectBtn._wired = true;
    assignProjectBtn.removeAttribute('onclick');
    assignProjectBtn.addEventListener('click', focusAssignedProjectsCard);
  }
}
