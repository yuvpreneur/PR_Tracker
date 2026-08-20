"""
Dynamic, DB-driven role permission matrix — the single source of truth for
what each role can do, per module. Admin and Manager both always have full
access and never consult the DB (Manager is Admin-equivalent everywhere
except managing Admin/Manager user accounts — see app/routers/users.py).
Every other role falls back to DEFAULT_PERMS for any module an Admin hasn't
explicitly customized in the `role_permissions` collection.
"""

import re
from typing import List, Optional

from pymongo.database import Database

from app.core import collections

MODULES = [
    "Companies", "Projects", "Project Codes", "Billing Codes", "Employees", "Hourly Costs",
    "Timesheets", "Expenses", "Leave", "Service Desk", "Receivables", "Invoices",
    "Reports", "Approvals", "Payroll",
]

# Roles that bypass the DB-driven matrix entirely and always get full access
# (see get_role_permissions()/get_effective_permissions()/has_permission() below).
# Manager's only carve-out from true Admin parity is account management for
# Admin/Manager-role users themselves (app/routers/users.py's PRIVILEGED_ROLES).
FULL_ACCESS_ROLES = ("Admin", "Manager")

# Platform-level roles with no organization of their own (see app/routers/organizations.py,
# app/routers/sub_admins.py) — zero access to any business module, full stop. Checked
# explicitly in get_effective_permissions() below rather than left to fall through to
# get_role_permissions()'s DEFAULT_PERMS.get(role, DEFAULT_PERMS["Viewer"]) fallback:
# that fallback exists so a genuinely unrecognized *org-level* role degrades to
# Viewer's read-only access rather than crashing, but Viewer-equivalent access
# (Employees, Timesheets, etc. all default to view=True) is very much not "no access,"
# and neither a Super Admin nor a Sub Admin token hitting has_permission() must ever
# get any of it — Sub Admin's access is governed entirely by platform_permissions /
# require_platform_permission() (app/core/security.py), a separate mechanism.
NO_ORG_ROLES = ("Super Admin", "Sub Admin")


def _flags(view=False, create=False, edit=False, delete=False, approve=False, export=False):
    return {"view": view, "create": create, "edit": edit, "delete": delete, "approve": approve, "export": export}


_FULL = _flags(True, True, True, True, True, True)

