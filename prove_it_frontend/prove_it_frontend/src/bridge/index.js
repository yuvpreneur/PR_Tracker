// Bridge entry point — imports all modules and wires everything together
import { createElement, icons } from 'lucide';
import { get, post, patch, del, uploadFile } from './core/http.js';
import { state } from './core/state.js';
import { refreshCaches, username } from './core/cache.js';
import { viewAs } from '../services/authService.js';
import { toast } from './shared/ui.js';
import { canViewPage, canCreateOnPage, canExportOnPage } from './shared/permissions.js';
import { wireBtn, closeModal, startCreate, startEdit, editId, openModal, set, val, field, resetFields, checked, setChecked } from './shared/modals.js';
import { ensureNotifPanel, loadNotifications, refreshNotifBadge } from './shared/notifications.js';
import { populateFilterDropdowns, wireFilters } from './shared/filters.js';
import { loadDashboard } from './pages/dashboard.js';
import { loadCompanies } from './pages/companies.js';
import { loadCustomers } from './pages/customers.js';
import { loadProjects, loadProjectCodes, populatePCodeProjectDropdown } from './pages/projects.js';
import { loadBillingCodes, loadReceivables, populateRecvBillingCodeSelect, populateBCodeProjectCodeDropdown } from './pages/billing.js';
import { loadEmployees, loadHourlyCosts, showCostHistory } from './pages/employees.js';
import { loadTimesheets, populateTsProjectCodeSelect } from './pages/timesheets.js';
import { loadLeave } from './pages/leave.js';
import { loadExpenses, populateExpProjectCodeSelect, populateExpBillingCodeSelect } from './pages/expenses.js';
import { loadInvoices, openInvoiceView } from './pages/invoices.js';
import { loadServiceDesk, populateTicketStatusSelect, setTicketModalMode } from './pages/servicedesk.js';
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

// Rewrites an input's value through `clean` on every keystroke, putting the caret back
// where the typist left it. Without that the caret snaps to the end on each assignment,
// which makes fixing a character mid-value impossible; the rewrite is skipped entirely
// when nothing was stripped, which is the overwhelmingly common case.
function filterInput(input, clean) {
  input.addEventListener('input', () => {
    const cleaned = clean(input.value);
    if (cleaned === input.value) return;
    const caret = input.selectionStart;
    const head = input.value.slice(0, caret);
    input.value = cleaned;
    const pos = Math.max(0, caret - (head.length - clean(head).length));
    input.setSelectionRange(pos, pos);
  });
}

// Strips anything that isn't part of a number as the user types. `type="tel"` and
// `inputmode` block nothing in any browser — they only hint at which on-screen keyboard
// to show — so this is the actual enforcement. `decimal` additionally admits a single
// '.', for money fields; without it only whole digits survive (Phone).
function wireNumericInput(modalId, hint, { decimal = false } = {}) {
  const input = field(modalId, hint);
  if (!input) return;
  filterInput(input, v => {
    const digits = v.replace(decimal ? /[^\d.]/g : /\D/g, '');
    if (!decimal) return digits;
    // Only the first '.' survives, so a stray second one collapses ("1.2.3" -> "1.23")
    // rather than the keystroke being silently swallowed mid-correction.
    const dot = digits.indexOf('.');
    return dot === -1 ? digits : digits.slice(0, dot + 1) + digits.slice(dot + 1).replace(/[.]/g, '');
  });
}

// Names only the fields actually left blank. Every one of these checks used to recite
// the modal's whole required-field list whatever the user had filled in — "Name, Client
// and Manager required" when only the name was missing — which leaves the typist hunting
// for a problem in fields that are already fine. Returns true (having toasted) when
// something is missing, so callers read `if (missingFields([...])) return;`.
function missingFields(fields) {
  const missing = fields.filter(([, value]) => !value).map(([label]) => label);
  if (!missing.length) return false;
  const list = missing.length === 1
    ? missing[0]
    : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;
  toast(`${list} ${missing.length === 1 ? 'is' : 'are'} required`, 'error');
  return true;
}

