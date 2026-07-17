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
from app.core.permissions import has_permission, my_emp_ids, is_own_emp_record

router = APIRouter()

LEAVE_TYPES = ["Casual", "Sick", "Earned", "Unpaid"]
ANNUAL_ENTITLEMENT = 18


class LeaveCreate(BaseModel):
    emp_id: str
    leave_type: str
    from_date: date
    to_date: date
    reason: Optional[str] = None


class RejectPayload(BaseModel):
    reason: Optional[str] = None


def _out(l: dict, emp: dict = None):
    return {
        "id": l["id"], "emp_id": l["emp_id"],
        "name": emp["name"] if emp else l["emp_id"],
        "leave_type": l["leave_type"],
        "from_date": str(l["from_date"]) if l["from_date"] else None,
        "to_date": str(l["to_date"]) if l["to_date"] else None,
        "days": l["days"], "status": l["status"], "reason": l["reason"],
    }


@router.get("/")
def list_leave(
    emp_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Database = Depends(get_db), cu=Depends(get_current_user),
):
    employees = {e["emp_id"]: e for e in db[collections.EMPLOYEES].find()}
    query = {}
    if not (cu.role == "Admin" or has_permission(db, cu, "Leave", "view")):
        mine = my_emp_ids(db, cu)
        if emp_id:
            if emp_id not in mine:
                raise HTTPException(403, "You may only view your own records")
        else:
            query["emp_id"] = {"$in": list(mine)}
    if emp_id: query["emp_id"] = emp_id
    if status: query["status"] = status
    rows = db[collections.LEAVE].find(query).sort("_id", -1)
    return [_out(l, employees.get(l["emp_id"])) for l in rows]


@router.get("/summary")
def summary(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    rows = list(db[collections.LEAVE].find())
    this_year = str(date.today().year)
    taken = sum(
        l["days"] for l in rows
        if l["status"] == "Approved" and l["from_date"] and str(l["from_date"]).startswith(this_year)
    )
    pending = sum(1 for l in rows if l["status"] == "Pending")
    return {"balance": max(ANNUAL_ENTITLEMENT - taken, 0), "pending": pending, "taken_this_year": taken}


@router.post("/")
def create(payload: LeaveCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if payload.leave_type not in LEAVE_TYPES:
        raise HTTPException(400, f"leave_type must be one of {LEAVE_TYPES}")
    if payload.to_date < payload.from_date:
        raise HTTPException(400, "to_date cannot be before from_date")
    if not is_own_emp_record(db, cu, payload.emp_id) and not has_permission(db, cu, "Leave", "create"):
        raise HTTPException(403, "You may only apply for leave for yourself")
    days = (payload.to_date - payload.from_date).days + 1
    lid = next_id(db, collections.LEAVE)
    doc = {"_id": lid, "id": lid, **payload.dict(), "days": days, "status": "Pending"}
    doc["from_date"] = doc["from_date"].isoformat()
    doc["to_date"] = doc["to_date"].isoformat()
    db[collections.LEAVE].insert_one(doc)
    emp = db[collections.EMPLOYEES].find_one({"_id": payload.emp_id})
    log_action(db, user=cu.name, action="CREATE", module="Leave", record_id=str(lid), detail=f"{payload.leave_type} leave, {days}d")
    return _out(doc, emp)


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
    return _out(l, emp)


@router.post("/{leave_id}/reject", dependencies=[Depends(require_permission("Leave", "approve"))])
def reject(leave_id: int, payload: RejectPayload, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    l = db[collections.LEAVE].find_one({"_id": leave_id})
    if not l: raise HTTPException(404, "Not found")
    if is_own_emp_record(db, cu, l["emp_id"]):
        raise HTTPException(403, "You cannot reject your own leave request")
    db[collections.LEAVE].update_one({"_id": leave_id}, {"$set": {"status": "Rejected"}})
    l = db[collections.LEAVE].find_one({"_id": leave_id})
    emp = db[collections.EMPLOYEES].find_one({"_id": l["emp_id"]})
    log_action(db, user=cu.name, action="REJECT", module="Leave", record_id=str(leave_id), detail=payload.reason)
    return _out(l, emp)
