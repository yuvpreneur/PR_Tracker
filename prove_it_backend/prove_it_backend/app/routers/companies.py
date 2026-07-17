from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel
from typing import Optional

from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import next_id, like
from app.core.security import get_current_user, require_permission
from app.core.audit import log_action

router = APIRouter()

STATUSES = ["Active", "Onboarding", "Inactive"]


class CompanyCreate(BaseModel):
    name: str
    industry: str
    primary_contact: Optional[str] = None
    email: Optional[str] = None
    status: str = "Active"


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    primary_contact: Optional[str] = None
    email: Optional[str] = None
    status: Optional[str] = None


def _out(c: dict, db: Database):
    active_projects = db[collections.PROJECTS].count_documents({"client": c["name"]})
    lifetime_value = sum(r["invoice_amount"] for r in db[collections.RECEIVABLES].find({"client": c["name"]}))
    return {
        "id": c["id"], "name": c["name"], "industry": c["industry"],
        "primary_contact": c["primary_contact"], "email": c.get("email"), "status": c["status"],
        "active_projects": active_projects, "lifetime_value": lifetime_value,
    }


@router.get("/")
def list_companies(
    industry: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Database = Depends(get_db),
    cu=Depends(get_current_user),
):
    query = {}
    if industry: query["industry"] = industry
    if status: query["status"] = status
    if search: query["name"] = like(search)
    return [_out(c, db) for c in db[collections.COMPANIES].find(query)]


@router.post("/", dependencies=[Depends(require_permission("Companies", "create"))])
def create(payload: CompanyCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if payload.status not in STATUSES:
        raise HTTPException(400, f"status must be one of {STATUSES}")
    cid = f"CO{next_id(db, collections.COMPANIES):03d}"
    doc = {"_id": cid, "id": cid, **payload.dict()}
    db[collections.COMPANIES].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Companies", record_id=cid, detail=f"Created company: {doc['name']}")
    return _out(doc, db)


@router.patch("/{company_id}", dependencies=[Depends(require_permission("Companies", "edit"))])
def update(company_id: str, payload: CompanyUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    c = db[collections.COMPANIES].find_one({"_id": company_id})
    if not c: raise HTTPException(404, "Company not found")
    patch = payload.dict(exclude_none=True)
    if "status" in patch and patch["status"] not in STATUSES:
        raise HTTPException(400, f"status must be one of {STATUSES}")
    if patch:
        db[collections.COMPANIES].update_one({"_id": company_id}, {"$set": patch})
        c = db[collections.COMPANIES].find_one({"_id": company_id})
    log_action(db, user=cu.name, action="UPDATE", module="Companies", record_id=company_id, detail=f"Updated company: {c['name']}")
    return _out(c, db)


@router.delete("/{company_id}", dependencies=[Depends(require_permission("Companies", "delete"))])
def delete(company_id: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    c = db[collections.COMPANIES].find_one({"_id": company_id})
    if not c: raise HTTPException(404, "Company not found")
    db[collections.COMPANIES].delete_one({"_id": company_id})
    log_action(db, user=cu.name, action="DELETE", module="Companies", record_id=company_id, detail=f"Deleted company: {c['name']}")
    return {"message": "Company deleted"}