// The mirror image of wireNumericInput(), for text fields that should never hold a
// number: digits (and other stray symbols) are stripped as the user types. Spaces,
// hyphens, apostrophes and periods always survive — a name field that rejected
// "Anne-Marie" or "O'Brien" would be worse than one that accepts a digit — and `extra`
// adds any further literals a particular field needs. Letters are matched with \p{L}
// rather than A-Za-z so non-Latin scripts survive, with \p{M} alongside it, since the
// combining marks that carry vowels in Indic and Arabic scripts are not themselves
// letters (without it "राहुल" gets quietly chewed down to "रहल").
const NAME_CHAR = /[\p{L}\p{M}\s.'-]/u;

function wireAlphaInput(modalId, hint, extra = '') {
  const input = field(modalId, hint);
  if (!input) return;
  // Tested character by character against a regex *literal* rather than one built from
  // a string: `\p{L}` inside a template literal is an unrecognized escape that
  // collapses to a bare `p`, which would silently turn the class into nonsense.
  // Array.from() iterates by code point, so astral characters survive intact.
  filterInput(input, v => Array.from(v).filter(ch => NAME_CHAR.test(ch) || extra.includes(ch)).join(''));
}

// Letters and digits only — for identifier fields (GSTIN / Tax ID) where every separator
// is noise: the value is a code, not prose, so spaces, punctuation and symbols are
// stripped as they are typed. ASCII deliberately, unlike NAME_CHAR above: these are
// machine-checkable registration numbers issued in A-Z0-9 (a GSTIN is exactly
// 22AAAAA0000A1Z5), so \p{L} would admit look-alike letters from other scripts that no
// tax authority would ever accept.
const ALNUM_CHAR = /[A-Za-z0-9]/;

function wireAlnumInput(modalId, hint) {
  const input = field(modalId, hint);
  if (!input) return;
  filterInput(input, v => Array.from(v).filter(ch => ALNUM_CHAR.test(ch)).join(''));
}

// Requires both an "@" and a dotted domain after it. `type="email"` enforces neither
// here: these modals have no <form>, so the browser's own constraint validation never
// runs on Save, and even where it does the HTML spec deliberately accepts "a@b" — a
// dotless domain is legal on an intranet, just never what someone means in this field.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Letters, digits, @ and . — plus _ - + , which real addresses need and which no amount
// of format-checking afterwards can recover once the keystroke is dropped: hyphens are
// everywhere in domains (my-company.com), and underscores and plus-tags are common in
// local parts (first_last@, user+tag@). Everything else — spaces, slashes, brackets — is
// stripped as it is typed. ASCII only: addresses here are, and an IDN would fail the
// format check below anyway.
const EMAIL_CHAR = /[A-Za-z0-9@._+-]/;

function wireEmailInput(modalId, hint = 'email') {
  const input = field(modalId, hint);
  if (!input) return;
  filterInput(input, v => Array.from(v).filter(ch => EMAIL_CHAR.test(ch)).join(''));
}

// Returns true (having toasted and focused the field) when a non-empty address is
// malformed. An empty one is left to missingFields(), which is the only thing that knows
// whether email is required on that particular form.
function invalidEmail(modalId, email) {
  if (!email || EMAIL_RE.test(email)) return false;
  toast('Enter a valid email address, like name@company.com', 'error');
  field(modalId, 'email')?.focus();
  return true;
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
    wireNumericInput('modal-company', 'phone');
    // '&' is kept on the client name for the same reason it is kept on the industry
    // below — "Johnson & Johnson" is a name people actually type, and eating the
    // ampersand would leave "Johnson  Johnson".
    wireAlphaInput('modal-company', 'client name', '&');
    wireAlphaInput('modal-company', 'primary contact');
    wireEmailInput('modal-company');
    wireAlnumInput('modal-company', 'gstin');
    // '&' and '/' are kept here but not on a person's name — "Oil & Gas" and "IT/ITES"
    // are industries people actually type, and silently eating the separator would turn
    // them into "Oil  Gas" / "ITITES".
    wireAlphaInput('modal-company', 'industry', '&/');
    wireBtn('modal-company', async () => {
      const id = editId('page-companies') || editId('page-customers');
      const body = {
        name: val('modal-company', 'client name'),
        industry: val('modal-company', 'industry'),
        primary_contact: val('modal-company', 'primary contact') || null,
        email: val('modal-company', 'email') || null,
        phone: val('modal-company', 'phone') || null,
        gstin: val('modal-company', 'gstin') || null,
        billing_address: val('modal-company', 'billing address') || null,
        status: val('modal-company', 'status') || 'Active',
      };
      // Checked ahead of the create/update split so an edit can't slip a bad address
      // through the way it can skip the name/industry check below. Email is optional
      // here — only a non-empty one has to be well formed.
      if (invalidEmail('modal-company', body.email)) return;
      if (id) { await patch(`/api/companies/${id}`, body); toast('Client updated'); }
      else { if (missingFields([['Client Name', body.name], ['Industry', body.industry]])) return; await post('/api/companies', body); toast('Client created'); }
      // Belt-and-suspenders: clear fields the moment a save completes, not only right
      // before the next "+ New X" open — closes the window where an edit's leftover
      // values could leak into whatever opens this modal next.
      closeModal('modal-company'); resetFields('modal-company'); startCreate('page-companies'); startCreate('page-customers');
      // Used to branch on #page-customers' .active class to decide which of the two
      // React pages (CompaniesPage/CustomersPage — same backend records, different
      // views) needed its 'changed' event; that DOM signal no longer exists now that
      // AppLayout/react-router own page switching (Phase 1 of the bridge-removal
      // migration), so just refresh both — same /api/companies data either way.
      loadCompanies(); loadCustomers();
    });

    // Projects
    wireNumericInput('modal-project', 'budget', { decimal: true });
    wireNumericInput('modal-project', 'revenue', { decimal: true });
    wireNumericInput('modal-project', 'expense', { decimal: true });
    wireBtn('modal-project', async () => {
      const id = editId('page-projects');
      const manager = val('modal-project', 'project manager');
      const assignEmpSelect = document.getElementById('project-assign-employees');
      const selectedEmpIds = assignEmpSelect ? Array.from(assignEmpSelect.selectedOptions).map(o => o.value).filter(Boolean) : [];
      const body = {
        // No code here — the server assigns it (projects.py's _next_project_code).
        name: val('modal-project', 'project name'),
        client: val('modal-project', 'client name'),
        manager: manager === 'Select Manager' ? '' : manager,
        status: val('modal-project', 'status') || 'Not Started',
        start_date: val('modal-project', 'start date') || null,
        end_date: val('modal-project', 'end date') || null,
        budget: parseFloat(val('modal-project', 'budget')) || 0,
        est_revenue: parseFloat(val('modal-project', 'revenue')) || 0,
        est_expense: parseFloat(val('modal-project', 'expense')) || 0,
        assigned_emp_ids: selectedEmpIds.length > 0 ? selectedEmpIds : null,
      };
      if (id) {
        await patch(`/api/projects/${id}`, body);
        toast('Project updated');
      } else {
        if (missingFields([['Project Name', body.name], ['Client Name', body.client], ['Project Manager', body.manager]])) return;
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
      if (missingFields([['Project Code', body.code], ['Project', body.project_id]])) return;
      if (id) { await patch(`/api/project-codes/${id}`, body); toast('Project code updated'); }
      else { await post('/api/project-codes', body); toast('Project code created'); }
      closeModal('modal-pcode'); startCreate('page-project-codes'); loadProjectCodes(); refreshCaches();
    });

    // Billing Codes
    wireNumericInput('modal-bcode', 'billing rate', { decimal: true });
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
      if (missingFields([['Billing Code', body.code], ['Project Code', body.project_code_id]])) return;
      if (id) {
        const { project_id: _, ...u } = body;
        await patch(`/api/billing-codes/${id}`, u);
        toast('Billing code updated');
      } else {
        await post('/api/billing-codes', body);
        toast('Billing code created');
      }
      closeModal('modal-bcode'); startCreate('page-billing-codes'); loadBillingCodes(); refreshCaches();
    });

    // Employees
    wireNumericInput('modal-emp', 'phone');
    wireAlphaInput('modal-emp', 'full name');
    wireAlphaInput('modal-emp', 'designation');
    wireEmailInput('modal-emp');
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
        pm_access_enabled: checked('modal-emp', 'allow pr manager'),
      };
      // Listed in form order: Employee ID, Full Name, Email, Phone.
      if (missingFields([
        ['Employee ID', body.emp_id],
        ['Full Name', body.name],
        ['Email', body.email],
        ['Phone', body.phone],
      ])) return;
      if (invalidEmail('modal-emp', body.email)) return;
      if (id) { await patch(`/api/employees/${id}`, body); toast('Employee updated'); }
      else { await post('/api/employees/', body); toast('Employee created'); }
      closeModal('modal-emp'); startCreate('page-employees'); loadEmployees(); refreshCaches();
    });

    // Hourly Costs
    wireNumericInput('modal-cost', 'hourly cost', { decimal: true });
    wireBtn('modal-cost', async () => {
      const id = editId('page-hourly-cost');
      const body = {
        emp_id: val('modal-cost', 'employee'),
        hourly_cost: parseFloat(val('modal-cost', 'hourly cost')) || 0,
        effective_from: val('modal-cost', 'effective from') || null,
        effective_to: val('modal-cost', 'effective to') || null,
      };
      // Checked ahead of the create/update split: a blank Effective From on an edit
      // sends null, which the PATCH drops rather than applies, so it would silently
      // keep the old date instead of reporting anything.
      if (missingFields([['Employee', body.emp_id], ['Effective From', body.effective_from]])) return;
      if (id) { const { emp_id: _, ...u } = body; await patch(`/api/hourly-costs/${id}`, u); toast('Cost updated'); }
      else { await post('/api/hourly-costs', body); toast('Cost record created'); }
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
      if (missingFields([['From Date', body.from_date], ['To Date', body.to_date]])) return;
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
      else { if (missingFields([['Date', body.entry_date], ['Project', body.project_id]])) return; await post('/api/timesheets', body); toast('Timesheet submitted'); }
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
        if (missingFields([['Project', body.project_id], ['Expense Category', body.category], ['Expense Date', body.expense_date]])) return;
        await post('/api/expenses', body);
        toast('Expense submitted');
      }
      if (modalEl) delete modalEl.dataset.pendingReceiptUrl;
      closeModal('modal-expense'); startCreate('page-expenses'); loadExpenses();
    });

    // Receivables / Invoices (shared modal-recv — Invoices is a view+edit layer over the same data)
    // Same filter (and same '&' exception) as modal-company's client name — this field
    // holds the very same company names, just typed on the finance side.
    wireAlphaInput('modal-recv', 'client name', '&');
    wireNumericInput('modal-recv', 'invoice amount', { decimal: true });
    wireNumericInput('modal-recv', 'received amount', { decimal: true });
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
      if (missingFields([['Project', body.project_id], ['Invoice Number', body.invoice_no]])) return;
      if (body.billing_code_id && !state.bcodes.some(b => b.code === body.billing_code_id && b.project_id === body.project_id)) {
        toast('That billing code does not belong to the selected project', 'error');
        return;
      }
      if (id) {
        await patch(`/api/receivables/${id}`, body);
        toast('Receivable updated');
      } else {
        await post('/api/receivables', body);
        toast('Receivable created');
      }
      closeModal('modal-recv'); startCreate('page-receivables'); startCreate('page-invoices');
      if (invoiceEdit) loadInvoices(); else loadReceivables();
    });

    // Service Desk Tickets
    wireAlphaInput('modal-ticket', 'requester');
    const SLA_HOURS = { '4 hours': 4, '8 hours': 8, '1 business day': 24, '3 business days': 72 };
    wireBtn('modal-ticket', async () => {
      const id = editId('page-service-desk');
      const slaChoice = val('modal-ticket', 'target sla');
      const slaHours = SLA_HOURS[slaChoice];
      const body = {
        subject: val('modal-ticket', 'subject'),
        // Deliberately no fallback to the signed-in user: leaving this blank used to file
        // the ticket under whoever was logged in, silently and invisibly. It is required
        // below instead, so the requester is always someone's explicit choice.
        requester: val('modal-ticket', 'requester'),
        project_id: val('modal-ticket', 'project') || null,
        queue: val('modal-ticket', 'assignment queue'),
        priority: val('modal-ticket', 'priority') || 'Medium',
        sla_deadline: slaHours ? new Date(Date.now() + slaHours * 3600 * 1000).toISOString() : null,
        // Only on edit: the Status field is hidden while creating, since tickets.py
        // always starts a new ticket Open. Sending it here would just be noise.
        ...(id ? { status: val('modal-ticket', 'status') || 'Open' } : {}),
      };
      // Listed in the order they appear on the form, so the message tracks the eye.
      // Category/Priority/Assignment Queue/Target SLA are <select>s whose first option
      // is a real value, never a "choose one" placeholder, so they cannot be empty —
      // Project is the only dropdown here that can.
      if (missingFields([
        ['Subject', body.subject],
        ['Requester', body.requester],
        ['Project', body.project_id],
        ['Assignment Queue', body.queue],
      ])) return;
      if (id) {
        // The whole body goes to PATCH: requester/project_id used to be stripped here,
        // and were missing from TicketUpdate besides, so editing either one appeared to
        // do nothing at all.
        await patch(`/api/tickets/${id}`, body);
        toast('Ticket updated');
      } else {
        await post('/api/tickets', body);
        toast('Ticket created');
      }
      closeModal('modal-ticket'); startCreate('page-service-desk'); loadServiceDesk();
    });


    // Users
    wireAlphaInput('modal-user', 'full name');
    wireEmailInput('modal-user');
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
      if (invalidEmail('modal-user', body.email)) return;
      if (id) { await patch(`/api/users/${id}`, { name: body.name, email: body.email, role: body.role }); toast('User updated'); }
      else {
        if (missingFields([['Full Name', body.name], ['Email', body.email]])) return;
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
      if (missingFields([['User', body.user], ['Module', body.module], ['Action', body.action]])) return;
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
        set('modal-company', 'client name', row.name);
        set('modal-company', 'industry', row.industry);
        set('modal-company', 'primary contact', row.primary_contact || '');
        set('modal-company', 'email', row.email || '');
        set('modal-company', 'phone', row.phone || '');
        set('modal-company', 'gstin', row.gstin || '');
        set('modal-company', 'billing address', row.billing_address || '');
        set('modal-company', 'status', row.status);
        startEdit('page-companies', row.id);
        openModal('modal-company');
        return;
      }
      const delBtn = e.target.closest('.bridge-delete[data-page="page-companies"]');
      if (delBtn) {
        if (!confirm('Delete this client?')) return;
        await del(`/api/companies/${delBtn.dataset.id}`);
        toast('Client deleted');
        loadCompanies();
      }
    });

    // Customers edit/delete button delegation (shared backend with Companies)
    document.addEventListener('click', async e => {
      const editBtn = e.target.closest('.bridge-edit[data-page="page-customers"]');
      if (editBtn) {
        const row = state.companies.find(c => String(c.id) === editBtn.dataset.id);
        if (!row) return;
        set('modal-company', 'client name', row.name);
        set('modal-company', 'industry', row.industry);
        set('modal-company', 'primary contact', row.primary_contact || '');
        set('modal-company', 'email', row.email || '');
        set('modal-company', 'phone', row.phone || '');
        set('modal-company', 'gstin', row.gstin || '');
        set('modal-company', 'billing address', row.billing_address || '');
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
        // This row's own project is "taken" by this row, so the list has to be rebuilt
        // keeping it before the value can be selected.
        populatePCodeProjectDropdown(row.project_id);
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
        // This row's own project code is "taken" by this row, so the list has to be
        // rebuilt keeping it before the value can be selected.
        populateBCodeProjectCodeDropdown(row.project_code_id);
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
        setChecked('modal-emp', 'allow pr manager', row.pm_access_enabled);
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
        // Each list is filtered by the one above it, so it has to be rebuilt for this
        // row's project/code before its value can be selected — set() silently does
        // nothing when the <option> isn't present.
        populateExpProjectCodeSelect(row.project_id || '', row.project_code_id || '');
        populateExpBillingCodeSelect(row.project_code_id || '', row.billing_code_id || '');
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
      // `.bridge-view` now lives on the whole row (see ApprovalsPage.jsx), not a
      // separate button, so a click on Approve/Reject inside that same row would
      // otherwise also satisfy `closest('.bridge-view[data-module]')` and get treated
      // as "view" before the approve/reject checks below ever run — excluded here.
      const viewBtn = e.target.closest('.bridge-view[data-module]');
      if (viewBtn && !e.target.closest('.bridge-approve, .bridge-reject')) {
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
        // Every field the form can save has to be loaded here. Requester and Project
        // were left out, so they kept whatever the previous ticket put in the DOM and
        // the form showed one ticket's subject beside another's requester.
        set('modal-ticket', 'subject', row.subject);
        set('modal-ticket', 'requester', row.requester || '');
        set('modal-ticket', 'project', row.project_id || '');
        set('modal-ticket', 'assignment queue', row.queue || '');
        set('modal-ticket', 'priority', row.priority || 'Medium');
        setTicketModalMode(true);
        populateTicketStatusSelect(row.status);
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
