// Real permission gating — reads useAuth()'s user.permissions/user.page_overrides (from
// GET /api/auth/me, fetched once by AuthProvider), which mirrors exactly what the backend's
// require_permission() dependency enforces. Ported from src/bridge/shared/permissions.js as
// part of the bridge-removal migration (Phase 1): same rules, but driven by the real
// AuthContext instead of the legacy mutable `state` object, and returned as hook-bound
// functions instead of free functions reading a global.
import useAuth from './useAuth.jsx';

// nav page-id (e.g. "timesheets", not "page-timesheets") -> backend module name in the
// dynamic Roles & Permissions matrix. Pages with no entry here (dashboard, payslips)
// have no module concept and are always visible — payslips is self-service, scoped
// server-side to the caller's own record(s) regardless of the Payroll module's view flag.
export const PAGE_MODULE_MAP = {
  'reports':        'Reports',
  'companies':      'Companies',
  'customers':      'Companies',     // shares the Companies backend (finance-facing view)
  'projects':       'Projects',
  'project-codes':  'Project Codes',
  'billing-codes':  'Billing Codes',
  'service-desk':   'Service Desk',
  'employees':      'Employees',
  'hourly-cost':    'Hourly Costs',
  'timesheets':     'Timesheets',
  'leave':          'Leave',
  'expenses':       'Expenses',
  'invoices':       'Invoices',
  'receivables':    'Receivables',
  'approvals':      'Approvals',
  'payroll':        'Payroll',
};

// Roles that bypass every gate below and always get full access — mirrors
// FULL_ACCESS_ROLES in app/core/permissions.py. Manager's only carve-out from true
// Admin parity is managing Admin/Manager user accounts themselves (see UsersPage.jsx).
const FULL_ACCESS_ROLES = new Set(['Admin', 'Manager']);

// Pages Employee is explicitly cut off from, hardcoded rather than matrix-driven:
// 'customers' is the finance-facing view of the same Companies records
// (see useCustomers.js) — Employee keeps plain Companies access as reference data, but not
// this presentation of it. 'payroll' is now matrix-driven via PAGE_MODULE_MAP above —
// Employee's all-False DEFAULT_PERMS "Payroll" row already blocks it, no hardcode needed.
const EMPLOYEE_EXCLUDED_PAGES = new Set(['customers']);

// Finance User is cut off from Service Desk (no access at all, not even their own
// tickets — this overrides the OWN_RECORD_PAGES self-service bypass below since this
// check runs first). Mirrors tickets.py, which blocks Finance User outright rather than
// falling back to is_own_record(). Payroll is matrix-driven (Finance User gets real
// access per DEFAULT_PERMS — see app/core/permissions.py), no hardcode needed here.
const FINANCE_USER_EXCLUDED_PAGES = new Set(['service-desk']);

// Hardcoded Admin/Manager-only pages — deliberately NOT part of PAGE_MODULE_MAP/the
// dynamic Roles & Permissions matrix (see usePageAccess.js's PAGES list comment), and every
// backing endpoint for these already requires require_role("Admin","Manager") server-side
// (users.py, role_permissions.py, access_control.py, audit_log.py, settings.py). Without this,
// PAGE_MODULE_MAP has no entry for any of them, so canViewPage() would otherwise fall
// through to "always visible" — every role, including Employee/Finance User/Viewer, would
// see nav items whose data fetches then just 403 underneath them.
const ADMIN_MANAGER_ONLY_PAGES = new Set(['users', 'roles', 'access-control', 'audit', 'settings']);

// Self-submitted-record modules — an Employee always has view/create/edit-while-pending
// on their OWN rows regardless of the matrix, so the page itself must stay visible even
// when the matrix's "view" (view-all) flag is false for their role. Mirrors
// SELF_SERVICE_MODULES in app/core/permissions.py.
const OWN_RECORD_PAGES = new Set(['timesheets', 'leave', 'service-desk', 'expenses']);

