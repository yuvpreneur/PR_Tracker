from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel
from typing import Optional
from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import like
from app.core.security import get_current_user, require_permission
from app.core.audit import log_action

router = APIRouter()


class PCCreate(BaseModel):
    code: str
    project_id: str
    description: Optional[str] = None
    status: str = "Active"


class PCUpdate(BaseModel):
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
    return [_out(pc) for pc in db[collections.PROJECT_CODES].find(query)]


@router.post("/", dependencies=[Depends(require_permission("Project Codes", "create"))])
def create(payload: PCCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if db[collections.PROJECT_CODES].find_one({"_id": payload.code}):
        raise HTTPException(400, "Code already exists")
    doc = payload.dict()
    doc["_id"] = doc["code"]
    db[collections.PROJECT_CODES].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Project Codes", record_id=doc["code"], detail=f"Created project code {doc['code']}")
    return _out(doc)


@router.patch("/{code}", dependencies=[Depends(require_permission("Project Codes", "edit"))])
def update(code: str, payload: PCUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    pc = db[collections.PROJECT_CODES].find_one({"_id": code})
    if not pc: raise HTTPException(404, "Not found")
    patch = payload.dict(exclude_none=True)
    if patch:
        db[collections.PROJECT_CODES].update_one({"_id": code}, {"$set": patch})
        pc = db[collections.PROJECT_CODES].find_one({"_id": code})
    log_action(db, user=cu.name, action="UPDATE", module="Project Codes", record_id=pc["code"])
    return _out(pc)


@router.delete("/{code}", dependencies=[Depends(require_permission("Project Codes", "delete"))])
def delete(code: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    pc = db[collections.PROJECT_CODES].find_one({"_id": code})
    if not pc: raise HTTPException(404, "Not found")
    db[collections.PROJECT_CODES].delete_one({"_id": code})
    log_action(db, user=cu.name, action="DELETE", module="Project Codes", record_id=code)
    return {"message": "Deleted"}
