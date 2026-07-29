from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, timedelta
from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import next_id, like
from app.core.security import get_current_user, require_permission
from app.core.audit import log_action
from app.core.notifications import notify
from app.core.permissions import has_permission, my_emp_ids, is_own_emp_record, own_emp_id

router = APIRouter()

MAX_DAILY_HOURS = 9


class TSCreate(BaseModel):
    entry_date: date
    project_id: str
    project_code_id: Optional[str] = None
    billing_code_id: Optional[str] = None
    hours: float = Field(gt=0, le=MAX_DAILY_HOURS)
    billable: bool = True
    notes: Optional[str] = None


class TSUpdate(BaseModel):
    hours: Optional[float] = Field(None, gt=0, le=MAX_DAILY_HOURS)
    project_code_id: Optional[str] = None
    billing_code_id: Optional[str] = None
    billable: Optional[bool] = None
    notes: Optional[str] = None


class ApprovalAction(BaseModel):
    reason: Optional[str] = None


def _out(t: dict):
    return {
        "id": t["id"], "emp_id": t["emp_id"], "name": t["name"],
        "entry_date": str(t["entry_date"]) if t["entry_date"] else None,
        "project_id": t["project_id"], "project_code_id": t.get("project_code_id"), "billing_code_id": t["billing_code_id"],
        "hours": t["hours"], "billable": t["billable"],
        "status": t["status"], "notes": t["notes"], "approved_by": t["approved_by"],
    }


def _fmt_hours(h: float) -> str:
    return f"{h:g}h"


def _same_day_hours(db: Database, emp_id: str, entry_date: str, exclude_id: Optional[int] = None):
    """Hours this employee has already logged on this date, across every project.
    A Rejected entry voids that submission, so it's excluded from the running total
    (the employee is expected to fix and resubmit it, not have it count twice)."""
    query = {"emp_id": emp_id, "entry_date": entry_date, "status": {"$ne": "Rejected"}}
    if exclude_id is not None:
        query["_id"] = {"$ne": exclude_id}
    rows = list(db[collections.TIMESHEETS].find(query))
    return sum(r["hours"] for r in rows), rows


def _daily_cap_error(db: Database, rows: list, existing_hours: float, new_hours: float) -> str:
    by_project = {}
    for r in rows:
        by_project[r["project_id"]] = by_project.get(r["project_id"], 0) + r["hours"]
    names = {p["_id"]: p["name"] for p in db[collections.PROJECTS].find({"_id": {"$in": list(by_project)}})}
    breakdown = ", ".join(f"{_fmt_hours(h)} on {names.get(pid, pid)}" for pid, h in by_project.items())
    remaining = max(0.0, MAX_DAILY_HOURS - existing_hours)
    return (
        f"You've already logged {_fmt_hours(existing_hours)} today ({breakdown}). "
        f"Adding {_fmt_hours(new_hours)} more would bring today's total to "
        f"{_fmt_hours(existing_hours + new_hours)}, over the {MAX_DAILY_HOURS}h/day limit — "
        f"you have {_fmt_hours(remaining)} left today."
    )


