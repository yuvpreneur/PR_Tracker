from fastapi import APIRouter, Depends
from pymongo.database import Database
from app.core import collections
from app.core.database import get_db
from app.core.security import get_current_user, require_permission

router = APIRouter()


@router.get("/pending", dependencies=[Depends(require_permission("Approvals", "view"))])
def pending_approvals(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    """Returns all items awaiting approval across modules."""
    # Finance User has no say over Timesheets/Leave/Access Control at all (see DEFAULT_PERMS
    # in app/core/permissions.py) and, within Expenses, only ever acts at the "Pending
    # Finance" stage — the "Pending" (awaiting Manager) stage isn't theirs yet either. So
    # this cross-module dashboard shows them only what they can actually approve, not
    # every module with an empty/dead-end queue.
    is_finance_user = cu.role == "Finance User"
    timesheets = [] if is_finance_user else list(db[collections.TIMESHEETS].find({"status": "Pending"}))
    # Expenses has two pending stages — "Pending" (awaiting Manager) and "Pending Finance"
    # (Manager confirmed, awaiting Finance) — see expenses.py. Both surface here for
    # Admin/Manager; Finance User only ever sees the stage that's actually theirs.
    expense_statuses = ["Pending Finance"] if is_finance_user else ["Pending", "Pending Finance"]
    expenses   = list(db[collections.EXPENSES].find({"status": {"$in": expense_statuses}}))
    leave      = [] if is_finance_user else list(db[collections.LEAVE].find({"status": "Pending"}))
    # Leave documents don't store the employee's name directly (unlike Timesheets) —
    # list_leave() joins it from Employees at read time; do the same here.
    leave_emp_names = {
        e["emp_id"]: e["name"]
        for e in db[collections.EMPLOYEES].find({"_id": {"$in": [l["emp_id"] for l in leave]}})
    }
    # Approving/rejecting an access request is Admin/Manager-only (see access_control.py),
    # so only they get these bundled in here too — anyone else would see dead-end action
    # buttons for a request they can never actually resolve.
    access_reqs= list(db[collections.ACCESS_REQUESTS].find({"status": "Pending"})) if cu.role in ("Admin", "Manager") else []

    return {
        "timesheets": [
            {"id": t["id"], "emp_id": t["emp_id"], "name": t["name"],
             "project_id": t["project_id"], "hours": t["hours"],
             "entry_date": str(t["entry_date"]) if t["entry_date"] else None, "module": "Timesheets"}
            for t in timesheets
        ],
        "expenses": [
            {"id": e["id"], "project_id": e["project_id"], "amount": e["amount"],
             "category": e["category"], "vendor": e["vendor"],
             "expense_date": str(e["expense_date"]) if e["expense_date"] else None,
             "submitted_by": e["submitted_by"], "status": e["status"], "module": "Expenses"}
            for e in expenses
        ],
        "access_requests": [
            {"id": r["id"], "requester": r["requester"], "request_type": r.get("request_type", "page"),
             "page": r.get("page"), "project": r.get("project"), "project_id": r.get("project_id"),
             "reason": r["reason"], "module": "Access Control"}
            for r in access_reqs
        ],
        "leave": [
            {"id": l["id"], "emp_id": l["emp_id"], "name": leave_emp_names.get(l["emp_id"], l["emp_id"]),
             "leave_type": l["leave_type"],
             "from_date": str(l["from_date"]) if l["from_date"] else None,
             "to_date": str(l["to_date"]) if l["to_date"] else None,
             "days": l["days"], "reason": l.get("reason"), "module": "Leave"}
            for l in leave
        ],
        "total": len(timesheets) + len(expenses) + len(access_reqs) + len(leave),
    }