DEFAULT_PERMS = {
    "Admin": {m: dict(_FULL) for m in MODULES},

    # Finance User — owns money-side config and collections: billing codes/rates, hourly
    # costs, receivables, final expense approval. Read-only financial context on
    # Companies/Projects/Reports/Employees. No Timesheets visibility (HR-flavored, outside
    # their remit) — Timesheets/Leave fall back to each router's own-record self-service
    # bypass instead (SELF_SERVICE_MODULES above), same as Employee.
    # Service Desk is deliberately all-False here too: full ticket access is
    # scoped to FINANCE_QUEUES + their own tickets, enforced directly in tickets.py rather
    # than through this blanket view/edit/approve matrix. Companies/Projects/Project Codes/
    # Billing Codes/Employees are all view (+ export) only, full stop — reference/financial
    # context this role can see in full (same unrestricted visibility as Manager, via the
    # assigned_project_ids() carve-out below for the first four) but never create, edit, or
    # delete.
    "Finance User": {
        "Companies":        _flags(view=True, export=True),
        "Projects":         _flags(view=True, export=True),
        "Project Codes":    _flags(view=True, export=True),
        "Billing Codes":    _flags(view=True, export=True),
        "Employees":        _flags(view=True, export=True),
        "Hourly Costs":     _flags(view=True, create=True, edit=True, export=True),
        "Timesheets":       _flags(),
        # "approve" here is descriptive, not authoritative — expenses.py hardcodes the real
        # two-stage gate (Manager confirms business purpose, then Finance validates policy
        # and posts payment) by role check, bypassing this flag entirely, the same way
        # Access Requests bypasses the matrix via require_role(). Toggling this checkbox in
        # the Roles & Permissions UI has no effect on Expenses approval.
        "Expenses":         _flags(view=True, create=True, edit=True, approve=True, export=True),
        "Leave":            _flags(),
        "Service Desk":     _flags(),
        "Receivables":      _flags(view=True, create=True, edit=True, export=True),
        "Invoices":         _flags(view=True, create=True, edit=True, export=True),
        "Reports":          _flags(view=True, export=True),
        "Approvals":        _flags(view=True),
        # Payroll is the one HR-flavored module Finance User does get real access to —
        # running payroll is money-side work even though it lives next to Employees/Leave.
        # Delete is still off, same as every other module here (Admin/Manager-exclusive,
        # enforced role-wide in get_role_permissions() regardless of this flag).
        "Payroll":          _flags(view=True, create=True, edit=True, export=True),
    },

    # Employee — self-service only. Every module below is intentionally all-false:
    # self create/view-own/edit-own-pending is handled per-router, outside this matrix.
    # Companies/Projects/Project Codes have no blanket "view" right by default either —
    # an Employee's actual visibility into those three is per-employee, via Access
    # Control's Assigned Projects grants (assigned_project_ids() in this file), not a
    # role-wide default. An Admin can still additionally grant one of those modules'
    # nav/page visibility to a specific employee via Access Control's Page Access
    # override, independent of this row.
    "Employee": {
        "Companies":        _flags(),
        "Projects":         _flags(),
        "Project Codes":    _flags(),
        "Billing Codes":    _flags(),
        "Employees":        _flags(),
        "Hourly Costs":     _flags(),
        "Timesheets":       _flags(),
        "Expenses":         _flags(),
        "Leave":            _flags(),
        "Service Desk":     _flags(),
        "Receivables":      _flags(),
        "Invoices":         _flags(),
        "Reports":          _flags(),
        "Approvals":        _flags(),
        "Payroll":          _flags(),
    },

    # Viewer — read-only across the board, no approvals, no money-config editing.
    "Viewer": {
        "Companies":        _flags(view=True, export=True),
        "Projects":         _flags(view=True, export=True),
        "Project Codes":    _flags(view=True),
        "Billing Codes":    _flags(),
        "Employees":        _flags(view=True),
        "Hourly Costs":     _flags(),
        "Timesheets":       _flags(view=True, export=True),
        "Expenses":         _flags(view=True, export=True),
        "Leave":            _flags(view=True, export=True),
        "Service Desk":     _flags(view=True, export=True),
        "Receivables":      _flags(view=True, export=True),
        "Invoices":         _flags(view=True, export=True),
        "Reports":          _flags(view=True, export=True),
        "Approvals":        _flags(),
        "Payroll":          _flags(view=True),
    },
}


def get_role_permissions(db: Database, role: str, org_id) -> dict:
    """Effective {module: {view,create,edit,delete,approve,export}} for a role, within
    one org. Takes org_id explicitly rather than a current_user, since this is also
    called to inspect a role that isn't the caller's own (an Admin previewing another
    role's matrix, or resolving a *target* employee's role) — the org context in every
    such case is always the caller's own org, never inferred from the role being looked up.

    Admin and Manager both always get full access without touching the DB (see
    FULL_ACCESS_ROLES). Any module an Admin hasn't explicitly saved for another
    role falls back to DEFAULT_PERMS, so partial customization never silently
    blanks out the rest of the matrix.
    """
    if role in FULL_ACCESS_ROLES:
        return {m: dict(_FULL) for m in MODULES}

    defaults = DEFAULT_PERMS.get(role, DEFAULT_PERMS["Viewer"])
    rows = list(db[collections.ROLE_PERMISSIONS].find({"role": role, "org_id": org_id}))
    if not rows:
        return {m: dict(defaults[m]) for m in MODULES}

    saved = {
        r["module"]: {
            "view": r["view"], "create": r["create"], "edit": r["edit"],
            "delete": r["delete"], "approve": r["approve"], "export": r["export"],
        }
        for r in rows
    }
    result = {m: dict(saved.get(m, defaults[m])) for m in MODULES}
    # Deletion is exclusive to Admin/Manager (FULL_ACCESS_ROLES above), full stop —
    # never delegable to any other role via this matrix, even if a stale/manually-
    # edited role_permissions row says otherwise. save_role_permissions()
    # (role_permissions.py) enforces the same rule on write.
    for m in result:
        result[m]["delete"] = False
    return result


