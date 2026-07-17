from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date, timedelta
from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import next_id, like
from app.core.security import get_current_user, require_permission
from app.core.audit import log_action
from app.core.permissions import has_permission, my_emp_ids, is_own_emp_record

router = APIRouter()

MAX_ATTENDANCE_HOURS = 9
SHIFT_START_MIN = 9 * 60 + 30   # 09:30
SHIFT_END_MIN = 18 * 60         # 18:00


def _validate_total_hours(v):
    if v is None:
        return v
    if v < 0 or v > MAX_ATTENDANCE_HOURS:
        raise ValueError(f"total_hours must be between 0 and {MAX_ATTENDANCE_HOURS} hours")
    if abs(round(v * 2) - v * 2) > 1e-6:
        raise ValueError("total_hours must be in 30-minute increments (0.5, 1, 1.5, ... 9)")
    return v


def _to_minutes(hhmm: str) -> int:
    hh, mm = hhmm.split(":")
    return int(hh) * 60 + int(mm)


def _validate_shift_time(v):
    if v is None:
        return v
    try:
        minutes = _to_minutes(v)
    except Exception:
        raise ValueError("time must be in HH:MM format")
    if minutes < SHIFT_START_MIN or minutes > SHIFT_END_MIN:
        raise ValueError("time must be between 09:30 and 18:00")
    if minutes % 30 != 0:
        raise ValueError("time must be on a 30-minute boundary (e.g. 09:30, 10:00, 10:30, ...)")
    return v


def _hours_between(check_in: str, check_out: str) -> float:
    diff = _to_minutes(check_out) - _to_minutes(check_in)
    if diff <= 0:
        raise ValueError("Check Out must be after Check In")
    return diff / 60


class AttCreate(BaseModel):
    emp_id: str
    name: Optional[str] = None
    att_date: date
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    total_hours: float = 0
    att_status: str = "Present"

    @field_validator("total_hours")
    @classmethod
    def _check_total_hours(cls, v):
        return _validate_total_hours(v)

    @field_validator("check_in", "check_out")
    @classmethod
    def _check_shift_time(cls, v):
        return _validate_shift_time(v)


class AttUpdate(BaseModel):
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    total_hours: Optional[float] = None
    att_status: Optional[str] = None
    approval_status: Optional[str] = None

    @field_validator("total_hours")
    @classmethod
    def _check_total_hours(cls, v):
        return _validate_total_hours(v)

    @field_validator("check_in", "check_out")
    @classmethod
    def _check_shift_time(cls, v):
        return _validate_shift_time(v)


def _out(a: dict):
    return {
        "id": a["id"], "emp_id": a["emp_id"], "name": a["name"],
        "att_date": str(a["att_date"]) if a["att_date"] else None,
        "check_in": a["check_in"], "check_out": a["check_out"],
        "total_hours": a["total_hours"], "att_status": a["att_status"], "approval_status": a["approval_status"],
    }


@router.get("/")
def list_attendance(
    emp_id:     Optional[str]  = Query(None),
    att_date:   Optional[date] = Query(None),
    att_status: Optional[str]  = Query(None),
    date_from:  Optional[date] = Query(None),
    date_to:    Optional[date] = Query(None),
    search:     Optional[str]  = Query(None),
    db: Database = Depends(get_db), cu=Depends(get_current_user),
):
    query = {}
    if not (cu.role == "Admin" or has_permission(db, cu, "Attendance", "view")):
        mine = my_emp_ids(db, cu)
        if emp_id:
            if emp_id not in mine:
                raise HTTPException(403, "You may only view your own records")
        else:
            query["emp_id"] = {"$in": list(mine)}

    if emp_id:     query["emp_id"] = emp_id
    if att_date:   query["att_date"] = att_date.isoformat()
    if att_status: query["att_status"] = att_status
    if date_from or date_to:
        date_filter = {}
        if date_from: date_filter["$gte"] = date_from.isoformat()
        if date_to:   date_filter["$lte"] = date_to.isoformat()
        query["att_date"] = date_filter
    if search:
        query["$or"] = [{"emp_id": like(search)}, {"name": like(search)}]
    rows = db[collections.ATTENDANCE].find(query).sort("att_date", -1)
    return [_out(a) for a in rows]


