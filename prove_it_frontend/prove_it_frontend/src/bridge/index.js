// Bridge entry point — imports all modules and wires everything together
import { createElement, icons } from 'lucide';
import { get, post, patch, del, uploadFile } from './core/http.js';
import { state } from './core/state.js';
import { refreshCaches, username } from './core/cache.js';
import { viewAs } from '../services/authService.js';
import { toast } from './shared/ui.js';
import { canViewPage, canCreateOnPage, canExportOnPage } from './shared/permissions.js';
import { wireBtn, closeModal, startCreate, startEdit, editId, openModal, set, val } from './shared/modals.js';
import { ensureNotifPanel, loadNotifications, refreshNotifBadge } from './shared/notifications.js';
import { populateFilterDropdowns, wireFilters } from './shared/filters.js';
import { loadDashboard } from './pages/dashboard.js';
import { loadCompanies } from './pages/companies.js';
import { loadCustomers } from './pages/customers.js';
import { loadProjects, loadProjectCodes } from './pages/projects.js';
import { loadBillingCodes, loadReceivables, populateRecvBillingCodeSelect } from './pages/billing.js';
import { loadEmployees, loadHourlyCosts, showCostHistory } from './pages/employees.js';
import { loadTimesheets, populateTsProjectCodeSelect } from './pages/timesheets.js';
import { loadLeave } from './pages/leave.js';
import { loadExpenses } from './pages/expenses.js';
import { loadInvoices, openInvoiceView } from './pages/invoices.js';
import { loadServiceDesk } from './pages/servicedesk.js';
import { loadApprovals, openApprovalView } from './pages/approvals.js';
import { loadUsers } from './pages/users.js';
import { loadAccessRequests, submitPageAccessRequest } from './pages/accesscontrol.js';
import { loadAudit } from './pages/audit.js';
import { openReportView, handleReportExport } from './pages/reports.js';

const ATTACH_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
const ATTACH_MAX_BYTES = 10 * 1024 * 1024; // 10MB — matches the backend's limit

// Renders a lucide icon node as a real inline SVG element (the vanilla `lucide`
// package's DOM-building API — this file is plain JS run outside React, so
// lucide-react's <Icon/> components aren't usable here).
function lucideIcon(iconNode, opts = {}) {
  return createElement(iconNode, { width: 16, height: 16, 'stroke-width': 2, ...opts });
}

function setFileLabel(label, defaultText, fileName) {
  if (!label) return;
  if (!fileName) { label.textContent = defaultText; return; }
  label.replaceChildren(lucideIcon(icons.FileText), document.createTextNode(' ' + fileName));
}

function validAttachment(file) {
  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
  if (!ATTACH_EXTENSIONS.includes(ext)) { toast('Only PDF, JPG, PNG or WEBP files are allowed', 'error'); return false; }
  if (file.size > ATTACH_MAX_BYTES) { toast('Attachment must be smaller than 10MB', 'error'); return false; }
  return true;
}

// Wires the click-to-browse + drag & drop behavior for a modal's attach-zone. The
// native file input (input[type=file] inside the zone) stays the single source of
// truth for the picked file — drop just writes into it via DataTransfer — so
// resetFields()'s generic `el.value = ''` pass clears it same as any other field.
function wireAttachZone(modalId) {
  const modal = document.getElementById(modalId);
  const zone = modal?.querySelector('.attach-zone[data-default-label]');
  const input = zone?.querySelector('input[type="file"]');
  if (!zone || !input) return;
  const label = zone.querySelector('[data-attach-label]');
  const showFile = f => setFileLabel(label, zone.dataset.defaultLabel, f?.name);
  zone.addEventListener('click', e => { if (e.target !== input) input.click(); });
  input.addEventListener('change', () => {
    const f = input.files[0];
    if (f && !validAttachment(f)) { input.value = ''; showFile(null); return; }
    showFile(f);
  });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (!f || !validAttachment(f)) return;
    const dt = new DataTransfer();
    dt.items.add(f);
    input.files = dt.files;
    showFile(f);
  });
}

// Sidebar nav icons — appMarkup.js's NAV_ITEMS carries an emoji `icon` per page
// (baked into the legacy HTML string as a template literal), which we don't touch
// directly; instead this maps each page id to a lucide icon and repaints
// `.nav-icon` in place, whatever (re)builds the nav.
const NAV_ICON_MAP = {
  dashboard: icons.LayoutDashboard,
  reports: icons.ChartColumn,
  companies: icons.Building2,
  projects: icons.FolderKanban,
  'project-codes': icons.Tag,
  'billing-codes': icons.CreditCard,
  'service-desk': icons.LifeBuoy,
  employees: icons.Users,
  'hourly-cost': icons.Banknote,
  timesheets: icons.Clock,
  leave: icons.Palmtree,
  payroll: icons.Landmark,
  payslips: icons.Receipt,
  expenses: icons.Wallet,
  invoices: icons.FileText,
  customers: icons.Handshake,
  receivables: icons.Inbox,
  approvals: icons.ClipboardCheck,
  users: icons.UserCog,
  roles: icons.ShieldCheck,
  'access-control': icons.KeyRound,
  audit: icons.ClipboardList,
  settings: icons.Settings,
};

// Idempotent by design (skips items already carrying the right icon) so it's
// safe to call from a MutationObserver without looping — replaceChildren()
// below is itself a mutation, so a naive version would retrigger forever.
function applyNavIcons() {
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    const iconEl = btn.querySelector('.nav-icon');
    if (!iconEl) return;
    const locked = btn.classList.contains('is-locked');
    const key = locked ? 'locked' : btn.dataset.page;
    if (iconEl.dataset.lucideIcon === key) return;
    const iconNode = locked ? icons.Lock : NAV_ICON_MAP[btn.dataset.page];
    if (!iconNode) return;
    iconEl.replaceChildren(lucideIcon(iconNode, { width: 18, height: 18 }));
    iconEl.dataset.lucideIcon = key;
  });
}

// appScript's buildNavigation() fully rebuilds #nav (innerHTML = "") whenever it
// reruns, which would wipe the icons applyNavIcons() just painted in — watching
// for that keeps them in sync without editing appMarkup.js's markup itself.
function watchNavIcons() {
  const navEl = document.getElementById('nav');
  if (!navEl) return;
  applyNavIcons();
  new MutationObserver(applyNavIcons).observe(navEl, { childList: true, subtree: true });
}

// Topbar page title — appScript's own navigate() rewrites #topbar-title's text to
// `${item.icon}  ${item.label}` (plain emoji) on every nav click, so like the
// sidebar this repaints it in place after the fact rather than editing appMarkup.js.
// Skipped whenever the active nav item is locked — showNoAccess() (below) already
// owns the Lock-icon "No Access" text for that case and shouldn't be clobbered.
function applyTopbarTitleIcon() {
  const titleEl = document.getElementById('topbar-title');
  const activeBtn = document.querySelector('.nav-item.active');
  if (!titleEl || !activeBtn || activeBtn.classList.contains('is-locked')) return;
  const pageId = activeBtn.dataset.page;
  const iconNode = NAV_ICON_MAP[pageId];
  if (!iconNode || titleEl.dataset.lucideTopbar === pageId) return;
  const label = activeBtn.querySelector('.nav-label')?.textContent || pageId;
  titleEl.replaceChildren(lucideIcon(iconNode, { style: 'vertical-align:-3px;margin-right:8px' }), document.createTextNode(label));
  titleEl.dataset.lucideTopbar = pageId;
}

function watchTopbarTitle() {
  const titleEl = document.getElementById('topbar-title');
  if (!titleEl) return;
  applyTopbarTitleIcon();
  new MutationObserver(applyTopbarTitleIcon).observe(titleEl, { childList: true, characterData: true, subtree: true });
}