def my_emp_ids(db: Database, current_user) -> set:
    # Case-insensitive: User.name and Employees.name are two independently-typed fields
    # (User accounts are created via a separate form from Employee records) and have been
    # found to differ only in case for real accounts (e.g. User "anya" vs Employee "Anya")
    # — an exact match would silently fail to link them, which now that assigned_project_ids()
    # restricts-by-default on no match would incorrectly lock that person out of everything.
    # org_id scoped too: two different orgs can each have their own "Anya" — a bare name
    # match without it would resolve to whichever org's Employees doc happens to match.
    pattern = f"^{re.escape(current_user.name)}$"
    return {
        e["emp_id"] for e in
        db[collections.EMPLOYEES].find(
            {"name": {"$regex": pattern, "$options": "i"}, "org_id": current_user.org_id},
            {"emp_id": 1},
        )
    }


def own_emp_id(db: Database, current_user):
    """The current user's own Employees._id, or None (e.g. Admin has no Employees row)."""
    return next(iter(my_emp_ids(db, current_user)), None)


def assigned_project_ids(db: Database, current_user) -> Optional[List[str]]:
    """None only for Admin/Manager — genuinely unrestricted, skip filtering entirely.
    Every other role is restricted by default: an empty list (not None) is returned for
    an employee with no Access Control -> Assigned Projects rows saved yet, or with no
    Employees record at all, so they see NOTHING in Projects/Companies/Project Codes/
    Billing Codes until an Admin/Manager explicitly assigns them at least one project.
    Callers only need `if assigned_ids is not None: filter by $in assigned_ids` — an
    empty list there already yields zero rows, no separate no-rows-yet case to handle.
    Project Codes and Billing Codes are each tied to exactly one project_id (see
    project_codes.py/billing_codes.py), so they reuse this same allow-list rather than
    getting their own separate Assigned Projects-style checkbox list — being assigned a
    project already implies seeing that project's codes.
    Finance User is the one role-wide exception: Projects, Companies, Project Codes, and
    Billing Codes (projects.py/companies.py/project_codes.py/billing_codes.py each bypass
    this function directly for that role, same as Admin/Manager) are all unrestricted —
    every record is visible regardless of assigned projects, same as Manager, though
    DEFAULT_PERMS's "Finance User" row keeps create/edit/delete off across all four."""
    if current_user.role in FULL_ACCESS_ROLES:
        return None
    emp_id = own_emp_id(db, current_user)
    if not emp_id:
        return []
    assigned = list(db[collections.PROJECT_PERMISSIONS].find({"emp_id": emp_id, "org_id": current_user.org_id}))
    return [a["project_id"] for a in assigned if a["allowed"]]


# Self-service modules — routers for these already let an Employee (or any non-Viewer
# role) see their OWN records regardless of the role matrix's "view" flag (that flag only
# controls whether they see EVERYONE's records). Mirrored on the frontend by
# OWN_RECORD_PAGES in bridge/shared/permissions.js. This bypass is intentionally kept OUT
# of get_effective_permissions()/has_permission() below — those two answer "does this role
# have blanket view-ALL-records rights," which per-router self-service scoping depends on
# staying accurate (see list_timesheets() etc: `has_permission(...,"view")` decides whether
# to scope the query to "mine"). It's only used by effective_view_default() as a UI-only
# helper for what an unconfigured Page Access checkbox should default to (see
# app/routers/access_control.py's GET /pages/{emp_id}) — a *different* question ("does this
# person currently see this page's nav item at all") from what has_permission() answers.
SELF_SERVICE_MODULES = {"Timesheets", "Leave", "Service Desk", "Expenses", "Payroll"}