@router.get("/today-summary")
def today_summary(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    today = date.today().isoformat()
    records = list(db[collections.ATTENDANCE].find({"att_date": today}))
    present  = sum(1 for r in records if r["att_status"] in ("Present", "WFH"))
    absent   = sum(1 for r in records if r["att_status"] == "Absent")
    wfh      = sum(1 for r in records if r["att_status"] == "WFH")
    pending  = sum(1 for r in records if r["approval_status"] == "Pending")
    # Fall back to most recent date that has records if today has none
    if not records:
        latest = db[collections.ATTENDANCE].find_one(sort=[("att_date", -1)])
        if latest:
            records = list(db[collections.ATTENDANCE].find({"att_date": latest["att_date"]}))
            present = sum(1 for r in records if r["att_status"] in ("Present", "WFH"))
            absent  = sum(1 for r in records if r["att_status"] == "Absent")
            wfh     = sum(1 for r in records if r["att_status"] == "WFH")
            pending = sum(1 for r in records if r["approval_status"] == "Pending")
    return {
        "present": present,
        "absent":  absent,
        "wfh":     wfh,
        "pending_approval": pending,
        "total":   len(records),
    }


@router.post("/")
def mark_attendance(payload: AttCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if not is_own_emp_record(db, cu, payload.emp_id) and not has_permission(db, cu, "Attendance", "create"):
        raise HTTPException(403, "You may only mark attendance for yourself")
    aid = next_id(db, collections.ATTENDANCE)
    doc = {"_id": aid, "id": aid, **payload.dict(), "approval_status": "Pending"}
    doc["att_date"] = doc["att_date"].isoformat()
    if doc["check_in"] and doc["check_out"]:
        try:
            doc["total_hours"] = _hours_between(doc["check_in"], doc["check_out"])
        except ValueError as e:
            raise HTTPException(400, str(e))
    db[collections.ATTENDANCE].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Attendance", record_id=str(aid))
    return _out(doc)


@router.patch("/{att_id}")
def update_attendance(att_id: int, payload: AttUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    a = db[collections.ATTENDANCE].find_one({"_id": att_id})
    if not a: raise HTTPException(404, "Not found")
    can_edit_any = has_permission(db, cu, "Attendance", "edit")
    is_mine_pending = is_own_emp_record(db, cu, a["emp_id"]) and a["approval_status"] == "Pending"
    if not can_edit_any and not is_mine_pending:
        raise HTTPException(403, "You may only edit your own pending attendance records")

    patch = payload.dict(exclude_none=True)
    if "check_in" in patch or "check_out" in patch:
        final_check_in = patch.get("check_in", a.get("check_in"))
        final_check_out = patch.get("check_out", a.get("check_out"))
        if final_check_in and final_check_out:
            try:
                patch["total_hours"] = _hours_between(final_check_in, final_check_out)
            except ValueError as e:
                raise HTTPException(400, str(e))
    if "approval_status" in patch:
        # Changing approval_status is an approval action (incl. the reject-via-PATCH
        # workaround the frontend uses since there's no dedicated /reject route) —
        # gate it like /approve, including the self-approval/self-rejection block.
        if not has_permission(db, cu, "Attendance", "approve"):
            raise HTTPException(403, "Requires 'approve' permission on Attendance")
        if is_own_emp_record(db, cu, a["emp_id"]):
            raise HTTPException(403, "You cannot approve/reject your own attendance record")
    if patch:
        db[collections.ATTENDANCE].update_one({"_id": att_id}, {"$set": patch})
        a = db[collections.ATTENDANCE].find_one({"_id": att_id})
    log_action(db, user=cu.name, action="UPDATE", module="Attendance", record_id=str(att_id))
    return _out(a)


@router.post("/{att_id}/approve", dependencies=[Depends(require_permission("Attendance", "approve"))])
def approve_attendance(att_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    a = db[collections.ATTENDANCE].find_one({"_id": att_id})
    if not a: raise HTTPException(404, "Not found")
    if is_own_emp_record(db, cu, a["emp_id"]):
        raise HTTPException(403, "You cannot approve your own attendance record")
    db[collections.ATTENDANCE].update_one({"_id": att_id}, {"$set": {"approval_status": "Approved"}})
    a = db[collections.ATTENDANCE].find_one({"_id": att_id})
    log_action(db, user=cu.name, action="APPROVE", module="Attendance", record_id=str(att_id))
    return _out(a)
