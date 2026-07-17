// Real permission gating — reads state.permissions (from GET /api/auth/me),
// which mirrors exactly what the backend's require_permission() dependency enforces.
import { state } from '../core/state.js';

// nav page-id (as used by hasPageAccess/navigate in appScript, e.g. "timesheets",
// not "page-timesheets") -> backend module name in the dynamic Roles & Permissions matrix.
// Pages with no entry here (dashboard, payroll, payslips) have no module concept and
// are always visible — payroll is reverted/static-demo, payslips is self-service.
export const PAGE_MODULE_MAP = {
  'reports':        'Reports',
  'companies':      'Companies',
  'customers':      'Companies',     // shares the Companies backend (finance-facing view)
  'projects':       'Projects',
  'project-codes':  'Project Codes',
  'billing-codes':  'Billing Codes',
  'leads':          'Lead Management',
  'service-desk':   'Service Desk',
  'employees':      'Employees',
  'hourly-cost':    'Hourly Costs',
  'attendance':     'Attendance',
  'timesheets':     'Timesheets',
  'leave':          'Leave',
  'expenses':       'Expenses',
  'invoices':       'Receivables',   // shares the Receivables backend
  'receivables':    'Receivables',
  'approvals':      'Approvals',
};

// Outside the dynamic matrix by design (see app/core/permissions.py) — stay hardcoded
// to mirror each page's backend router exactly (Users/Roles/Access Control/Audit
// Log/Settings can never be reconfigured via the permissions matrix itself).
const ADMIN_ONLY_PAGES = new Set(['roles', 'access-control', 'audit', 'settings']);
const ADMIN_MANAGER_PAGES = new Set(['users']);

// Pages Employee is explicitly cut off from, hardcoded like ADMIN_ONLY_PAGES above rather
// than matrix-driven: 'customers' is the finance-facing view of the same Companies records
// (see useCustomers.js) — Employee keeps plain Companies access as reference data, but not
// this presentation of it. 'payroll' has no module/matrix concept at all (it's reverted to
// a static demo page, PAGE_MODULE_MAP has no entry for it, so it'd otherwise fall through
// to "always visible").
const EMPLOYEE_EXCLUDED_PAGES = new Set(['customers', 'payroll']);

// Self-submitted-record modules — an Employee always has view/create/edit-while-pending
// on their OWN rows regardless of the matrix, so the page itself must stay visible even
// when the matrix's "view" (view-all) flag is false for their role. Expenses is
// deliberately NOT in this set — Employees have no self-service access to it at all.
const OWN_RECORD_PAGES = new Set(['timesheets', 'attendance', 'leave', 'service-desk', 'leads']);

export function can(module, action) {
  return state.permissions?.[module]?.[action] === true;
}

export function canViewPage(pageId) {
  const role = state.currentUser?.role;
  if (!role) return true; // /me hasn't resolved yet — don't flash everything locked
  if (role === 'Admin') return true;
  if (ADMIN_ONLY_PAGES.has(pageId)) return false;
  if (ADMIN_MANAGER_PAGES.has(pageId)) return role === 'Manager';
  if (EMPLOYEE_EXCLUDED_PAGES.has(pageId) && role === 'Employee') return false;
  const module = PAGE_MODULE_MAP[pageId];
  if (!module) return true;
  // An explicit per-employee Page Access grant/denial (Access Control page) is
  // authoritative — it wins over both the role matrix and the self-service bypass below.
  if (Object.prototype.hasOwnProperty.call(state.pageOverrides || {}, module)) {
    return state.pageOverrides[module] === true;
  }
  if (can(module, 'view')) return true;
  if (OWN_RECORD_PAGES.has(pageId) && role !== 'Viewer') return true;
  return false;
}

export function canCreateOnPage(pageId) {
  const role = state.currentUser?.role;
  if (!role) return true;
  // Timesheets are self-submitted under the logged-in user's own employee record;
  // Admin has no Employees row, so Admin's role on this module is approve-only.
  if (pageId === 'timesheets' && role === 'Admin') return false;
  if (role === 'Admin') return true;
  if (ADMIN_ONLY_PAGES.has(pageId)) return false;
  if (ADMIN_MANAGER_PAGES.has(pageId)) return false; // creating a user is Admin-only, even though Manager can view the list
  if (OWN_RECORD_PAGES.has(pageId)) return role !== 'Viewer'; // self-service create is always available
  const module = PAGE_MODULE_MAP[pageId];
  if (!module) return true;
  return can(module, 'create');
}

export function canExportOnPage(pageId) {
  const role = state.currentUser?.role;
  if (!role) return true;
  if (role === 'Admin') return true;
  if (ADMIN_ONLY_PAGES.has(pageId) || ADMIN_MANAGER_PAGES.has(pageId)) return false;
  const module = PAGE_MODULE_MAP[pageId];
  if (!module) return true;
  return can(module, 'export');
}

// Whether the current user could NEVER perform any row action (Edit/Delete/Approve/etc.)
// on this table at all — used to hide the whole Actions column instead of leaving it
// permanently empty. Self-service pages keep the column for any non-Viewer role, since
// they can always end up with an editable/deletable own-record row.
export function noActionsColumn(pageId) {
  const role = state.currentUser?.role;
  if (!role || role === 'Admin') return false;
  if (ADMIN_ONLY_PAGES.has(pageId) || ADMIN_MANAGER_PAGES.has(pageId)) return true;
  // Leave has no edit/delete endpoint at all (by design) — its Actions column is
  // Approve/Reject only, so the general "self-service always keeps the column" rule
  // below doesn't apply; hide it whenever approve permission is absent.
  if (pageId === 'leave') return !can('Leave', 'approve');
  if (OWN_RECORD_PAGES.has(pageId)) return role === 'Viewer';
  const module = PAGE_MODULE_MAP[pageId];
  if (!module) return false;
  return !can(module, 'edit') && !can(module, 'delete');
}

export function isMine(row, ownerField, ownerValue) {
  const cu = state.currentUser;
  if (!cu) return false;
  if (ownerValue !== undefined) return ownerValue === cu.name;
  return row?.[ownerField] === cu.name;
}