def effective_view_default(role_perms: dict, role: str, module: str) -> bool:
    """Whether `role` currently sees `module`'s page/nav item at all (self-service-aware),
    before any per-employee Page Access override. UI-defaulting helper only — see the
    SELF_SERVICE_MODULES note above for why has_permission() does NOT use this."""
    if role_perms.get(module, {}).get("view"):
        return True
    return module in SELF_SERVICE_MODULES and role != "Viewer"


def get_org_plan_features(db: Database, org_id) -> set:
    """The set of MODULES this org's active Subscription Plan actually grants (see
    app/routers/subscriptions.py) — empty if the org has no subscription, an inactive
    one, or no plan_id set at all. Deliberately fails closed: an org with nothing
    assigned gets zero business-module access, not everything (see
    app/scripts/backfill_full_access_plan.py, which must run before this is ever
    live against real data, so no pre-existing organization is locked out by this)."""
    if not org_id:
        return set()
    sub = db[collections.SUBSCRIPTIONS].find_one({"_id": org_id})
    if not sub or not sub.get("is_active") or not sub.get("plan_id"):
        return set()
    plan = db[collections.SUBSCRIPTION_PLANS].find_one({"_id": sub["plan_id"]})
    if not plan:
        return set()
    return set(plan.get("features", []))


def get_effective_permissions(db: Database, current_user) -> dict:
    """`get_role_permissions()` with the current user's own per-employee Page Access
    overrides (app/routers/access_control.py) layered onto "view", then intersected
    with the org's active Subscription Plan features (get_org_plan_features() above) —
    a module the plan doesn't include comes back all-False regardless of role, Admin
    included. This is why has_permission() below no longer short-circuits
    FULL_ACCESS_ROLES on its own: that bypass has to go through this same filter, not
    around it, or Admin/Manager (who actually use these modules day to day) would
    never be restricted by the org's plan at all.
    Only "view" is ever overridden by Page Access; create/edit/delete/approve/export
    stay role-only. Deliberately does NOT apply the SELF_SERVICE_MODULES bypass — see
    the note above."""
    if current_user.role in NO_ORG_ROLES:
        return {m: _flags() for m in MODULES}

    if current_user.role in FULL_ACCESS_ROLES:
        base = {m: dict(_FULL) for m in MODULES}
    else:
        base = {m: dict(v) for m, v in get_role_permissions(db, current_user.role, current_user.org_id).items()}
        emp_id = own_emp_id(db, current_user)
        if emp_id:
            for row in db[collections.PAGE_PERMISSIONS].find({"emp_id": emp_id, "org_id": current_user.org_id}):
                if row["page"] in base:
                    base[row["page"]]["view"] = bool(row["allowed"])

    allowed_modules = get_org_plan_features(db, current_user.org_id)
    return {m: (base[m] if m in allowed_modules else _flags()) for m in MODULES}


def has_permission(db: Database, current_user, module: str, action: str) -> bool:
    return bool(get_effective_permissions(db, current_user).get(module, {}).get(action))


def is_own_emp_record(db: Database, current_user, emp_id) -> bool:
    # Viewer is read-only across the board — this bypass exists so Employee/Manager/etc.
    # can create/edit their OWN record on self-service modules despite an all-False matrix
    # row, not to grant Viewer any write path. Mirrors OWN_RECORD_PAGES's `role !== 'Viewer'`
    # rule on the frontend (bridge/shared/permissions.js).
    if current_user.role == "Viewer":
        return False
    return bool(emp_id) and emp_id in my_emp_ids(db, current_user)


def is_own_record(current_user, owner_name) -> bool:
    # See is_own_emp_record() above — same Viewer exclusion, same reason. Several routers
    # match this against a client-supplied "owner" field at creation time (e.g. expenses,
    # tickets), so without this check a Viewer could self-report as the record's
    # owner and slip through despite the matrix's create/edit flags being False.
    if current_user.role == "Viewer":
        return False
    return bool(owner_name) and owner_name == current_user.name
