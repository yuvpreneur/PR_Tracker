import calendar
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pymongo.database import Database
from typing import Optional

from app.core import collections
from app.core.audit import log_action
from app.core.database import client, get_db
from app.core.mongo_utils import get_or_404, next_id
from app.core.security import get_current_user, require_permission
from app.routers.salary_structures import COMPONENT_FIELDS, current_structure
from app.routers.settings import DEFAULT_WEEKLY_OFF, _get_section

router = APIRouter()

DEDUCTION_FIELDS = ["professional_tax", "esi", "pf", "tds", "medical"]
CONTRIBUTION_FIELDS = ["pension_cont", "epf_diff", "employer_pf_cont", "employer_esi_cont"]


class RunCreate(BaseModel):
    period_month: int
    period_year: int


class LineUpdate(BaseModel):
    total_days: Optional[float] = None
    wk_off: Optional[float] = None
    holiday: Optional[float] = None
    abs_lwp: Optional[float] = None
    net_paid_days: Optional[float] = None
    present_days: Optional[float] = None
    professional_tax: Optional[float] = None
    esi: Optional[float] = None
    pf: Optional[float] = None
    tds: Optional[float] = None
    medical: Optional[float] = None
    advance_recovery: Optional[float] = None
    pension_cont: Optional[float] = None
    epf_diff: Optional[float] = None
    employer_pf_cont: Optional[float] = None
    employer_esi_cont: Optional[float] = None


# ── Attendance derivation (Leave + Holidays + weekly-off — never Timesheets, see plan) ──

def _days_in_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def _overlap_days(from_str: str, to_str: str, start_str: str, end_str: str) -> int:
    start = max(date.fromisoformat(from_str), date.fromisoformat(start_str))
    end = min(date.fromisoformat(to_str), date.fromisoformat(end_str))
    return max((end - start).days + 1, 0)


def _weekly_off_count(start_day: int, end_day: int, year: int, month: int, weekdays: set) -> int:
    return sum(1 for d in range(start_day, end_day + 1) if date(year, month, d).weekday() in weekdays)


def _build_line(db: Database, org_id, emp: dict, period_month: int, period_year: int, weekdays: set, advances_by_emp: dict):
    """One employee's payroll_run_lines doc for this period, or None if they weren't
    employed at all during it (joined after / relieved before the whole month)."""
    days_in_month = _days_in_month(period_year, period_month)
    start_day, end_day = 1, days_in_month

    joining = emp.get("joining_date")
    if joining:
        j = date.fromisoformat(joining)
        if j.year == period_year and j.month == period_month and j.day > start_day:
            start_day = j.day

    relieving = emp.get("relieving_date")
    if relieving:
        r = date.fromisoformat(relieving)
        if r.year == period_year and r.month == period_month and r.day < end_day:
            end_day = r.day

    total_days = end_day - start_day + 1
    if total_days <= 0:
        return None

    period_start = date(period_year, period_month, start_day).isoformat()
    period_end = date(period_year, period_month, end_day).isoformat()

    wk_off = _weekly_off_count(start_day, end_day, period_year, period_month, weekdays)
    holiday = db[collections.HOLIDAYS].count_documents({
        "org_id": org_id, "date": {"$gte": period_start, "$lte": period_end},
    })

    unpaid = db[collections.LEAVE].find({
        "org_id": org_id, "emp_id": emp["emp_id"], "status": "Approved", "leave_type": "Unpaid",
        "from_date": {"$lte": period_end}, "to_date": {"$gte": period_start},
    })
    abs_lwp = sum(_overlap_days(l["from_date"], l["to_date"], period_start, period_end) for l in unpaid)
    net_paid_days = max(total_days - abs_lwp, 0)

    structure = current_structure(db, org_id, emp["emp_id"], period_end)
    adv = advances_by_emp.get(emp["emp_id"])

    return {
        "org_id": org_id, "emp_id": emp["emp_id"],
        "total_days": total_days, "wk_off": wk_off, "holiday": holiday,
        "abs_lwp": abs_lwp, "net_paid_days": net_paid_days, "present_days": net_paid_days,
        **{f"actual_{f}": (structure.get(f, 0) if structure else 0) for f in COMPONENT_FIELDS},
        **{f: 0 for f in DEDUCTION_FIELDS},
        "advance_id": adv["_id"] if adv else None,
        "advance_recovery": adv["monthly_recovery"] if adv else 0,
        **{f: 0 for f in CONTRIBUTION_FIELDS},
    }