export default function usePermissions() {
  const { user } = useAuth();
  const role = user?.role;
  const permissions = user?.permissions || {};
  const pageOverrides = user?.page_overrides || {};

  const can = (module, action) => permissions?.[module]?.[action] === true;

  const canViewPage = pageId => {
    if (!role) return true; // /me hasn't resolved yet — don't flash everything locked
    // Admin/Manager-only static pages have no module/plan concept at all — always gated
    // purely by role, never by the org's Subscription Plan.
    if (ADMIN_MANAGER_ONLY_PAGES.has(pageId)) return FULL_ACCESS_ROLES.has(role);
    if (EMPLOYEE_EXCLUDED_PAGES.has(pageId) && role === 'Employee') return false;
    if (FINANCE_USER_EXCLUDED_PAGES.has(pageId) && role === 'Finance User') return false;
    const module = PAGE_MODULE_MAP[pageId];
    if (!module) return true;
    // An explicit per-employee Page Access grant/denial (Access Control page) is
    // authoritative — it wins over both the role matrix and the self-service bypass below.
    if (Object.prototype.hasOwnProperty.call(pageOverrides, module)) {
      return pageOverrides[module] === true;
    }
    if (can(module, 'view')) return true;
    // Admin/Manager must go through the plan-filtered check above like everyone else —
    // mirrors get_effective_permissions() in app/core/permissions.py, which no longer
    // bypasses FULL_ACCESS_ROLES around the org's plan filter. Falling into the
    // self-service bypass below would let Admin/Manager see a module the plan excludes.
    if (FULL_ACCESS_ROLES.has(role)) return false;
    if (OWN_RECORD_PAGES.has(pageId) && role !== 'Viewer') return true;
    return false;
  };

  const canCreateOnPage = pageId => {
    if (!role) return true;
    // Timesheets are self-submitted under the logged-in user's own employee record;
    // Admin has no Employees row, so Admin's role on this module is approve-only.
    if (pageId === 'timesheets' && role === 'Admin') return false;
    if (OWN_RECORD_PAGES.has(pageId) && !FULL_ACCESS_ROLES.has(role)) return role !== 'Viewer'; // self-service create is always available
    const module = PAGE_MODULE_MAP[pageId];
    if (!module) return true;
    return can(module, 'create');
  };

  const canExportOnPage = pageId => {
    if (!role) return true;
    const module = PAGE_MODULE_MAP[pageId];
    if (!module) return true;
    return can(module, 'export');
  };

  // Whether the current user could NEVER perform any row action (Edit/Delete/Approve/etc.)
  // on this table at all — used to hide the whole Actions column instead of leaving it
  // permanently empty. Self-service pages keep the column for any non-Viewer role, since
  // they can always end up with an editable/deletable own-record row.
  const noActionsColumn = pageId => {
    if (!role) return false;
    // Leave has no edit/delete endpoint at all (by design) — its Actions column is
    // Approve/Reject only, so the general "self-service always keeps the column" rule
    // below doesn't apply; hide it whenever approve permission is absent.
    if (pageId === 'leave') return !can('Leave', 'approve');
    // Timesheets: hidden outright for Employee/Finance User by request, even though an
    // Employee could otherwise still edit their own Pending entry (self-service bypass) —
    // unlike Service Desk/Expenses below, which keep that carve-out. Admin/Manager keep
    // the column (they approve/reject timesheets, unlike every other role here).
    if (pageId === 'timesheets' && !FULL_ACCESS_ROLES.has(role)) return true;
    // Expenses: same "hidden outright by request" treatment, but Employee-only — Finance
    // User still needs the column for their Pending Finance approve/reject actions, so
    // this can't be a blanket rule for the page like Timesheets above.
    if (pageId === 'expenses' && role === 'Employee') return true;
    if (OWN_RECORD_PAGES.has(pageId) && !FULL_ACCESS_ROLES.has(role)) return role === 'Viewer';
    const module = PAGE_MODULE_MAP[pageId];
    if (!module) return false;
    return !can(module, 'edit') && !can(module, 'delete');
  };

  const isMine = (row, ownerField, ownerValue) => {
    if (!user) return false;
    if (ownerValue !== undefined) return ownerValue === user.name;
    return row?.[ownerField] === user.name;
  };

  return { can, canViewPage, canCreateOnPage, canExportOnPage, noActionsColumn, isMine, role };
}
