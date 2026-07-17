from fastapi import APIRouter, Depends
from pymongo.database import Database
from app.core import collections
from app.core.database import get_db
from app.core.security import get_current_user, require_permission

router = APIRouter()


@router.get("/pending", dependencies=[Depends(require_permission("Approvals", "view"))])
def pending_approvals(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    """Returns all items awaiting approval across modules."""
    timesheets = list(db[collections.TIMESHEETS].find({"status": "Pending"}))
    expenses   = list(db[collections.EXPENSES].find({"status": "Pending"}))
    attendance = list(db[collections.ATTENDANCE].find({"approval_status": "Pending"}))
    # Approving/rejecting an access request is Admin-only (see access_control.py), so only
    # Admin gets these bundled in here too — anyone else would see dead-end action buttons
    # for a request they can never actually resolve.
    access_reqs= list(db[collections.ACCESS_REQUESTS].find({"status": "Pending"})) if cu.role == "Admin" else []

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
             "submitted_by": e["submitted_by"], "module": "Expenses"}
            for e in expenses
        ],
        "attendance": [
            {"id": a["id"], "emp_id": a["emp_id"], "name": a["name"],
             "att_date": str(a["att_date"]) if a["att_date"] else None,
             "total_hours": a["total_hours"], "module": "Attendance"}
            for a in attendance
        ],
        "access_requests": [
            {"id": r["id"], "requester": r["requester"], "page": r["page"],
             "project": r["project"], "reason": r["reason"], "module": "Access Control"}
            for r in access_reqs
        ],
        "total": len(timesheets) + len(expenses) + len(attendance) + len(access_reqs),
    }
