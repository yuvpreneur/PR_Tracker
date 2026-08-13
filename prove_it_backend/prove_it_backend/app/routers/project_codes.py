from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel
from typing import Optional
from app.core import collections
from app.core.database import client, get_db
from app.core.mongo_utils import like, get_or_404
from app.core.security import get_current_user, require_permission
from app.core.audit import log_action
from app.core.permissions import assigned_project_ids

router = APIRouter()


class PCCreate(BaseModel):
    code: str
    project_id: str
    description: Optional[str] = None
    status: str = "Active"


class PCUpdate(BaseModel):
    code: Optional[str] = None
    project_id: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


def _out(pc: dict):
    return {"code": pc["code"], "project_id": pc["project_id"], "description": pc["description"], "status": pc["status"]}


@router.get("/")
def list_codes(project_id: Optional[str] = Query(None), status: Optional[str] = Query(None),
               search: Optional[str] = Query(None), db: Database = Depends(get_db), cu=Depends(get_current_user)):
    query = {}
    if project_id: query["project_id"] = project_id
    if status: query["status"] = status
    if search: query["$or"] = [{"code": like(search)}, {"description": like(search)}]

    # Each project code belongs to exactly one project — reuses the same Access Control ->
    # Assigned Projects allow-list as Projects itself (see assigned_project_ids()) rather
    # than a separate Project Codes assignment list, since being assigned a project already
    # implies seeing that project's codes.
    # Finance User is unrestricted here too, same as Companies/Projects/Billing Codes —
    # every project code is financial-context reference data for this role, not just ones
    # tied to their assigned projects.
    assigned_ids = None if cu.role == "Finance User" else assigned_project_ids(db, cu)
    if assigned_ids is not None:
        if project_id is not None:
            if project_id not in assigned_ids:
                return []
        else:
            query["project_id"] = {"$in": assigned_ids}

    query["org_id"] = cu.org_id
    return [_out(pc) for pc in db[collections.PROJECT_CODES].find(query)]


@router.post("/", dependencies=[Depends(require_permission("Project Codes", "create"))])
def create(payload: PCCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if db[collections.PROJECT_CODES].find_one({"_id": payload.code, "org_id": cu.org_id}):
        raise HTTPException(400, "Code already exists")
    doc = payload.dict()
    doc["_id"] = doc["code"]
    doc["org_id"] = cu.org_id
    db[collections.PROJECT_CODES].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Project Codes", org_id=cu.org_id, record_id=doc["code"], detail=f"Created project code {doc['code']}")
    return _out(doc)


@router.patch("/{code}", dependencies=[Depends(require_permission("Project Codes", "edit"))])
def update(code: str, payload: PCUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    pc = get_or_404(db, collections.PROJECT_CODES, code, cu.org_id, "Not found")
    patch = payload.dict(exclude_none=True)
    new_code = patch.pop("code", None)

    if new_code and new_code != code:
        if db[collections.PROJECT_CODES].find_one({"_id": new_code, "org_id": cu.org_id}):
            raise HTTPException(400, "Code already exists")
        new_doc = {**pc, **patch, "_id": new_code, "code": new_code}
        # Renaming the code means every record that points at it by the old value
        # (Billing Codes, and any Timesheet/Expense logged against it) needs to move
        # to the new value too, or they'd silently orphan — do it as one transaction
        # so a mid-cascade failure can't leave some collections renamed and others not.
        with client.start_session() as session:
            with session.start_transaction():
                db[collections.PROJECT_CODES].insert_one(new_doc, session=session)
                db[collections.PROJECT_CODES].delete_one({"_id": code, "org_id": cu.org_id}, session=session)
                db[collections.BILLING_CODES].update_many(
                    {"project_code_id": code, "org_id": cu.org_id}, {"$set": {"project_code_id": new_code}}, session=session)
                db[collections.TIMESHEETS].update_many(
                    {"project_code_id": code, "org_id": cu.org_id}, {"$set": {"project_code_id": new_code}}, session=session)
                db[collections.EXPENSES].update_many(
                    {"project_code_id": code, "org_id": cu.org_id}, {"$set": {"project_code_id": new_code}}, session=session)
        pc = get_or_404(db, collections.PROJECT_CODES, new_code, cu.org_id, "Not found")
    elif patch:
        db[collections.PROJECT_CODES].update_one({"_id": code, "org_id": cu.org_id}, {"$set": patch})
        pc = get_or_404(db, collections.PROJECT_CODES, code, cu.org_id, "Not found")

    log_action(db, user=cu.name, action="UPDATE", module="Project Codes", org_id=cu.org_id, record_id=pc["code"])
    return _out(pc)


@router.delete("/{code}", dependencies=[Depends(require_permission("Project Codes", "delete"))])
def delete(code: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    pc = get_or_404(db, collections.PROJECT_CODES, code, cu.org_id, "Not found")
    db[collections.PROJECT_CODES].delete_one({"_id": code, "org_id": cu.org_id})
    log_action(db, user=cu.name, action="DELETE", module="Project Codes", org_id=cu.org_id, record_id=code)
    return {"message": "Deleted"}