@router.get("/")
def list_timesheets(
    emp_id:          Optional[str]  = Query(None),
    project_id:      Optional[str]  = Query(None),
    status:          Optional[str]  = Query(None),
    billing_code_id: Optional[str]  = Query(None),
    date_from:       Optional[date] = Query(None),
    date_to:         Optional[date] = Query(None),
    search:          Optional[str]  = Query(None),
    db: Database = Depends(get_db), cu=Depends(get_current_user),
):
    query = {}
    # Employee/Finance User are always scoped to their own records here, full stop —
    # unlike every other role, this doesn't fall back to has_permission(view). That flag
    # can be forced True by a per-employee Access Control -> Page Access grant (meant only
    # to unlock the nav page, not blanket visibility — see get_effective_permissions() in
    # permissions.py), which would otherwise leak every employee's timesheet entries to
    # anyone in these two roles who's been granted that page.
    if cu.role in ("Employee", "Finance User") or not (cu.role == "Admin" or has_permission(db, cu, "Timesheets", "view")):
        mine = my_emp_ids(db, cu)
        if emp_id:
            if emp_id not in mine:
                raise HTTPException(403, "You may only view your own records")
        else:
            query["emp_id"] = {"$in": list(mine)}

    if emp_id:          query["emp_id"] = emp_id
    if project_id:      query["project_id"] = project_id
    if status:          query["status"] = status
    if billing_code_id: query["billing_code_id"] = billing_code_id
    if date_from or date_to:
        date_filter = {}
        if date_from: date_filter["$gte"] = date_from.isoformat()
        if date_to:   date_filter["$lte"] = date_to.isoformat()
        query["entry_date"] = date_filter
    if search:
        query["$or"] = [
            {"emp_id": like(search)},
            {"name": like(search)},
            {"project_id": like(search)},
            {"notes": like(search)},
        ]
    rows = list(db[collections.TIMESHEETS].find(query).sort("entry_date", -1))
    return [_out(t) for t in rows]


