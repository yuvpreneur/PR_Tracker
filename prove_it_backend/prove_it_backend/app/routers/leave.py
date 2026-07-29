from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import next_id
from app.core.security import get_current_user, require_permission
from app.core.audit import log_action
from app.core.notifications import notify
from app.core.permissions import has_permission, my_emp_ids, is_own_emp_record, own_emp_id

router = APIRouter()

LEAVE_TYPES = ["Casual", "Sick", "Earned", "Unpaid"]
ANNUAL_ENTITLEMENT = 18


class LeaveCreate(BaseModel):
    leave_type: str
    from_date: date
    to_date: date
    reason: Optional[str] = None


class RejectPayload(BaseModel):
    reason: str


def _active_projects_by_emp(db: Database, emp_ids: set) -> dict:
    """emp_id -> sorted list of names of the "In Progress" projects each employee is
    currently assigned to (Access Control -> Assigned Projects), for the manager to weigh
    delivery impact against when reviewing a leave request. Mirrors the same
    "no rows saved yet = unrestricted" default that assigned_project_ids()
    (app/core/permissions.py) uses, so an employee nobody has explicitly scoped shows as
    assigned to everything active rather than nothing."""
    if not emp_ids:
        return {}
    active_projects = {p["_id"]: p["name"] for p in db[collections.PROJECTS].find({"status": "In Progress"})}
    saved_by_emp = {}
    for p in db[collections.PROJECT_PERMISSIONS].find({"emp_id": {"$in": list(emp_ids)}}):
        saved_by_emp.setdefault(p["emp_id"], {})[p["project_id"]] = p["allowed"]

    result = {}
    for emp_id in emp_ids:
        saved = saved_by_emp.get(emp_id)
        if saved is None:
            allowed_ids = set(active_projects)
        else:
            allowed_ids = {pid for pid, ok in saved.items() if ok}
        result[emp_id] = sorted(active_projects[pid] for pid in allowed_ids if pid in active_projects)
    return result


def _out(l: dict, emp: dict = None, active_projects: list = None):
    return {
        "id": l["id"], "emp_id": l["emp_id"],
        "name": emp["name"] if emp else l["emp_id"],
        "leave_type": l["leave_type"],
        "from_date": str(l["from_date"]) if l["from_date"] else None,
        "to_date": str(l["to_date"]) if l["to_date"] else None,
        "days": l["days"], "status": l["status"], "reason": l["reason"],
        "decision_reason": l.get("decision_reason"),
        "active_projects": active_projects or [],
    }


@router.get("/")
def list_leave(
    emp_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Database = Depends(get_db), cu=Depends(get_current_user),
):
    employees = {e["emp_id"]: e for e in db[collections.EMPLOYEES].find()}
    query = {}
    # Employee/Finance User are always scoped to their own records here, full stop —
    # unlike every other role, this doesn't fall back to has_permission(view). That flag
    # can be forced True by a per-employee Access Control -> Page Access grant (meant only
    # to unlock the nav page, not blanket visibility — see get_effective_permissions() in
    # permissions.py), which would otherwise leak every employee's leave requests to
    # anyone in these two roles who's been granted that page.
    if cu.role in ("Employee", "Finance User") or not (cu.role == "Admin" or has_permission(db, cu, "Leave", "view")):
        mine = my_emp_ids(db, cu)
        if emp_id:
            if emp_id not in mine:
                raise HTTPException(403, "You may only view your own records")
        else:
            query["emp_id"] = {"$in": list(mine)}
    if emp_id: query["emp_id"] = emp_id
    if status: query["status"] = status
    rows = list(db[collections.LEAVE].find(query).sort("_id", -1))
    active_by_emp = _active_projects_by_emp(db, {l["emp_id"] for l in rows})
    return [_out(l, employees.get(l["emp_id"]), active_by_emp.get(l["emp_id"])) for l in rows]