# ── Output shaping — pro-rated earnings and every total are computed here on every read,
# never trusted from storage, same rule invoices.py's _out() applies to subtotal/tax/total ──

def _line_out(l: dict, emp: dict = None):
    total_days = l.get("total_days") or 0
    ratio = (l["net_paid_days"] / total_days) if total_days else 0
    pro_rated = {f: round(l.get(f"actual_{f}", 0) * ratio, 2) for f in COMPONENT_FIELDS}
    gross_earning = round(sum(pro_rated.values()), 2)
    gross_deduction = round(sum(l.get(f, 0) for f in DEDUCTION_FIELDS) + (l.get("advance_recovery") or 0), 2)
    net_payable = round(gross_earning - gross_deduction, 2)
    total_ctc = round(gross_earning + sum(l.get(f, 0) for f in CONTRIBUTION_FIELDS), 2)
    return {
        "id": l["id"], "run_id": l["run_id"], "emp_id": l["emp_id"],
        "name": emp["name"] if emp else l["emp_id"],
        "department": emp["department"] if emp else "—",
        "total_days": l["total_days"], "wk_off": l["wk_off"], "holiday": l["holiday"],
        "abs_lwp": l["abs_lwp"], "net_paid_days": l["net_paid_days"], "present_days": l["present_days"],
        **{f"actual_{f}": l.get(f"actual_{f}", 0) for f in COMPONENT_FIELDS},
        **pro_rated,
        **{f: l.get(f, 0) for f in DEDUCTION_FIELDS},
        "advance_id": l.get("advance_id"), "advance_recovery": l.get("advance_recovery", 0),
        **{f: l.get(f, 0) for f in CONTRIBUTION_FIELDS},
        "gross_earning": gross_earning, "gross_deduction": gross_deduction,
        "net_payable": net_payable, "total_ctc": total_ctc,
    }


def _run_out(r: dict, lines: list = None):
    out = {
        "id": r["id"], "period_month": r["period_month"], "period_year": r["period_year"],
        "status": r["status"], "created_by": r["created_by"],
        "finalized_by": r.get("finalized_by"), "finalized_at": r.get("finalized_at"),
    }
    if lines is not None:
        out["employee_count"] = len(lines)
        out["total_gross_earning"] = round(sum(l["gross_earning"] for l in lines), 2)
        out["total_gross_deduction"] = round(sum(l["gross_deduction"] for l in lines), 2)
        out["total_net_payable"] = round(sum(l["net_payable"] for l in lines), 2)
    return out


def _employees_by_id(db: Database, org_id) -> dict:
    return {e["emp_id"]: e for e in db[collections.EMPLOYEES].find({"org_id": org_id})}


