from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import like
from app.core.security import get_current_user, require_permission
from app.core.audit import log_action
from app.core.permissions import assigned_project_ids

router = APIRouter()

BILLING_TYPES = ["T&M", "Fixed", "Milestone"]


class BCCreate(BaseModel):
    code: str
    project_code_id: str
    project_id: str
    client: Optional[str] = None
    billing_type: str = "T&M"
    rate: float = 0
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    status: str = "Active"


class BCUpdate(BaseModel):
    client: Optional[str] = None
    billing_type: Optional[str] = None
    rate: Optional[float] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    status: Optional[str] = None


def _out(b: dict):
    return {
        "code": b["code"], "project_code_id": b["project_code_id"], "project_id": b["project_id"],
        "client": b["client"], "billing_type": b["billing_type"], "rate": b["rate"],
        "effective_from": str(b["effective_from"]) if b["effective_from"] else None,
        "effective_to": str(b["effective_to"]) if b["effective_to"] else None,
        "status": b["status"],
    }


@router.get("/")
def list_codes(project_id: Optional[str] = Query(None), billing_type: Optional[str] = Query(None),
               search: Optional[str] = Query(None), db: Database = Depends(get_db), cu=Depends(get_current_user)):
    query = {}
    if project_id: query["project_id"] = project_id
    if billing_type: query["billing_type"] = billing_type
    if search: query["code"] = like(search)

    # Each billing code belongs to exactly one project — reuses the same Access Control ->
    # Assigned Projects allow-list as Projects itself (see assigned_project_ids()) rather
    # than a separate Billing Codes assignment list, since being assigned a project already
    # implies seeing that project's codes.
    # Finance User is the one exception: billing codes/rates are their module to own (see
    # DEFAULT_PERMS's "Finance User" comment in app/core/permissions.py), so — same as
    # Admin/Manager — they see every billing code unrestricted rather than only their
    # assigned projects'. Projects/Companies/Project Codes stay project-scoped for them.
    assigned_ids = None if cu.role == "Finance User" else assigned_project_ids(db, cu)
    if assigned_ids is not None:
        if project_id is not None:
            if project_id not in assigned_ids:
                return []
        else:
            query["project_id"] = {"$in": assigned_ids}

    return [_out(b) for b in db[collections.BILLING_CODES].find(query)]


@router.post("/", dependencies=[Depends(require_permission("Billing Codes", "create"))])
def create(payload: BCCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if db[collections.BILLING_CODES].find_one({"_id": payload.code}):
        raise HTTPException(400, "Billing code already exists")
    if payload.billing_type not in BILLING_TYPES:
        raise HTTPException(400, f"billing_type must be one of {BILLING_TYPES}")
    doc = payload.dict()
    doc["_id"] = doc["code"]
    if doc["effective_from"]: doc["effective_from"] = doc["effective_from"].isoformat()
    if doc["effective_to"]: doc["effective_to"] = doc["effective_to"].isoformat()
    db[collections.BILLING_CODES].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Billing Codes", record_id=doc["code"])
    return _out(doc)


@router.patch("/{code}", dependencies=[Depends(require_permission("Billing Codes", "edit"))])
def update(code: str, payload: BCUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    b = db[collections.BILLING_CODES].find_one({"_id": code})
    if not b: raise HTTPException(404, "Not found")
    patch = payload.dict(exclude_none=True)
    if "effective_from" in patch: patch["effective_from"] = patch["effective_from"].isoformat()
    if "effective_to" in patch: patch["effective_to"] = patch["effective_to"].isoformat()
    if patch:
        db[collections.BILLING_CODES].update_one({"_id": code}, {"$set": patch})
        b = db[collections.BILLING_CODES].find_one({"_id": code})
    log_action(db, user=cu.name, action="UPDATE", module="Billing Codes", record_id=b["code"])
    return _out(b)


@router.delete("/{code}", dependencies=[Depends(require_permission("Billing Codes", "delete"))])
def delete(code: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    b = db[collections.BILLING_CODES].find_one({"_id": code})
    if not b: raise HTTPException(404, "Not found")
    db[collections.BILLING_CODES].delete_one({"_id": code})
    log_action(db, user=cu.name, action="DELETE", module="Billing Codes", record_id=code)
    return {"message": "Deleted"}