@router.get("/summary")
def summary(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    # Scoped to the viewer's own employee record(s) — this is a personal "my balance /
    # my pending / my taken" widget, not a company-wide aggregate (each employee gets
    # their own ANNUAL_ENTITLEMENT pool, not one pool shared across everyone).
    mine = my_emp_ids(db, cu)
    rows = list(db[collections.LEAVE].find({"emp_id": {"$in": list(mine)}})) if mine else []
    this_year = str(date.today().year)
    taken = sum(
        l["days"] for l in rows
        if l["status"] == "Approved" and l["from_date"] and str(l["from_date"]).startswith(this_year)
    )
    pending = sum(1 for l in rows if l["status"] == "Pending")
    return {"balance": max(ANNUAL_ENTITLEMENT - taken, 0), "pending": pending, "taken_this_year": taken}


@router.post("/")
def create(payload: LeaveCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    # Leave is self-submitted only — same reasoning as Timesheets' create(): every user
    # applies under their own employee identity, never on someone else's behalf, so
    # emp_id is always derived server-side and never collected from the form.
    emp_id = own_emp_id(db, cu)
    emp = db[collections.EMPLOYEES].find_one({"_id": emp_id}) if emp_id else None
    if not emp:
        raise HTTPException(403, "No employee record found for your account — leave can only be applied for by employees")
    if payload.leave_type not in LEAVE_TYPES:
        raise HTTPException(400, f"leave_type must be one of {LEAVE_TYPES}")
    if payload.to_date < payload.from_date:
        raise HTTPException(400, "to_date cannot be before from_date")
    days = (payload.to_date - payload.from_date).days + 1
    lid = next_id(db, collections.LEAVE)
    doc = {"_id": lid, "id": lid, "emp_id": emp_id, **payload.dict(), "days": days, "status": "Pending"}
    doc["from_date"] = doc["from_date"].isoformat()
    doc["to_date"] = doc["to_date"].isoformat()
    db[collections.LEAVE].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Leave", record_id=str(lid), detail=f"{payload.leave_type} leave, {days}d")
    return _out(doc, emp, _active_projects_by_emp(db, {emp_id}).get(emp_id))


@router.post("/{leave_id}/approve", dependencies=[Depends(require_permission("Leave", "approve"))])
def approve(leave_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    l = db[collections.LEAVE].find_one({"_id": leave_id})
    if not l: raise HTTPException(404, "Not found")
    if is_own_emp_record(db, cu, l["emp_id"]):
        raise HTTPException(403, "You cannot approve your own leave request")
    db[collections.LEAVE].update_one({"_id": leave_id}, {"$set": {"status": "Approved"}})
    l = db[collections.LEAVE].find_one({"_id": leave_id})
    emp = db[collections.EMPLOYEES].find_one({"_id": l["emp_id"]})
    log_action(db, user=cu.name, action="APPROVE", module="Leave", record_id=str(leave_id))
    notify(
        db, recipient=emp["name"] if emp else None, module="Leave", record_id=leave_id, status="Approved",
        message=f"Your {l['leave_type']} leave request ({l['from_date']} to {l['to_date']}) was approved.",
    )
    return _out(l, emp, _active_projects_by_emp(db, {l["emp_id"]}).get(l["emp_id"]))


@router.post("/{leave_id}/reject", dependencies=[Depends(require_permission("Leave", "approve"))])
def reject(leave_id: int, payload: RejectPayload, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    l = db[collections.LEAVE].find_one({"_id": leave_id})
    if not l: raise HTTPException(404, "Not found")
    if is_own_emp_record(db, cu, l["emp_id"]):
        raise HTTPException(403, "You cannot reject your own leave request")
    db[collections.LEAVE].update_one({"_id": leave_id}, {"$set": {"status": "Rejected", "decision_reason": payload.reason}})
    l = db[collections.LEAVE].find_one({"_id": leave_id})
    emp = db[collections.EMPLOYEES].find_one({"_id": l["emp_id"]})
    log_action(db, user=cu.name, action="REJECT", module="Leave", record_id=str(leave_id), detail=payload.reason)
    notify(
        db, recipient=emp["name"] if emp else None, module="Leave", record_id=leave_id, status="Rejected",
        message=f"Your {l['leave_type']} leave request ({l['from_date']} to {l['to_date']}) was rejected. Reason: {payload.reason}",
    )
    return _out(l, emp, _active_projects_by_emp(db, {l["emp_id"]}).get(l["emp_id"]))
