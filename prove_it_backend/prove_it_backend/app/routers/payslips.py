from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from typing import Optional

from app.core import collections
from app.core.database import get_db
from app.core.permissions import has_permission, my_emp_ids
from app.core.security import get_current_user
from app.routers.payroll import _employees_by_id, _line_out

router = APIRouter()


def _with_period(line_out: dict, run: dict) -> dict:
    return {
        **line_out,
        "period_month": run["period_month"], "period_year": run["period_year"],
        "finalized_at": run.get("finalized_at"),
    }


@router.get("/")
def list_payslips(
    emp_id: Optional[str] = Query(None),
    db: Database = Depends(get_db),
    cu=Depends(get_current_user),
):
    # Self-service scoping, same shape as leave.py/timesheets.py: view=True on the
    # Payroll module sees everyone, everyone else only ever sees their own record(s) —
    # a Voided run is deliberately excluded here, it's a reversed/superseded record, not
    # a real payslip to show an employee.
    mine = my_emp_ids(db, cu)
    if emp_id:
        if emp_id not in mine and not has_permission(db, cu, "Payroll", "view"):
            raise HTTPException(403, "You may only view your own payslips")
        target_ids = {emp_id}
    elif has_permission(db, cu, "Payroll", "view"):
        target_ids = None
    else:
        if not mine:
            return []
        target_ids = mine

    runs = {r["id"]: r for r in db[collections.PAYROLL_RUNS].find({"org_id": cu.org_id, "status": "Finalized"})}
    if not runs:
        return []
    query = {"org_id": cu.org_id, "run_id": {"$in": list(runs)}}
    if target_ids is not None:
        query["emp_id"] = {"$in": list(target_ids)}
    lines = list(db[collections.PAYROLL_RUN_LINES].find(query).sort([("run_id", -1), ("emp_id", 1)]))

    employees = _employees_by_id(db, cu.org_id)
    return [_with_period(_line_out(l, employees.get(l["emp_id"])), runs[l["run_id"]]) for l in lines]


@router.get("/{line_id}")
def get_payslip(line_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    l = db[collections.PAYROLL_RUN_LINES].find_one({"_id": line_id, "org_id": cu.org_id})
    if not l:
        raise HTTPException(404, "Payslip not found")
    if l["emp_id"] not in my_emp_ids(db, cu) and not has_permission(db, cu, "Payroll", "view"):
        raise HTTPException(403, "You may only view your own payslips")
    run = db[collections.PAYROLL_RUNS].find_one({"_id": l["run_id"], "org_id": cu.org_id})
    if not run or run["status"] != "Finalized":
        raise HTTPException(404, "Payslip not found")
    employees = _employees_by_id(db, cu.org_id)
    return _with_period(_line_out(l, employees.get(l["emp_id"])), run)