// Sidebar collapse/expand toggle — appScript's toggleSidebar() overwrites the
// button's textContent on every click ("◀ Collapse" / "▶"), so repaint on mutation
// the same way as the nav and topbar title above.
function applySidebarToggleIcon() {
  const btn = document.querySelector('.sidebar-footer');
  if (!btn) return;
  const collapsed = document.getElementById('sidebar')?.classList.contains('collapsed');
  const key = collapsed ? 'collapsed' : 'expanded';
  if (btn.dataset.lucideIcon === key) return;
  if (collapsed) btn.replaceChildren(lucideIcon(icons.PanelLeftOpen));
  else btn.replaceChildren(lucideIcon(icons.PanelLeftClose), document.createTextNode(' Collapse'));
  btn.dataset.lucideIcon = key;
}

function watchSidebarToggle() {
  const btn = document.querySelector('.sidebar-footer');
  if (!btn) return;
  applySidebarToggleIcon();
  new MutationObserver(applySidebarToggleIcon).observe(btn, { childList: true, characterData: true, subtree: true });
}

// One-time topbar fixes — none of these elements get rewritten by legacy code after
// initial render, so unlike the three above they don't need an observer.
function applyStaticTopbarIcons() {
  const notifBtn = document.getElementById('notif-btn');
  if (notifBtn && !notifBtn.dataset.lucideIcon) {
    const bellText = Array.from(notifBtn.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
    if (bellText) notifBtn.replaceChild(lucideIcon(icons.Bell), bellText);
    notifBtn.dataset.lucideIcon = '1';
  }

  const exitViewBtn = document.getElementById('view-as-exit');
  if (exitViewBtn && !exitViewBtn.dataset.lucideIcon) {
    exitViewBtn.replaceChildren(lucideIcon(icons.EyeOff, { width: 14, height: 14 }), document.createTextNode(' Exit view'));
    exitViewBtn.dataset.lucideIcon = '1';
  }

  const signOutBtn = document.querySelector('button[onclick="doLogout()"]');
  if (signOutBtn && !signOutBtn.dataset.lucideIcon) {
    signOutBtn.replaceChildren(lucideIcon(icons.LogOut, { width: 14, height: 14 }), document.createTextNode(' Sign out'));
    signOutBtn.dataset.lucideIcon = '1';
  }

  const roleSwitcher = document.getElementById('role-switcher');
  if (roleSwitcher && !roleSwitcher.dataset.lucideWrapped) {
    const wrap = document.createElement('span');
    wrap.style.cssText = 'display:inline-flex;align-items:center;gap:6px;color:#7c92a1';
    roleSwitcher.parentNode.insertBefore(wrap, roleSwitcher);
    wrap.appendChild(lucideIcon(icons.Eye, { width: 14, height: 14 }));
    wrap.appendChild(roleSwitcher);
    roleSwitcher.dataset.lucideWrapped = '1';
  }
}

export function initApiBridge() {
  watchNavIcons();
  watchTopbarTitle();
  watchSidebarToggle();
  applyStaticTopbarIcons();

  // ── Page loader registry ────────────────────────────────────────────────────
  const loaders = {
    'page-companies':     loadCompanies,
    'page-customers':     loadCustomers,
    'page-projects':      loadProjects,
    'page-project-codes': loadProjectCodes,
    'page-billing-codes': loadBillingCodes,
    'page-employees':     loadEmployees,
    'page-hourly-cost':   loadHourlyCosts,
    'page-timesheets':    loadTimesheets,
    'page-leave':         loadLeave,
    'page-expenses':      loadExpenses,
    'page-receivables':   loadReceivables,
    'page-service-desk':  loadServiceDesk,
    // page-dashboard/page-approvals/page-roles/page-access-control/page-settings/
    // page-reports/page-invoices deliberately NOT wired to a loader — those pages are
    // full React rebuilds (see src/pages/Dashboard, Approvals, Roles, AccessControl,
    // Settings, Reports, Invoices) with no remaining dependency on their legacy
    // loadX(); leaving the entry here would just re-run DOM writes targeting elements
    // React now owns, corrupting React's fiber tree (see isReactOwned() in
    // shared/table.js for the underlying "removeChild ... not a child" failure mode
    // this caused when discovered) — and for Invoices specifically, loadInvoices()
    // fetches /api/receivables, which the rewritten InvoicesPage.jsx (now its own
    // /api/invoices resource) never reads. openReportView()/handleReportExport() are
    // still imported below and still wired to real clicks — ReportsPage.jsx reuses
    // them directly via the same .report-view-btn/.report-export-option classes, it
    // just doesn't need loadReports() itself (which only toggled visibility of legacy
    // DOM rows). loadInvoices/openInvoiceView remain imported below: the shared
    // modal-recv submit handler still references loadInvoices() in its (now-dead,
    // since page-invoices no longer sets that edit-state) invoiceEdit branch, and
    // openInvoiceView() is unreachable the same way — left in place rather than
    // unpicking that shared handler for a currently-inert code path.
    'page-users':         loadUsers,
    'page-audit':         loadAudit,
  };

  // "+ New X" lives in `.section-header` on every page except Service Desk (`.feature-actions`).
  const CREATE_BTN_SELECTOR = { 'service-desk': '.feature-actions .btn-primary' };
  const EXPORT_BTN_ID = { 'projects': 'proj-export-btn', 'audit': 'audit-export-btn' };

  function applyActionGating(pageId) {
    const bareId = pageId.replace(/^page-/, '');
    const page = document.getElementById(pageId);
    if (page) {
      const createBtn = page.querySelector(CREATE_BTN_SELECTOR[bareId] || '.section-header .btn-primary');
      if (createBtn) createBtn.style.display = canCreateOnPage(bareId) ? '' : 'none';
    }
    const exportBtn = EXPORT_BTN_ID[bareId] && document.getElementById(EXPORT_BTN_ID[bareId]);
    if (exportBtn) exportBtn.style.display = canExportOnPage(bareId) ? '' : 'none';
  }

  function loadPage(pageId) {
    const loader = loaders[pageId];
    if (loader) loader();
    applyActionGating(pageId);
  }

  function applyNavGating() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      if (canViewPage(btn.dataset.page)) return; // already unlocked by appScript's default rendering
      btn.classList.add('is-locked');
      btn.title = 'No access. Click to request access.';
      const icon = btn.querySelector('.nav-icon');
      if (icon) icon.style.color = '';
    });
    applyNavIcons();
  }

  function showNoAccess(pageId) {
    const label = document.querySelector(`.nav-item[data-page="${pageId}"] .nav-label`)?.textContent || pageId;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === pageId));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-no-access'));
    const nameEl = document.getElementById('blocked-page-name'); if (nameEl) nameEl.textContent = label;
    const reqEl = document.getElementById('request-page-name'); if (reqEl) reqEl.value = label;
    const titleEl = document.getElementById('topbar-title');
    if (titleEl) titleEl.replaceChildren(lucideIcon(icons.Lock, { style: 'vertical-align:-3px;margin-right:6px' }), document.createTextNode('No Access · ' + label));
    state.blockedPageId = pageId; // read by submitPageAccessRequest() (pages/accesscontrol.js)
    // NoAccessPage.jsx (React) listens for this instead of reading blocked-page-name/
    // request-page-name, which it doesn't render — see src/pages/NoAccess.
    document.dispatchEvent(new CustomEvent('no-access:shown', { detail: { pageId, label } }));
  }

  // ── Modal form submissions ──────────────────────────────────────────────────
  function wireSubmits() {
    // Companies / Customers (shared modal-company — Customers is a finance-facing view of the same records)
    wireBtn('modal-company', async () => {
      const id = editId('page-companies') || editId('page-customers');
      const body = {
        name: val('modal-company', 'company name'),
        industry: val('modal-company', 'industry'),
        primary_contact: val('modal-company', 'primary contact') || null,
        email: val('modal-company', 'email') || null,
        status: val('modal-company', 'status') || 'Active',
      };
      if (id) { const { name: _, ...u } = body; await patch(`/api/companies/${id}`, u); toast('Company updated'); }
      else { if (!body.name || !body.industry) { toast('Company Name and Industry required', 'error'); return; } await post('/api/companies', body); toast('Company created'); }
      closeModal('modal-company'); startCreate('page-companies'); startCreate('page-customers');
      // Used to branch on #page-customers' .active class to decide which of the two
      // React pages (CompaniesPage/CustomersPage — same backend records, different
      // views) needed its 'changed' event; that DOM signal no longer exists now that
      // AppLayout/react-router own page switching (Phase 1 of the bridge-removal
      // migration), so just refresh both — same /api/companies data either way.
      loadCompanies(); loadCustomers();
    });

    // Projects
    wireBtn('modal-project', async () => {
      const id = editId('page-projects');
      const manager = val('modal-project', 'project manager');
      const body = {
        id: val('modal-project', 'project code'),
        name: val('modal-project', 'project name'),
        client: val('modal-project', 'client name'),
        manager: manager === 'Select Manager' ? '' : manager,
        status: val('modal-project', 'status') || 'Not Started',
        start_date: val('modal-project', 'start date') || null,
        end_date: val('modal-project', 'end date') || null,
        budget: parseFloat(val('modal-project', 'budget')) || 0,
        est_revenue: parseFloat(val('modal-project', 'revenue')) || 0,
        est_expense: parseFloat(val('modal-project', 'expense')) || 0,
      };
      if (id) {
        const { id: _, ...u } = body;
        await patch(`/api/projects/${id}`, u);
        toast('Project updated');
      } else {
        if (!body.id || !body.name || !body.client || !body.manager) { toast('Code, Name, Client and Manager required', 'error'); return; }
        await post('/api/projects', body);
        toast('Project created');
      }
      closeModal('modal-project'); startCreate('page-projects'); loadProjects(); refreshCaches();
    });

    // Project Codes
    wireBtn('modal-pcode', async () => {
      const id = editId('page-project-codes');
      const modal = document.getElementById('modal-pcode');
      const projectSel = Array.from(modal?.querySelectorAll('select') || []).find(s => (s.options[0]?.text || '').toLowerCase().includes('select project'));
      const body = {
        code: val('modal-pcode', 'project code'),
        project_id: projectSel?.value || '',
        description: val('modal-pcode', 'description') || null,
        status: val('modal-pcode', 'status') || 'Active',
      };
      if (id) { const { code: _, ...u } = body; await patch(`/api/project-codes/${id}`, u); toast('Project code updated'); }
      else { if (!body.code || !body.project_id) { toast('Code and Project required', 'error'); return; } await post('/api/project-codes', body); toast('Project code created'); }
      closeModal('modal-pcode'); startCreate('page-project-codes'); loadProjectCodes(); refreshCaches();
    });

    // Billing Codes
    wireBtn('modal-bcode', async () => {
      const id = editId('page-billing-codes');
      const projectCodeId = val('modal-bcode', 'project code');
      const pcode = state.pcodes.find(pc => pc.code === projectCodeId);
      const body = {
        code: val('modal-bcode', 'billing code'),
        project_code_id: projectCodeId,
        project_id: pcode?.project_id || '',
        client: state.projects.find(p => p.id === pcode?.project_id)?.client || null,
        billing_type: val('modal-bcode', 'billing type') || 'T&M',
        rate: parseFloat(val('modal-bcode', 'billing rate')) || 0,
        effective_from: val('modal-bcode', 'effective from') || null,
        effective_to: val('modal-bcode', 'effective to') || null,
        status: val('modal-bcode', 'status') || 'Active',
      };
      if (id) {
        const { code: _, project_code_id: __, project_id: ___, ...u } = body;
        await patch(`/api/billing-codes/${id}`, u);
        toast('Billing code updated');
      } else {
        if (!body.code || !body.project_code_id) { toast('Code and Project Code required', 'error'); return; }
        await post('/api/billing-codes', body);
        toast('Billing code created');
      }
      closeModal('modal-bcode'); startCreate('page-billing-codes'); loadBillingCodes(); refreshCaches();
    });

    // Employees
    wireBtn('modal-emp', async () => {
      const id = editId('page-employees');
      const body = {
        emp_id: val('modal-emp', 'employee id'),
        name: val('modal-emp', 'full name'),
        email: val('modal-emp', 'email'),
        phone: val('modal-emp', 'phone') || null,
        department: val('modal-emp', 'department') || null,
        designation: val('modal-emp', 'designation') || null,
        joining_date: val('modal-emp', 'joining date') || null,
        role: val('modal-emp', 'role') || 'Employee',
        billable: val('modal-emp', 'billable') !== 'Non-Billable',
        status: val('modal-emp', 'status') || 'Active',
      };
      if (id) { const { emp_id: _, ...u } = body; await patch(`/api/employees/${id}`, u); toast('Employee updated'); }
      else {
        if (!body.emp_id || !body.name || !body.email) {
          toast('ID, Name and Email required', 'error');
          return;
        }
        await post('/api/employees/', body);
        toast('Employee created');
      }
      closeModal('modal-emp'); startCreate('page-employees'); loadEmployees(); refreshCaches();
    });

    // Hourly Costs
    wireBtn('modal-cost', async () => {
      const id = editId('page-hourly-cost');
      const body = {
        emp_id: val('modal-cost', 'employee'),
        hourly_cost: parseFloat(val('modal-cost', 'hourly cost')) || 0,
        effective_from: val('modal-cost', 'effective from') || null,
        effective_to: val('modal-cost', 'effective to') || null,
      };
      if (id) { const { emp_id: _, ...u } = body; await patch(`/api/hourly-costs/${id}`, u); toast('Cost updated'); }
      else { if (!body.emp_id) { toast('Employee required', 'error'); return; } await post('/api/hourly-costs', body); toast('Cost record created'); }
      closeModal('modal-cost'); startCreate('page-hourly-cost'); loadHourlyCosts();
    });

    // Leave — self-submitted only; the backend derives emp_id from the logged-in user's
    // own employee record (see app/routers/leave.py), so it's never collected here.
    wireBtn('modal-leave', async () => {
      const body = {
        leave_type: val('modal-leave', 'leave type') || 'Casual',
        from_date: val('modal-leave', 'from date'),
        to_date: val('modal-leave', 'to date'),
        reason: val('modal-leave', 'reason') || null,
      };
      if (!body.from_date || !body.to_date) { toast('From Date and To Date required', 'error'); return; }
      await post('/api/leave', body);
      toast('Leave request submitted');
      closeModal('modal-leave'); loadLeave();
    });

    // Timesheets — always self-submitted; the backend derives emp_id/name from the
    // logged-in user's own employee record, so it's never collected here.
    wireBtn('modal-timesheet', async () => {
      const id = editId('page-timesheets');
      const hours = parseFloat(val('modal-timesheet', 'hours worked')) || 0;
      const body = {
        entry_date: val('modal-timesheet', 'date'),
        project_id: val('modal-timesheet', 'project'),
        project_code_id: val('modal-timesheet', 'project code') || null,
        billing_code_id: val('modal-timesheet', 'billing code') || null,
        hours,
        billable: val('modal-timesheet', 'billable') !== 'Non-Billable',
        notes: val('modal-timesheet', 'work description') || null,
      };
      if (hours <= 0 || hours > 9) { toast('Hours worked must be between 0 and 9', 'error'); return; }
      if (body.project_code_id && !state.pcodes.some(c => c.code === body.project_code_id && c.project_id === body.project_id)) {
        toast('That project code does not belong to the selected project', 'error');
        return;
      }
      if (id) { const { entry_date: __, project_id: ___, ...u } = body; await patch(`/api/timesheets/${id}`, u); toast('Timesheet updated'); }
      else { if (!body.entry_date || !body.project_id) { toast('Date and Project required', 'error'); return; } await post('/api/timesheets', body); toast('Timesheet submitted'); }
      closeModal('modal-timesheet'); startCreate('page-timesheets'); loadTimesheets();
    });

    // Expenses
    wireAttachZone('modal-expense');
    wireBtn('modal-expense', async () => {
      const id = editId('page-expenses');
      const modalEl = document.getElementById('modal-expense');
      // Upload the picked receipt (if any) before touching the expense record itself —
      // if this fails, bail out without creating/updating anything half-done. A file
      // already uploaded (and OCR'd) via the "Upload File" flow before the modal opened
      // takes a back seat to a freshly picked one — the user swapped it on purpose.
      const attachInput = document.querySelector('#modal-expense input[data-attach-input]');
      const attachFile = attachInput?.files?.[0];
      let receipt_url = modalEl?.dataset.pendingReceiptUrl || undefined;
      if (attachFile) {
        const uploaded = await uploadFile('/api/expenses/attachments', attachFile).catch(() => null);
        if (!uploaded) return;
        receipt_url = uploaded.receipt_url;
      }
      const body = {
        project_id: val('modal-expense', 'project'),
        project_code_id: val('modal-expense', 'project code') || null,
        billing_code_id: val('modal-expense', 'billing code') || null,
        category: val('modal-expense', 'expense category'),
        expense_date: val('modal-expense', 'expense date'),
        amount: parseFloat(val('modal-expense', 'amount')) || 0,
        vendor: val('modal-expense', 'vendor name') || null,
        description: val('modal-expense', 'description') || null,
        // Must be the display NAME, not username() — is_own_record()/isMine() on the
        // backend and frontend both compare submitted_by against current_user.name, and
        // the two are different values for every seeded account (e.g. "ravi" vs "Ravi
        // Kumar"). Using username() here would make an Employee's own self-service
        // expense submission fail is_own_record() and 403.
        submitted_by: state.currentUser?.name || username() || 'unknown',
        ...(receipt_url ? { receipt_url } : {}),
      };
      if (id) {
        const { project_id: _, project_code_id: __, billing_code_id: ___, submitted_by: ____, ...u } = body;
        await patch(`/api/expenses/${id}`, u);
        toast('Expense updated');
      } else {
        if (!body.project_id || !body.category || !body.expense_date) { toast('Project, Category and Date required', 'error'); return; }
        await post('/api/expenses', body);
        toast('Expense submitted');
      }
      if (modalEl) delete modalEl.dataset.pendingReceiptUrl;
      closeModal('modal-expense'); startCreate('page-expenses'); loadExpenses();
    });

    // Receivables / Invoices (shared modal-recv — Invoices is a view+edit layer over the same data)
    wireBtn('modal-recv', async () => {
      const invoiceEdit = editId('page-invoices');
      const id = editId('page-receivables') || invoiceEdit;
      const body = {
        project_id: val('modal-recv', 'project'),
        billing_code_id: val('modal-recv', 'billing code') || null,
        client: val('modal-recv', 'client name'),
        invoice_no: val('modal-recv', 'invoice number'),
        invoice_date: val('modal-recv', 'invoice date'),
        due_date: val('modal-recv', 'due date') || null,
        invoice_amount: parseFloat(val('modal-recv', 'invoice amount')) || 0,
        received_amount: parseFloat(val('modal-recv', 'received amount')) || 0,
        status: val('modal-recv', 'payment status') || 'Pending',
      };
      if (id) {
        await patch(`/api/receivables/${id}`, { received_amount: body.received_amount, due_date: body.due_date, status: body.status });
        toast('Receivable updated');
      } else {
        if (!body.project_id || !body.invoice_no) { toast('Project and Invoice No required', 'error'); return; }
        if (body.billing_code_id && !state.bcodes.some(b => b.code === body.billing_code_id && b.project_id === body.project_id)) {
          toast('That billing code does not belong to the selected project', 'error');
          return;
        }
        await post('/api/receivables', body);
        toast('Receivable created');
      }
      closeModal('modal-recv'); startCreate('page-receivables'); startCreate('page-invoices');
      if (invoiceEdit) loadInvoices(); else loadReceivables();
    });

    // Service Desk Tickets
    const SLA_HOURS = { '4 hours': 4, '8 hours': 8, '1 business day': 24, '3 business days': 72 };
    wireBtn('modal-ticket', async () => {
      const id = editId('page-service-desk');
      const slaChoice = val('modal-ticket', 'target sla');
      const slaHours = SLA_HOURS[slaChoice];
      const body = {
        subject: val('modal-ticket', 'subject'),
        // Falls back to the display NAME, not username() — is_own_record() compares
        // requester against current_user.name (see the same fix on modal-expense above).
        requester: val('modal-ticket', 'requester') || state.currentUser?.name || username(),
        project_id: val('modal-ticket', 'project') || null,
        queue: val('modal-ticket', 'assignment queue'),
        priority: val('modal-ticket', 'priority') || 'Medium',
        sla_deadline: slaHours ? new Date(Date.now() + slaHours * 3600 * 1000).toISOString() : null,
      };
      if (id) {
        const { requester: _, project_id: __, ...u } = body;
        await patch(`/api/tickets/${id}`, u);
        toast('Ticket updated');
      } else {
        if (!body.subject || !body.queue) { toast('Subject and Queue required', 'error'); return; }
        await post('/api/tickets', body);
        toast('Ticket created');
      }
      closeModal('modal-ticket'); startCreate('page-service-desk'); loadServiceDesk();
    });

    // Cancel Ticket
    wireBtn('modal-ticket-cancel', async () => {
      const ticketNo = val('modal-ticket-cancel', 'ticket number');
      const t = state.tickets.find(x => x.ticket_no === ticketNo);
      if (!t) { toast('Ticket number not found', 'error'); return; }
      const reasonChoice = val('modal-ticket-cancel', 'cancellation reason');
      const remarks = val('modal-ticket-cancel', 'remarks');
      const reason = remarks ? `${reasonChoice}: ${remarks}` : reasonChoice;
      await post(`/api/tickets/${t.id}/cancel`, { reason });
      toast('Ticket cancelled');
      closeModal('modal-ticket-cancel'); loadServiceDesk();
    });

    // Users
    wireBtn('modal-user', async () => {
      const id = editId('page-users');
      const name = val('modal-user', 'full name');
      const body = {
        username: name,
        name,
        email: val('modal-user', 'email'),
        role: val('modal-user', 'role') || 'Employee',
        password: val('modal-user', 'temporary password') || 'Changeme@123',
      };
      // Manager has Admin-equivalent access everywhere except managing Admin/Manager
      // accounts (the backend rejects this too — see PRIVILEGED_ROLES in
      // app/routers/users.py) — catch it client-side so a Manager gets an immediate
      // message instead of a 403 after filling out the whole form.
      if (state.currentUser?.role === 'Manager' && (body.role === 'Admin' || body.role === 'Manager')) {
        toast('Only Admin can create or promote an Admin/Manager account', 'error');
        return;
      }
      if (id) { await patch(`/api/users/${id}`, { name: body.name, email: body.email, role: body.role }); toast('User updated'); }
      else {
        if (!body.name || !body.email) { toast('Name and Email required', 'error'); return; }
        await post('/api/users', body);
        toast(`User created — login username: ${body.username}`);
      }
      closeModal('modal-user'); startCreate('page-users'); loadUsers();
    });

    // Audit Log — manual entries
    wireBtn('modal-audit', async () => {
      const id = editId('page-audit');
      const body = {
        user: val('modal-audit', 'user'),
        module: val('modal-audit', 'module'),
        action: val('modal-audit', 'action'),
        record_id: val('modal-audit', 'record id') || null,
        detail: val('modal-audit', 'detail') || null,
      };
      if (!body.user || !body.module || !body.action) { toast('User, Module and Action required', 'error'); return; }
      if (id) { await patch(`/api/audit-log/${id}`, body); toast('Audit entry updated'); }
      else { await post('/api/audit-log/', body); toast('Audit entry added'); }
      closeModal('modal-audit'); startCreate('page-audit'); loadAudit();
    });
  }

  // ── INIT ───────────────────────────────────────────────────────────────────
  const loadCurrentUser = get('/api/auth/me')
    .then(me => {
      state.currentUser = me;
      state.permissions = me.permissions || {};
      state.pageOverrides = me.page_overrides || {};
    })
    .catch(() => {});

  Promise.all([refreshCaches(), loadCurrentUser]).then(() => {
    wireSubmits();
    populateFilterDropdowns();
    wireFilters(loaders, loadPage);
    ensureNotifPanel();
    refreshNotifBadge();

    // Nav gating. appScript's own hasPageAccess()/buildNavigation()/navigate() close over
    // the IIFE's local USER_ACCESS/activeUserKey (which stays "admin" forever with no
    // switcher) — reassigning window.hasPageAccess does NOT reach them, since bare
    // identifier references inside the IIFE resolve via its own closure, not via window.
    // So real gating is applied and enforced from out here instead, reusing the same
    // lock-icon styling and "no access" page the app already has.
    applyNavGating();
    document.getElementById('nav')?.addEventListener('click', e => {
      const item = e.target.closest('.nav-item');
      if (item?.dataset.page && !canViewPage(item.dataset.page)) {
        e.stopPropagation();
        showNoAccess(item.dataset.page);
      }
    }, true); // capture phase — runs before appScript's own always-unlocked click handler

    // Request Access (No Access page) — replaces the legacy demo-only submitAccessRequest()
    // (appScript), which only faked a DOM row + alert() and never called the real backend.
    const reqAccessBtn = document.querySelector('#page-no-access .btn-primary');
    if (reqAccessBtn) {
      reqAccessBtn.removeAttribute('onclick');
      reqAccessBtn.addEventListener('click', submitPageAccessRequest);
    }

    const _origNavigate = window.navigate;
    if (typeof _origNavigate === 'function') {
      window.navigate = function (id) {
        if (!canViewPage(id)) { showNoAccess(id); return; }
        return _origNavigate(id);
      };
    }

    // Topbar user chip — show the real logged-in identity instead of the demo default.
    if (state.currentUser) {
      const setEl = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
      setEl('active-avatar', state.currentUser.initials || '');
      setEl('active-user-name', state.currentUser.name || '');
      setEl('active-user-role', state.currentUser.role || '');
    }

    // Admin/Manager "View as role" (topbar). Mints a short-lived token for a real account
    // of the chosen role via POST /api/auth/view-as — server enforces the role check
    // and audit-logs it (see app/routers/auth.py), no password needed. Works the same
    // in production as in dev; not gated on import.meta.env.DEV.
    const roleSwitcher = document.getElementById('role-switcher');
    const viewAsExitBtn = document.getElementById('view-as-exit');
    const realToken = localStorage.getItem('real_token');
    if (roleSwitcher && viewAsExitBtn) {
      if (realToken) {
        // Currently previewing another role — offer Exit instead of the picker. The
        // Admin's own token is still sitting in real_token, so exiting is a local
        // restore + reload, no backend round trip needed.
        roleSwitcher.style.display = 'none';
        viewAsExitBtn.style.display = '';
        viewAsExitBtn.textContent = `Viewing as ${state.currentUser?.role || '…'} — Exit view`;
        viewAsExitBtn.addEventListener('click', () => {
          localStorage.setItem('token', realToken);
          localStorage.removeItem('real_token');
          location.reload();
        });
      } else if (['Admin', 'Manager'].includes(state.currentUser?.role)) {
        // Starts disabled (see appMarkup.js) so a click during this async init window —
        // before this listener exists — can't silently no-op. Only enable once wired.
        roleSwitcher.disabled = false;
        roleSwitcher.addEventListener('change', async () => {
          const role = roleSwitcher.value;
          if (!role) return;
          roleSwitcher.disabled = true;
          const adminToken = localStorage.getItem('token');
          try {
            await viewAs(role);
            localStorage.setItem('real_token', adminToken);
            location.reload();
          } catch (e) {
            toast(`Could not switch to "${role}": ${e.message}`, 'error');
            roleSwitcher.value = '';
            roleSwitcher.disabled = false;
          }
        });
      } else {
        roleSwitcher.style.display = 'none';
      }
    }

    document.getElementById('dash-period')?.addEventListener('change', () => loadDashboard());
    document.getElementById('ts-period')?.addEventListener('change', () => loadTimesheets());
    document.getElementById('audit-period')?.addEventListener('change', () => loadAudit());

    document.getElementById('notif-btn')?.addEventListener('click', e => {
      e.stopPropagation();
      const panel = document.getElementById('notif-panel');
      if (!panel) return;
      const opening = panel.style.display === 'none' || !panel.style.display;
      panel.style.display = opening ? 'block' : 'none';
      if (opening) loadNotifications(true);
    });

    const _origSwitch = window.switchUserMode;
    window.switchUserMode = function (key) {
      if (_origSwitch) _origSwitch(key);
      setTimeout(() => loadDashboard(), 300);
    };

    // Cost history button delegation
    document.addEventListener('click', e => {
      const btn = e.target.closest('.bridge-cost-history');
      if (btn) showCostHistory(btn.dataset.empid);
    });

    // Companies edit/delete button delegation
    document.addEventListener('click', async e => {
      const editBtn = e.target.closest('.bridge-edit[data-page="page-companies"]');
      if (editBtn) {
        const row = state.companies.find(c => String(c.id) === editBtn.dataset.id);
        if (!row) return;
        set('modal-company', 'company name', row.name);
        set('modal-company', 'industry', row.industry);
        set('modal-company', 'primary contact', row.primary_contact || '');
        set('modal-company', 'email', row.email || '');
        set('modal-company', 'status', row.status);
        startEdit('page-companies', row.id);
        openModal('modal-company');
        return;
      }
      const delBtn = e.target.closest('.bridge-delete[data-page="page-companies"]');
      if (delBtn) {
        if (!confirm('Delete this company?')) return;
        await del(`/api/companies/${delBtn.dataset.id}`);
        toast('Company deleted');
        loadCompanies();
      }
    });

    // Customers edit/delete button delegation (shared backend with Companies)
    document.addEventListener('click', async e => {
      const editBtn = e.target.closest('.bridge-edit[data-page="page-customers"]');
      if (editBtn) {
        const row = state.companies.find(c => String(c.id) === editBtn.dataset.id);
        if (!row) return;
        set('modal-company', 'company name', row.name);
        set('modal-company', 'industry', row.industry);
        set('modal-company', 'primary contact', row.primary_contact || '');
        set('modal-company', 'email', row.email || '');
        set('modal-company', 'status', row.status);
        startEdit('page-customers', row.id);
        openModal('modal-company');
        return;
      }
      const delBtn10 = e.target.closest('.bridge-delete[data-page="page-customers"]');
      if (delBtn10) {
        if (!confirm('Delete this customer?')) return;
        await del(`/api/companies/${delBtn10.dataset.id}`);
        toast('Customer deleted');
        loadCustomers();
      }
    });

    // "+ New Customer" should always start a fresh create, even after a cancelled edit
    document.querySelector('#page-customers .section-header .btn-primary')?.addEventListener('click', () => {
      startCreate('page-customers');
      openModal('modal-company');
    });

    // Projects edit/delete button delegation
    document.addEventListener('click', async e => {
      const editBtn = e.target.closest('.bridge-edit[data-page="page-projects"]');
      if (editBtn) {
        const row = state.projects.find(p => String(p.id) === editBtn.dataset.id);
        if (!row) return;
        set('modal-project', 'project code', row.id);
        set('modal-project', 'project name', row.name);
        set('modal-project', 'client name', row.client || '');
        set('modal-project', 'project manager', row.manager || '');
        set('modal-project', 'status', row.status);
        set('modal-project', 'start date', row.start_date || '');
        set('modal-project', 'end date', row.end_date || '');
        set('modal-project', 'budget', row.budget ?? 0);
        set('modal-project', 'revenue', row.est_revenue ?? 0);
        set('modal-project', 'expense', row.est_expense ?? 0);
        startEdit('page-projects', row.id);
        openModal('modal-project');
        return;
      }
      const delBtn2 = e.target.closest('.bridge-delete[data-page="page-projects"]');
      if (delBtn2) {
        if (!confirm('Delete this project?')) return;
        await del(`/api/projects/${delBtn2.dataset.id}`);
        toast('Project deleted');
        loadProjects();
      }
    });

    // "+ New Project" should always start a fresh create, even after a cancelled edit
    document.querySelector('#page-projects .section-header .btn-primary')?.addEventListener('click', () => startCreate('page-projects'));

    // Project Codes edit/delete button delegation
    document.addEventListener('click', async e => {
      const editBtn = e.target.closest('.bridge-edit[data-page="page-project-codes"]');
      if (editBtn) {
        const row = state.pcodes.find(c => String(c.code) === editBtn.dataset.id);
        if (!row) return;
        set('modal-pcode', 'project code', row.code);
        const modal = document.getElementById('modal-pcode');
        const projectSel = Array.from(modal?.querySelectorAll('select') || []).find(s => (s.options[0]?.text || '').toLowerCase().includes('select project'));
        if (projectSel) projectSel.value = row.project_id;
        set('modal-pcode', 'description', row.description || '');
        set('modal-pcode', 'status', row.status);
        startEdit('page-project-codes', row.code);
        openModal('modal-pcode');
        return;
      }
      const delBtn3 = e.target.closest('.bridge-delete[data-page="page-project-codes"]');
      if (delBtn3) {
        if (!confirm('Delete this project code?')) return;
        await del(`/api/project-codes/${delBtn3.dataset.id}`);
        toast('Project code deleted');
        loadProjectCodes();
      }
    });

    // "+ New Project Code" should always start a fresh create, even after a cancelled edit
    document.querySelector('#page-project-codes .section-header .btn-primary')?.addEventListener('click', () => startCreate('page-project-codes'));

    // Billing Codes edit/delete button delegation
    document.addEventListener('click', async e => {
      const editBtn = e.target.closest('.bridge-edit[data-page="page-billing-codes"]');
      if (editBtn) {
        const row = state.bcodes.find(b => String(b.code) === editBtn.dataset.id);
        if (!row) return;
        set('modal-bcode', 'billing code', row.code);
        set('modal-bcode', 'project code', row.project_code_id);
        set('modal-bcode', 'billing type', row.billing_type);
        set('modal-bcode', 'billing rate', row.rate ?? 0);
        set('modal-bcode', 'effective from', row.effective_from || '');
        set('modal-bcode', 'effective to', row.effective_to || '');
        set('modal-bcode', 'status', row.status);
        startEdit('page-billing-codes', row.code);
        openModal('modal-bcode');
        return;
      }
      const delBtn4 = e.target.closest('.bridge-delete[data-page="page-billing-codes"]');
      if (delBtn4) {
        if (!confirm('Delete this billing code?')) return;
        await del(`/api/billing-codes/${delBtn4.dataset.id}`);
        toast('Billing code deleted');
        loadBillingCodes();
      }
    });

    // "+ New Billing Code" should always start a fresh create, even after a cancelled edit
    document.querySelector('#page-billing-codes .section-header .btn-primary')?.addEventListener('click', () => startCreate('page-billing-codes'));

    // Employees edit/delete button delegation
    document.addEventListener('click', async e => {
      const editBtn = e.target.closest('.bridge-edit[data-page="page-employees"]');
      if (editBtn) {
        const row = state.employees.find(x => String(x.emp_id) === editBtn.dataset.id);
        if (!row) return;
        set('modal-emp', 'employee id', row.emp_id);
        set('modal-emp', 'full name', row.name);
        set('modal-emp', 'email', row.email);
        set('modal-emp', 'phone', row.phone || '');
        set('modal-emp', 'department', row.department || '');
        set('modal-emp', 'designation', row.designation || '');
        set('modal-emp', 'joining date', row.joining_date || '');
        set('modal-emp', 'role', row.role);
        set('modal-emp', 'billable', row.billable ? 'Billable' : 'Non-Billable');
        set('modal-emp', 'status', row.status);
        startEdit('page-employees', row.emp_id);
        openModal('modal-emp');
        return;
      }
      const delBtn6 = e.target.closest('.bridge-delete[data-page="page-employees"]');
      if (delBtn6) {
        if (!confirm('Delete this employee?')) return;
        await del(`/api/employees/${delBtn6.dataset.id}`);
        toast('Employee deleted');
        loadEmployees();
      }
    });

    // "+ New Employee" should always start a fresh create, even after a cancelled edit
    document.querySelector('#page-employees .section-header .btn-primary')?.addEventListener('click', () => startCreate('page-employees'));

    // Timesheets edit/delete/approve/reject button delegation
    document.addEventListener('click', async e => {
      const editBtn = e.target.closest('.bridge-edit[data-page="page-timesheets"]');
      if (editBtn) {
        const row = state.timesheets.find(t => String(t.id) === editBtn.dataset.id);
        if (!row) return;
        set('modal-timesheet', 'date', row.entry_date || '');
        set('modal-timesheet', 'project', row.project_id || '');
        populateTsProjectCodeSelect(row.project_id || '', row.project_code_id || '');
        set('modal-timesheet', 'billing code', row.billing_code_id || '');
        set('modal-timesheet', 'hours worked', row.hours ?? 0);
        set('modal-timesheet', 'billable', row.billable ? 'Billable' : 'Non-Billable');
        set('modal-timesheet', 'work description', row.notes || '');
        startEdit('page-timesheets', row.id);
        openModal('modal-timesheet');
        return;
      }
      const delBtn8 = e.target.closest('.bridge-delete[data-page="page-timesheets"]');
      if (delBtn8) {
        if (!confirm('Delete this timesheet entry?')) return;
        await del(`/api/timesheets/${delBtn8.dataset.id}`);
        toast('Timesheet deleted');
        loadTimesheets();
        return;
      }
      const approveBtn2 = e.target.closest('.bridge-approve[data-page="page-timesheets"]');
      if (approveBtn2) {
        await post(`/api/timesheets/${approveBtn2.dataset.id}/approve`, {});
        toast('Timesheet approved');
        loadTimesheets();
        return;
      }
      const rejectBtn2 = e.target.closest('.bridge-reject[data-page="page-timesheets"]');
      if (rejectBtn2) {
        await post(`/api/timesheets/${rejectBtn2.dataset.id}/reject`, {});
        toast('Timesheet rejected');
        loadTimesheets();
      }
    });

    // "+ Submit Hours" should always start a fresh create, even after a cancelled edit
    document.querySelector('#page-timesheets .section-header .btn-primary')?.addEventListener('click', () => startCreate('page-timesheets'));

    // Expenses edit/delete/approve/reject button delegation
    document.addEventListener('click', async e => {
      const editBtn = e.target.closest('.bridge-edit[data-page="page-expenses"]');
      if (editBtn) {
        const row = state.expenses.find(x => String(x.id) === editBtn.dataset.id);
        if (!row) return;
        set('modal-expense', 'project', row.project_id || '');
        set('modal-expense', 'project code', row.project_code_id || '');
        set('modal-expense', 'billing code', row.billing_code_id || '');
        set('modal-expense', 'expense category', row.category);
        set('modal-expense', 'expense date', row.expense_date || '');
        set('modal-expense', 'amount', row.amount ?? 0);
        set('modal-expense', 'vendor name', row.vendor || '');
        set('modal-expense', 'description', row.description || '');
        const attachZone = document.querySelector('#modal-expense .attach-zone[data-default-label]');
        const attachInputEl = attachZone?.querySelector('input[type="file"]');
        if (attachInputEl) attachInputEl.value = '';
        const attachLabel = attachZone?.querySelector('[data-attach-label]');
        if (attachLabel) {
          if (row.receipt_url) attachLabel.replaceChildren(lucideIcon(icons.FileText), document.createTextNode(' Attachment on file — upload to replace'));
          else attachLabel.textContent = attachZone.dataset.defaultLabel;
        }
        startEdit('page-expenses', row.id);
        openModal('modal-expense');
        return;
      }
      const delBtn9 = e.target.closest('.bridge-delete[data-page="page-expenses"]');
      if (delBtn9) {
        if (!confirm('Delete this expense?')) return;
        await del(`/api/expenses/${delBtn9.dataset.id}`);
        toast('Expense deleted');
        loadExpenses();
        return;
      }
      const approveBtn3 = e.target.closest('.bridge-approve[data-page="page-expenses"]');
      if (approveBtn3) {
        await post(`/api/expenses/${approveBtn3.dataset.id}/approve`, {});
        toast('Expense approved');
        loadExpenses();
        return;
      }
      const rejectBtn4 = e.target.closest('.bridge-reject[data-page="page-expenses"]');
      if (rejectBtn4) {
        const reason = prompt('Reason for rejecting this expense?');
        if (!reason) return;
        await post(`/api/expenses/${rejectBtn4.dataset.id}/reject`, { reason });
        toast('Expense rejected');
        loadExpenses();
      }
    });

    // "+ Add Expense" should always start a fresh create, even after a cancelled edit
    document.querySelector('#page-expenses .section-header .btn-primary')?.addEventListener('click', () => startCreate('page-expenses'));

    // Invoices view/edit button delegation (reuses modal-recv — Receivables is the real backend)
    document.addEventListener('click', e => {
      const viewBtn = e.target.closest('.bridge-view[data-page="page-invoices"]');
      if (viewBtn) {
        const row = state.invoices.find(x => String(x.id) === viewBtn.dataset.id);
        if (row) openInvoiceView(row);
        return;
      }
      const editBtn = e.target.closest('.bridge-edit[data-page="page-invoices"]');
      if (editBtn) {
        const row = state.invoices.find(x => String(x.id) === editBtn.dataset.id);
        if (!row) return;
        set('modal-recv', 'project', row.project_id || '');
        // Refresh the billing code options for THIS row's project first — otherwise
        // row.billing_code_id might not be a valid <option> yet and the set() below
        // would silently fail to select it (see populateRecvBillingCodeSelect()).
        populateRecvBillingCodeSelect(row.project_id || '', row.billing_code_id || '');
        set('modal-recv', 'client name', row.client || '');
        set('modal-recv', 'invoice number', row.invoice_no || '');
        set('modal-recv', 'invoice date', row.invoice_date || '');
        set('modal-recv', 'due date', row.due_date || '');
        set('modal-recv', 'invoice amount', row.invoice_amount ?? 0);
        set('modal-recv', 'received amount', row.received_amount ?? 0);
        set('modal-recv', 'payment status', row.status || 'Pending');
        startEdit('page-invoices', row.id);
        openModal('modal-recv');
      }
    });

    // "+ New Invoice" should always start a fresh create, even after a cancelled edit
    document.querySelector('#page-invoices .section-header .btn-primary')?.addEventListener('click', () => startCreate('page-invoices'));

    // Receivables edit/delete button delegation (shares modal-recv with Invoices)
    document.addEventListener('click', async e => {
      const editBtn = e.target.closest('.bridge-edit[data-page="page-receivables"]');
      if (editBtn) {
        const row = state.receivables.find(x => String(x.id) === editBtn.dataset.id);
        if (!row) return;
        set('modal-recv', 'project', row.project_id || '');
        populateRecvBillingCodeSelect(row.project_id || '', row.billing_code_id || '');
        set('modal-recv', 'client name', row.client || '');
        set('modal-recv', 'invoice number', row.invoice_no || '');
        set('modal-recv', 'invoice date', row.invoice_date || '');
        set('modal-recv', 'due date', row.due_date || '');
        set('modal-recv', 'invoice amount', row.invoice_amount ?? 0);
        set('modal-recv', 'received amount', row.received_amount ?? 0);
        set('modal-recv', 'payment status', row.status || 'Pending');
        startEdit('page-receivables', row.id);
        openModal('modal-recv');
        return;
      }
      const delBtn11 = e.target.closest('.bridge-delete[data-page="page-receivables"]');
      if (delBtn11) {
        if (!confirm('Delete this receivable?')) return;
        await del(`/api/receivables/${delBtn11.dataset.id}`);
        toast('Receivable deleted');
        loadReceivables();
      }
    });

    // "+ Add Receivable" should always start a fresh create, even after a cancelled edit
    document.querySelector('#page-receivables .section-header .btn-primary')?.addEventListener('click', () => startCreate('page-receivables'));

    // Approvals view/approve/reject button delegation (cross-module: timesheets/expenses/leave/access)
    document.addEventListener('click', async e => {
      const viewBtn = e.target.closest('.bridge-view[data-module]');
      if (viewBtn) {
        const row = state.approvalsAll.find(r => r._mod === viewBtn.dataset.module && String(r.id) === viewBtn.dataset.id);
        if (row) openApprovalView(row);
        return;
      }
      const approveBtn4 = e.target.closest('.bridge-approve[data-module]');
      if (approveBtn4) {
        const mod = approveBtn4.dataset.module, id = approveBtn4.dataset.id;
        const endpoint = {
          timesheets: `/api/timesheets/${id}/approve`,
          expenses: `/api/expenses/${id}/approve`,
          leave: `/api/leave/${id}/approve`,
          access: `/api/access-control/requests/${id}/approve`,
        }[mod];
        if (!endpoint) return;
        await post(endpoint, {});
        toast('Approved');
        loadApprovals();
        return;
      }
      const rejectBtn5 = e.target.closest('.bridge-reject[data-module]');
      if (rejectBtn5) {
        const mod = rejectBtn5.dataset.module, id = rejectBtn5.dataset.id;
        if (mod === 'expenses') {
          const reason = prompt('Reason for rejecting this expense?');
          if (!reason) return;
          await post(`/api/expenses/${id}/reject`, { reason });
        } else if (mod === 'timesheets') {
          await post(`/api/timesheets/${id}/reject`, {});
        } else if (mod === 'leave') {
          const reason = prompt('Reason for rejecting this leave request?');
          if (!reason) return;
          await post(`/api/leave/${id}/reject`, { reason });
        } else if (mod === 'access') {
          await post(`/api/access-control/requests/${id}/reject`, {});
        } else return;
        toast('Rejected');
        loadApprovals();
      }
    });

    // Users edit/delete button delegation
    document.addEventListener('click', async e => {
      const editBtn = e.target.closest('.bridge-edit[data-page="page-users"]');
      if (editBtn) {
        const row = state.users.find(u => String(u.id) === editBtn.dataset.id);
        if (!row) return;
        set('modal-user', 'full name', row.name);
        set('modal-user', 'email', row.email);
        set('modal-user', 'role', row.role);
        startEdit('page-users', row.id);
        openModal('modal-user');
        return;
      }
      const delBtn12 = e.target.closest('.bridge-delete[data-page="page-users"]');
      if (delBtn12) {
        if (!confirm('Delete this user?')) return;
        await del(`/api/users/${delBtn12.dataset.id}`);
        toast('User deleted');
        loadUsers();
      }
    });

    // "+ Create User" should always start a fresh create, even after a cancelled edit
    document.querySelector('#page-users .section-header .btn-primary')?.addEventListener('click', () => startCreate('page-users'));

    // Audit Log edit/delete button delegation
    document.addEventListener('click', async e => {
      const editBtn = e.target.closest('.bridge-edit[data-page="page-audit"]');
      if (editBtn) {
        const row = state.auditLogs.find(l => String(l.id) === editBtn.dataset.id);
        if (!row) return;
        set('modal-audit', 'user', row.user || '');
        set('modal-audit', 'module', row.module || '');
        set('modal-audit', 'action', row.action || '');
        set('modal-audit', 'record id', row.record_id || '');
        set('modal-audit', 'detail', row.detail || '');
        startEdit('page-audit', row.id);
        openModal('modal-audit');
        return;
      }
      const delBtn13 = e.target.closest('.bridge-delete[data-page="page-audit"]');
      if (delBtn13) {
        if (!confirm('Delete this audit log entry? This cannot be undone.')) return;
        await del(`/api/audit-log/${delBtn13.dataset.id}`);
        toast('Audit entry deleted');
        loadAudit();
      }
    });

    // "+ Add Entry" should always start a fresh create, even after a cancelled edit
    document.querySelector('#page-audit .section-header .btn-primary')?.addEventListener('click', () => startCreate('page-audit'));

    // Leave approve/reject button delegation
    document.addEventListener('click', async e => {
      const approveBtn2 = e.target.closest('.bridge-approve[data-page="page-leave"]');
      if (approveBtn2) {
        await post(`/api/leave/${approveBtn2.dataset.id}/approve`, {});
        toast('Leave approved');
        loadLeave();
        return;
      }
      const rejectBtn3 = e.target.closest('.bridge-reject[data-page="page-leave"]');
      if (rejectBtn3) {
        const reason = prompt('Reason for rejecting this leave request?');
        if (!reason) return;
        await post(`/api/leave/${rejectBtn3.dataset.id}/reject`, { reason });
        toast('Leave rejected');
        loadLeave();
      }
    });

    // Hourly Costs edit/delete button delegation
    document.addEventListener('click', async e => {
      const editBtn = e.target.closest('.bridge-edit[data-page="page-hourly-cost"]');
      if (editBtn) {
        const row = state.hourlyCosts.find(c => String(c.id) === editBtn.dataset.id);
        if (!row) return;
        set('modal-cost', 'employee', row.emp_id);
        set('modal-cost', 'hourly cost', row.hourly_cost ?? 0);
        set('modal-cost', 'effective from', row.effective_from || '');
        set('modal-cost', 'effective to', row.effective_to || '');
        startEdit('page-hourly-cost', row.id);
        openModal('modal-cost');
        return;
      }
      const delBtn7 = e.target.closest('.bridge-delete[data-page="page-hourly-cost"]');
      if (delBtn7) {
        if (!confirm('Delete this hourly cost record?')) return;
        await del(`/api/hourly-costs/${delBtn7.dataset.id}`);
        toast('Cost record deleted');
        loadHourlyCosts();
      }
    });

    // "+ Set Hourly Cost" should always start a fresh create, even after a cancelled edit
    document.querySelector('#page-hourly-cost .section-header .btn-primary')?.addEventListener('click', () => startCreate('page-hourly-cost'));

    // Service Desk edit/resolve/close button delegation
    document.addEventListener('click', async e => {
      const editBtn = e.target.closest('.bridge-edit[data-page="page-service-desk"]');
      if (editBtn) {
        const row = state.tickets.find(t => String(t.id) === editBtn.dataset.id);
        if (!row) return;
        set('modal-ticket', 'subject', row.subject);
        set('modal-ticket', 'assignment queue', row.queue || '');
        set('modal-ticket', 'priority', row.priority || 'Medium');
        startEdit('page-service-desk', row.id);
        openModal('modal-ticket');
        return;
      }
      const resolveBtn = e.target.closest('.bridge-resolve[data-page="page-service-desk"]');
      if (resolveBtn) {
        await post(`/api/tickets/${resolveBtn.dataset.id}/resolve`, {});
        toast('Ticket resolved');
        loadServiceDesk();
        return;
      }
      const closeBtn = e.target.closest('.bridge-close[data-page="page-service-desk"]');
      if (closeBtn) {
        await post(`/api/tickets/${closeBtn.dataset.id}/close`);
        toast('Ticket closed');
        loadServiceDesk();
      }
    });

    // "+ Create Ticket" should always start a fresh create, even after a cancelled edit
    document.querySelector('#page-service-desk .feature-actions .btn-primary')?.addEventListener('click', () => startCreate('page-service-desk'));

    // Access Control — page access requests: approve/reject/audit
    document.addEventListener('click', async e => {
      const approveBtn5 = e.target.closest('.bridge-req-approve');
      if (approveBtn5) {
        await post(`/api/access-control/requests/${approveBtn5.dataset.id}/approve`, {});
        toast('Request approved');
        loadAccessRequests();
        return;
      }
      const rejectBtn6 = e.target.closest('.bridge-req-reject');
      if (rejectBtn6) {
        await post(`/api/access-control/requests/${rejectBtn6.dataset.id}/reject`, {});
        toast('Request rejected');
        loadAccessRequests();
        return;
      }
      const auditBtn = e.target.closest('.bridge-req-audit');
      if (auditBtn) {
        const requester = auditBtn.dataset.requester;
        state.pf['page-audit'] = { ...state.pf['page-audit'], search: requester };
        window.navigate('audit');
        loadAudit();
      }
    });

    // Reports — View / Export (Excel/PDF) per report row
    document.addEventListener('click', e => {
      const row = e.target.closest('.perm-row[data-report-key]');
      if (!row) return;
      const key = row.dataset.reportKey;
      if (e.target.closest('.report-view-btn')) { openReportView(key); return; }
      const opt = e.target.closest('.report-export-option');
      if (opt) handleReportExport(key, opt.dataset.format);
    });

    // Nav click → load fresh data for that page. Scoped to document rather than
    // #nav (unlike the gating listener above, deliberately left scoped to #nav —
    // AppLayout.jsx's real nav links live outside it and already own their own
    // locked-click handling, which this must not intercept) — AppLayout.jsx's real
    // <NavLink>s carry the same .nav-item class + data-page attribute #nav's legacy
    // buildNavigation()-built buttons do, so this still finds them. Without this,
    // real navigation never re-triggers loadProjects()/etc., and modal dropdowns
    // that depend on their side effects (populateManagerDropdown, etc.) stay empty
    // on first "+ New X" until some other trigger (a submit elsewhere) fires it.
    document.addEventListener('click', e => {
      const item = e.target.closest('.nav-item');
      if (item?.dataset.page) loadPage('page-' + item.dataset.page);
    });

    // Signals that this one-time setup sweep (populateFilterDropdowns()/wireFilters()
    // above, in particular) has finished — React-based migrated pages wait for this
    // before claiming their legacy page div, since those two functions blindly
    // innerHTML-overwrite any <select> whose first option matches a known legacy
    // label ("All Clients", "All Owners", "All Projects", ...) and would otherwise
    // race a React-owned <select>'s children, corrupting React's reconciliation.
    window.__bridgeReady = true;
    document.dispatchEvent(new CustomEvent('bridge:ready'));
  });
}