def _lines_out(db: Database, org_id, run_id, employees: dict = None) -> list:
    employees = employees if employees is not None else _employees_by_id(db, org_id)
    rows = list(db[collections.PAYROLL_RUN_LINES].find({"run_id": run_id, "org_id": org_id}).sort("emp_id", 1))
    return [_line_out(l, employees.get(l["emp_id"])) for l in rows]


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/runs", dependencies=[Depends(require_permission("Payroll", "view"))])
def list_runs(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    employees = _employees_by_id(db, cu.org_id)
    runs = list(db[collections.PAYROLL_RUNS].find({"org_id": cu.org_id}).sort([("period_year", -1), ("period_month", -1)]))
    return [_run_out(r, _lines_out(db, cu.org_id, r["id"], employees)) for r in runs]


@router.post("/runs", dependencies=[Depends(require_permission("Payroll", "create"))])
def create_run(payload: RunCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if not (1 <= payload.period_month <= 12):
        raise HTTPException(400, "period_month must be between 1 and 12")
    if db[collections.PAYROLL_RUNS].find_one({"org_id": cu.org_id, "period_month": payload.period_month, "period_year": payload.period_year}):
        raise HTTPException(400, "A payroll run already exists for this period")

    weekly_off = _get_section(db, cu.org_id, "weekly_off", DEFAULT_WEEKLY_OFF)
    weekdays = set(weekly_off.get("weekdays", DEFAULT_WEEKLY_OFF["weekdays"]))

    employees = _employees_by_id(db, cu.org_id)
    active_employees = [e for e in employees.values() if e["status"] == "Active"]
    advances_by_emp = {a["emp_id"]: a for a in db[collections.ADVANCES].find({"org_id": cu.org_id, "status": "Active"})}

    rid = next_id(db, collections.PAYROLL_RUNS)
    run_doc = {
        "_id": rid, "id": rid, "org_id": cu.org_id,
        "period_month": payload.period_month, "period_year": payload.period_year,
        "status": "Draft", "created_by": cu.name, "finalized_by": None, "finalized_at": None,
    }

    line_docs = []
    for emp in active_employees:
        line = _build_line(db, cu.org_id, emp, payload.period_month, payload.period_year, weekdays, advances_by_emp)
        if line is None:
            continue
        lid = next_id(db, collections.PAYROLL_RUN_LINES)
        line_docs.append({"_id": lid, "id": lid, "run_id": rid, **line})

    db[collections.PAYROLL_RUNS].insert_one(run_doc)
    if line_docs:
        db[collections.PAYROLL_RUN_LINES].insert_many(line_docs)
    log_action(db, user=cu.name, action="CREATE", module="Payroll", org_id=cu.org_id, record_id=str(rid),
               detail=f"Created payroll run for {payload.period_month}/{payload.period_year} ({len(line_docs)} employees)")

    lines = [_line_out(l, employees.get(l["emp_id"])) for l in line_docs]
    out = _run_out(run_doc, lines)
    out["lines"] = lines
    return out


@router.get("/runs/{run_id}", dependencies=[Depends(require_permission("Payroll", "view"))])
def get_run(run_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    r = get_or_404(db, collections.PAYROLL_RUNS, run_id, cu.org_id, "Run not found")
    lines = _lines_out(db, cu.org_id, run_id)
    out = _run_out(r, lines)
    out["lines"] = lines
    return out


@router.patch("/runs/{run_id}/lines/{line_id}", dependencies=[Depends(require_permission("Payroll", "edit"))])
def update_line(run_id: int, line_id: int, payload: LineUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    r = get_or_404(db, collections.PAYROLL_RUNS, run_id, cu.org_id, "Run not found")
    if r["status"] != "Draft":
        raise HTTPException(400, "Cannot edit a run that is not in Draft state")
    l = get_or_404(db, collections.PAYROLL_RUN_LINES, line_id, cu.org_id, "Payroll line not found")
    if l["run_id"] != run_id:
        raise HTTPException(404, "Payroll line not found")

    patch = payload.dict(exclude_none=True)
    if patch:
        db[collections.PAYROLL_RUN_LINES].update_one({"_id": line_id, "org_id": cu.org_id}, {"$set": patch})
        l = db[collections.PAYROLL_RUN_LINES].find_one({"_id": line_id, "org_id": cu.org_id})
    log_action(db, user=cu.name, action="UPDATE", module="Payroll", org_id=cu.org_id, record_id=str(line_id))

    employees = _employees_by_id(db, cu.org_id)
    return _line_out(l, employees.get(l["emp_id"]))


@router.post("/runs/{run_id}/finalize", dependencies=[Depends(require_permission("Payroll", "edit"))])
def finalize_run(run_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    get_or_404(db, collections.PAYROLL_RUNS, run_id, cu.org_id, "Run not found")
    lines = list(db[collections.PAYROLL_RUN_LINES].find({"run_id": run_id, "org_id": cu.org_id}))

    # Status-in-filter guard (not read-then-write) closes the double-finalize race; the
    # advance-balance decrement rides in the same transaction so a run is never marked
    # Finalized while an advance recovery silently failed, or vice versa.
    with client.start_session() as session:
        with session.start_transaction():
            result = db[collections.PAYROLL_RUNS].update_one(
                {"_id": run_id, "org_id": cu.org_id, "status": "Draft"},
                {"$set": {"status": "Finalized", "finalized_by": cu.name, "finalized_at": datetime.utcnow().isoformat()}},
                session=session,
            )
            if result.modified_count != 1:
                raise HTTPException(400, "Run is not in Draft state")
            for l in lines:
                recovery = l.get("advance_recovery") or 0
                if l.get("advance_id") and recovery > 0:
                    adv_result = db[collections.ADVANCES].update_one(
                        {"_id": l["advance_id"], "org_id": cu.org_id, "balance_remaining": {"$gte": recovery}},
                        {"$inc": {"balance_remaining": -recovery}},
                        session=session,
                    )
                    if adv_result.modified_count != 1:
                        raise HTTPException(400, f"Advance balance for {l['emp_id']} is insufficient for this run's recovery amount")

    log_action(db, user=cu.name, action="APPROVE", module="Payroll", org_id=cu.org_id, record_id=str(run_id), detail="Payroll run finalized")
    r = get_or_404(db, collections.PAYROLL_RUNS, run_id, cu.org_id, "Run not found")
    employees = _employees_by_id(db, cu.org_id)
    out_lines = [_line_out(l, employees.get(l["emp_id"])) for l in lines]
    out = _run_out(r, out_lines)
    out["lines"] = out_lines
    return out


@router.post("/runs/{run_id}/void", dependencies=[Depends(require_permission("Payroll", "edit"))])
def void_run(run_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    lines = list(db[collections.PAYROLL_RUN_LINES].find({"run_id": run_id, "org_id": cu.org_id}))

    # Terminal state for a Finalized run — no un-finalize/reopen-for-edit path exists;
    # reopening a Finalized run for edits is exactly the double-decrement risk this
    # guards against. Void reverses the advance recovery it made at Finalize, then a
    # fresh corrective run is the only way forward.
    with client.start_session() as session:
        with session.start_transaction():
            result = db[collections.PAYROLL_RUNS].update_one(
                {"_id": run_id, "org_id": cu.org_id, "status": "Finalized"},
                {"$set": {"status": "Void"}},
                session=session,
            )
            if result.modified_count != 1:
                raise HTTPException(400, "Only a Finalized run can be voided")
            for l in lines:
                recovery = l.get("advance_recovery") or 0
                if l.get("advance_id") and recovery > 0:
                    db[collections.ADVANCES].update_one(
                        {"_id": l["advance_id"], "org_id": cu.org_id},
                        {"$inc": {"balance_remaining": recovery}},
                        session=session,
                    )

    log_action(db, user=cu.name, action="REJECT", module="Payroll", org_id=cu.org_id, record_id=str(run_id), detail="Payroll run voided")
    r = get_or_404(db, collections.PAYROLL_RUNS, run_id, cu.org_id, "Run not found")
    return _run_out(r)


@router.delete("/runs/{run_id}", dependencies=[Depends(require_permission("Payroll", "delete"))])
def delete_run(run_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    r = get_or_404(db, collections.PAYROLL_RUNS, run_id, cu.org_id, "Run not found")
    if r["status"] != "Draft":
        raise HTTPException(400, "Only a Draft run can be deleted")
    db[collections.PAYROLL_RUN_LINES].delete_many({"run_id": run_id, "org_id": cu.org_id})
    db[collections.PAYROLL_RUNS].delete_one({"_id": run_id, "org_id": cu.org_id})
    log_action(db, user=cu.name, action="DELETE", module="Payroll", org_id=cu.org_id, record_id=str(run_id))
    return {"message": "Deleted"}
