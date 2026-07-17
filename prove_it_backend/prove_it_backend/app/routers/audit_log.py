from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime, time
from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import like, next_id
from app.core.security import require_role, get_current_user
from app.core.audit import log_action

router = APIRouter()


class AuditLogCreate(BaseModel):
    user: str
    action: str
    module: str
    record_id: Optional[str] = None
    detail: Optional[str] = None


class AuditLogUpdate(BaseModel):
    user: Optional[str] = None
    action: Optional[str] = None
    module: Optional[str] = None
    record_id: Optional[str] = None
    detail: Optional[str] = None


def _log_out(l: dict):
    return {
        "id": l["id"], "user": l["user"], "action": l["action"],
        "module": l["module"], "record_id": l["record_id"],
        "detail": l["detail"],
        "timestamp": l["timestamp"].isoformat() if l["timestamp"] else None,
    }


@router.get("/", dependencies=[Depends(require_role("Admin"))])
def list_audit_log(
    module:    Optional[str]  = Query(None),
    action:    Optional[str]  = Query(None),
    user:      Optional[str]  = Query(None),
    date_from: Optional[date] = Query(None),
    date_to:   Optional[date] = Query(None),
    search:    Optional[str]  = Query(None),
    limit:     int            = Query(100, le=500),
    offset:    int            = Query(0),
    db: Database = Depends(get_db),
):
    query = {}
    if module:    query["module"] = module
    if action:    query["action"] = action
    if user:      query["user"] = like(user)
    if date_from or date_to:
        date_filter = {}
        if date_from: date_filter["$gte"] = datetime.combine(date_from, time.min)
        if date_to:   date_filter["$lte"] = datetime.combine(date_to, time.max)
        query["timestamp"] = date_filter
    if search:
        query["$or"] = [
            {"user": like(search)},
            {"module": like(search)},
            {"action": like(search)},
            {"detail": like(search)},
            {"record_id": like(search)},
        ]
    total = db[collections.AUDIT_LOG].count_documents(query)
    logs = list(db[collections.AUDIT_LOG].find(query).sort("timestamp", -1).skip(offset).limit(limit))
    return {
        "total": total,
        "logs": [_log_out(l) for l in logs],
    }


@router.post("/", dependencies=[Depends(require_role("Admin"))])
def create_audit_log(payload: AuditLogCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    entry_id = next_id(db, collections.AUDIT_LOG)
    doc = {
        "_id": entry_id,
        "id": entry_id,
        "user": payload.user,
        "action": payload.action,
        "module": payload.module,
        "record_id": payload.record_id,
        "detail": payload.detail,
        "timestamp": datetime.utcnow(),
    }
    db[collections.AUDIT_LOG].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Audit Log", record_id=str(entry_id),
               detail=f"Added manual audit entry: {payload.action} on {payload.module}")
    return _log_out(doc)


@router.patch("/{log_id}", dependencies=[Depends(require_role("Admin"))])
def update_audit_log(log_id: int, payload: AuditLogUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    l = db[collections.AUDIT_LOG].find_one({"_id": log_id})
    if not l:
        raise HTTPException(404, "Audit log entry not found")
    patch = payload.dict(exclude_none=True)
    if patch:
        db[collections.AUDIT_LOG].update_one({"_id": log_id}, {"$set": patch})
        l = db[collections.AUDIT_LOG].find_one({"_id": log_id})
    log_action(db, user=cu.name, action="UPDATE", module="Audit Log", record_id=str(log_id),
               detail=f"Edited audit entry #{log_id}: {l['action']} on {l['module']}")
    return _log_out(l)


@router.delete("/{log_id}", dependencies=[Depends(require_role("Admin"))])
def delete_audit_log(log_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    l = db[collections.AUDIT_LOG].find_one({"_id": log_id})
    if not l:
        raise HTTPException(404, "Audit log entry not found")
    db[collections.AUDIT_LOG].delete_one({"_id": log_id})
    log_action(db, user=cu.name, action="DELETE", module="Audit Log", record_id=str(log_id),
               detail=f"Deleted audit entry #{log_id}: {l['action']} on {l['module']}")
    return {"message": "Audit log entry deleted"}