@router.get("/summary")
def summary(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    all_ts = list(db[collections.TIMESHEETS].find())
    approved = [t for t in all_ts if t["status"] == "Approved"]
    return {
        "total_entries": len(all_ts),
        "total_hours": sum(t["hours"] for t in all_ts),
        "approved_hours": sum(t["hours"] for t in approved),
        "billable_hours": sum(t["hours"] for t in approved if t["billable"]),
        "non_billable_hours": sum(t["hours"] for t in approved if not t["billable"]),
        "pending": sum(1 for t in all_ts if t["status"] == "Pending"),
    }


@router.post("/")
def create(payload: TSCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    # Timesheets are self-submitted only — every user (Admin included) logs hours
    # under their own employee identity, never on someone else's behalf. Admin has
    # no Employees record, so this leaves Admin with approve/reject only, by design.
    # Viewer is read-only across the board and is explicitly excluded here (unlike the
    # other self-service routers, this lookup doesn't go through is_own_emp_record()).
    if cu.role == "Viewer":
        raise HTTPException(403, "Viewers cannot submit timesheets")
    emp_id = own_emp_id(db, cu)
    emp = db[collections.EMPLOYEES].find_one({"_id": emp_id}) if emp_id else None
    if not emp:
        raise HTTPException(403, "No employee record found for your account — timesheets can only be submitted by employees")

    if payload.project_code_id:
        pcode = db[collections.PROJECT_CODES].find_one({"_id": payload.project_code_id})
        if not pcode:
            raise HTTPException(404, "Project code not found")
        if pcode["project_id"] != payload.project_id:
            raise HTTPException(400, "That project code does not belong to the selected project")

    entry_date_str = payload.entry_date.isoformat()
    existing_hours, existing_rows = _same_day_hours(db, emp["emp_id"], entry_date_str)
    if existing_hours + payload.hours > MAX_DAILY_HOURS:
        raise HTTPException(400, _daily_cap_error(db, existing_rows, existing_hours, payload.hours))

    tid = next_id(db, collections.TIMESHEETS)
    doc = {
        "_id": tid, "id": tid, "emp_id": emp["emp_id"], "name": emp["name"],
        **payload.dict(),
        "status": "Pending", "approved_by": None,
    }
    doc["entry_date"] = doc["entry_date"].isoformat()
    db[collections.TIMESHEETS].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Timesheets", record_id=str(tid), detail=f"{doc['hours']}hrs on {doc['project_id']}")
    return _out(doc)


@router.patch("/{ts_id}")
def update(ts_id: int, payload: TSUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    t = db[collections.TIMESHEETS].find_one({"_id": ts_id})
    if not t: raise HTTPException(404, "Not found")
    can_edit_any = has_permission(db, cu, "Timesheets", "edit")
    if t["status"] == "Approved" and not can_edit_any:
        raise HTTPException(400, "Cannot edit an approved timesheet")
    if not can_edit_any and not (is_own_emp_record(db, cu, t["emp_id"]) and t["status"] == "Pending"):
        raise HTTPException(403, "You may only edit your own pending timesheets")
    patch = payload.dict(exclude_none=True)
    if "project_code_id" in patch:
        pcode = db[collections.PROJECT_CODES].find_one({"_id": patch["project_code_id"]})
        if not pcode:
            raise HTTPException(404, "Project code not found")
        if pcode["project_id"] != t["project_id"]:
            raise HTTPException(400, "That project code does not belong to this entry's project")
    if "hours" in patch:
        other_hours, other_rows = _same_day_hours(db, t["emp_id"], t["entry_date"], exclude_id=ts_id)
        if other_hours + patch["hours"] > MAX_DAILY_HOURS:
            raise HTTPException(400, _daily_cap_error(db, other_rows, other_hours, patch["hours"]))
    patch["status"] = "Pending"
    db[collections.TIMESHEETS].update_one({"_id": ts_id}, {"$set": patch})
    t = db[collections.TIMESHEETS].find_one({"_id": ts_id})
    log_action(db, user=cu.name, action="UPDATE", module="Timesheets", record_id=str(ts_id))
    return _out(t)


@router.post("/{ts_id}/approve", dependencies=[Depends(require_permission("Timesheets", "approve"))])
def approve(ts_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    t = db[collections.TIMESHEETS].find_one({"_id": ts_id})
    if not t: raise HTTPException(404, "Not found")
    if is_own_emp_record(db, cu, t["emp_id"]):
        raise HTTPException(403, "You cannot approve your own timesheet")
    db[collections.TIMESHEETS].update_one({"_id": ts_id}, {"$set": {"status": "Approved", "approved_by": cu.name}})
    t = db[collections.TIMESHEETS].find_one({"_id": ts_id})
    log_action(db, user=cu.name, action="APPROVE", module="Timesheets", record_id=str(ts_id))
    notify(
        db, recipient=t["name"], module="Timesheets", record_id=ts_id, status="Approved",
        message=f"Your timesheet entry for {t['project_id']} on {t['entry_date']} ({t['hours']}h) was approved.",
    )
    return _out(t)


@router.post("/{ts_id}/reject", dependencies=[Depends(require_permission("Timesheets", "approve"))])
def reject(ts_id: int, payload: ApprovalAction, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    t = db[collections.TIMESHEETS].find_one({"_id": ts_id})
    if not t: raise HTTPException(404, "Not found")
    if is_own_emp_record(db, cu, t["emp_id"]):
        raise HTTPException(403, "You cannot reject your own timesheet")
    db[collections.TIMESHEETS].update_one({"_id": ts_id}, {"$set": {"status": "Rejected", "approved_by": None}})
    t = db[collections.TIMESHEETS].find_one({"_id": ts_id})
    log_action(db, user=cu.name, action="REJECT", module="Timesheets", record_id=str(ts_id), detail=payload.reason)
    reason_suffix = f" Reason: {payload.reason}" if payload.reason else ""
    notify(
        db, recipient=t["name"], module="Timesheets", record_id=ts_id, status="Rejected",
        message=f"Your timesheet entry for {t['project_id']} on {t['entry_date']} ({t['hours']}h) was rejected.{reason_suffix}",
    )
    return _out(t)


@router.delete("/{ts_id}")
def delete(ts_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    t = db[collections.TIMESHEETS].find_one({"_id": ts_id})
    if not t: raise HTTPException(404, "Not found")
    # No self-service delete, even for your own pending entry — once submitted, only
    # someone with Timesheets:delete (Admin by default) can remove it.
    if not has_permission(db, cu, "Timesheets", "delete"):
        raise HTTPException(403, "You do not have permission to delete timesheets")
    db[collections.TIMESHEETS].delete_one({"_id": ts_id})
    log_action(db, user=cu.name, action="DELETE", module="Timesheets", record_id=str(ts_id))
    return {"message": "Deleted"}
