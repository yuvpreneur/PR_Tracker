"""
Dynamic, DB-driven role permission matrix — the single source of truth for
what each role can do, per module. Admin always has full access and never
consults the DB. Every other role falls back to DEFAULT_PERMS for any module
an Admin hasn't explicitly customized in the `role_permissions` collection.
"""

from pymongo.database import Database

from app.core import collections

MODULES = [
    "Companies", "Projects", "Project Codes", "Billing Codes", "Employees", "Hourly Costs",
    "Timesheets", "Expenses", "Attendance", "Leave", "Service Desk", "Receivables",
    "Lead Management", "Reports", "Approvals",
]


def _flags(view=False, create=False, edit=False, delete=False, approve=False, export=False):
    return {"view": view, "create": create, "edit": edit, "delete": delete, "approve": approve, "export": export}


_FULL = _flags(True, True, True, True, True, True)

DEFAULT_PERMS = {
    "Admin": {m: dict(_FULL) for m in MODULES},

    # Manager — runs delivery: projects, people, billing-related codes, timesheets/expenses/
    # attendance approval, service desk, sales pipeline. Not the cost-rate owner (Hourly
    # Costs) and never deletes outright — that stays Admin-only (see has_permission()).
    "Manager": {
        "Companies":        _flags(view=True, create=True, edit=True, export=True),
        "Projects":         _flags(view=True, create=True, edit=True, export=True),
        "Project Codes":    _flags(view=True, create=True, edit=True, export=True),
        "Billing Codes":    _flags(view=True, create=True, edit=True, export=True),
        "Employees":        _flags(view=True, create=True, edit=True, export=True),
        "Hourly Costs":     _flags(view=True),
        "Timesheets":       _flags(view=True, create=True, edit=True, approve=True, export=True),
        "Expenses":         _flags(view=True, create=True, edit=True, approve=True, export=True),
        "Attendance":       _flags(view=True, create=True, edit=True, approve=True, export=True),
        "Leave":            _flags(view=True, approve=True, export=True),
        "Service Desk":     _flags(view=True, edit=True, approve=True, export=True),
        "Receivables":      _flags(view=True, export=True),
        "Lead Management":  _flags(view=True, create=True, edit=True, approve=True, export=True),
        "Reports":          _flags(view=True, export=True),
        "Approvals":        _flags(view=True),
    },

    # Finance User — owns money-side config and collections: billing rates, cost rates,
    # receivables, expense approval. Read-only context on projects/people/pipeline.
    "Finance User": {
        "Companies":        _flags(view=True, export=True),
        "Projects":         _flags(view=True, export=True),
        "Project Codes":    _flags(view=True, export=True),
        "Billing Codes":    _flags(view=True, create=True, edit=True, export=True),
        "Employees":        _flags(view=True, export=True),
        "Hourly Costs":     _flags(view=True, create=True, edit=True, export=True),
        "Timesheets":       _flags(view=True, export=True),
        "Expenses":         _flags(view=True, create=True, edit=True, approve=True, export=True),
        "Attendance":       _flags(view=True),
        "Leave":            _flags(),
        "Service Desk":     _flags(view=True, export=True),
        "Receivables":      _flags(view=True, create=True, edit=True, export=True),
        "Lead Management":  _flags(view=True, export=True),
        "Reports":          _flags(view=True, export=True),
        "Approvals":        _flags(view=True),
    },

    # Employee — self-service only. Every module below is intentionally all-false:
    # self create/view-own/edit-own-pending is handled per-router, outside this matrix.
    "Employee": {
        "Companies":        _flags(view=True),
        "Projects":         _flags(view=True),
        "Project Codes":    _flags(view=True),
        "Billing Codes":    _flags(),
        "Employees":        _flags(),
        "Hourly Costs":     _flags(),
        "Timesheets":       _flags(),
        "Expenses":         _flags(),
        "Attendance":       _flags(),
        "Leave":            _flags(),
        "Service Desk":     _flags(),
        "Receivables":      _flags(),
        "Lead Management":  _flags(),
        "Reports":          _flags(),
        "Approvals":        _flags(),
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
        "Attendance":       _flags(view=True, export=True),
        "Leave":            _flags(view=True, export=True),
        "Service Desk":     _flags(view=True, export=True),
        "Receivables":      _flags(view=True, export=True),
        "Lead Management":  _flags(view=True, export=True),
        "Reports":          _flags(view=True, export=True),
        "Approvals":        _flags(),
    },
}


def get_role_permissions(db: Database, role: str) -> dict:
    """Effective {module: {view,create,edit,delete,approve,export}} for a role.

    Admin always gets full access without touching the DB. Any module an Admin
    hasn't explicitly saved for a role falls back to DEFAULT_PERMS, so partial
    customization never silently blanks out the rest of the matrix.
    """
    if role == "Admin":
        return {m: dict(_FULL) for m in MODULES}

    defaults = DEFAULT_PERMS.get(role, DEFAULT_PERMS["Viewer"])
    rows = list(db[collections.ROLE_PERMISSIONS].find({"role": role}))
    if not rows:
        return {m: dict(defaults[m]) for m in MODULES}

    saved = {
        r["module"]: {
            "view": r["view"], "create": r["create"], "edit": r["edit"],
            "delete": r["delete"], "approve": r["approve"], "export": r["export"],
        }
        for r in rows
    }
    return {m: saved.get(m, defaults[m]) for m in MODULES}


def my_emp_ids(db: Database, current_user) -> set:
    return {e["emp_id"] for e in db[collections.EMPLOYEES].find({"name": current_user.name}, {"emp_id": 1})}


def own_emp_id(db: Database, current_user):
    """The current user's own Employees._id, or None (e.g. Admin has no Employees row)."""
    return next(iter(my_emp_ids(db, current_user)), None)


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
SELF_SERVICE_MODULES = {"Timesheets", "Attendance", "Leave", "Service Desk", "Lead Management"}


def effective_view_default(role_perms: dict, role: str, module: str) -> bool:
    """Whether `role` currently sees `module`'s page/nav item at all (self-service-aware),
    before any per-employee Page Access override. UI-defaulting helper only — see the
    SELF_SERVICE_MODULES note above for why has_permission() does NOT use this."""
    if role_perms.get(module, {}).get("view"):
        return True
    return module in SELF_SERVICE_MODULES and role != "Viewer"


def get_effective_permissions(db: Database, current_user) -> dict:
    """`get_role_permissions()` with the current user's own per-employee Page Access
    overrides (app/routers/access_control.py) layered onto "view" — the single place
    that combines the role matrix with an individual's explicit grants/denials. Only
    "view" is ever overridden this way; create/edit/delete/approve/export stay role-only.
    Deliberately does NOT apply the SELF_SERVICE_MODULES bypass — see the note above."""
    if current_user.role == "Admin":
        return {m: dict(_FULL) for m in MODULES}

    perms = {m: dict(v) for m, v in get_role_permissions(db, current_user.role).items()}
    emp_id = own_emp_id(db, current_user)
    if emp_id:
        for row in db[collections.PAGE_PERMISSIONS].find({"emp_id": emp_id}):
            if row["page"] in perms:
                perms[row["page"]]["view"] = bool(row["allowed"])
    return perms


def has_permission(db: Database, current_user, module: str, action: str) -> bool:
    if current_user.role == "Admin":
        return True
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
    # tickets, leads), so without this check a Viewer could self-report as the record's
    # owner and slip through despite the matrix's create/edit flags being False.
    if current_user.role == "Viewer":
        return False
    return bool(owner_name) and owner_name == current_user.name
