from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import like
from app.core.security import get_current_user, require_permission
from app.core.audit import log_action
from app.core.permissions import has_permission, is_own_record

router = APIRouter()

STAGES = ["New", "Contacted", "Qualified", "Proposal", "Won / Project", "Lost / Cold"]


class LeadCreate(BaseModel):
    lead_id: str
    company: str
    contact: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    value: float = 0
    owner: str
    stage: str = "New"
    followup_date: Optional[date] = None
    projects: Optional[str] = None   # comma-separated
    source: Optional[str] = None


class LeadUpdate(BaseModel):
    company: Optional[str] = None
    contact: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    value: Optional[float] = None
    owner: Optional[str] = None
    stage: Optional[str] = None
    followup_date: Optional[date] = None
    projects: Optional[str] = None
    source: Optional[str] = None
    converted: Optional[str] = None


def _out(l: dict):
    return {
        "lead_id": l["lead_id"], "company": l["company"], "contact": l["contact"],
        "email": l["email"], "phone": l["phone"], "value": l["value"], "owner": l["owner"],
        "stage": l["stage"],
        "followup_date": str(l["followup_date"]) if l["followup_date"] else None,
        "projects": l["projects"].split(",") if l["projects"] else [],
        "source": l["source"], "converted": l["converted"],
    }


@router.get("/")
def list_leads(
    stage: Optional[str] = Query(None),
    owner: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    converted: Optional[str] = Query(None),
    db: Database = Depends(get_db), cu=Depends(get_current_user),
):
    query = {}
    if not (cu.role == "Admin" or has_permission(db, cu, "Lead Management", "view")):
        if owner and owner != cu.name:
            raise HTTPException(403, "You may only view your own leads")
        query["owner"] = cu.name
    if stage: query["stage"] = stage
    if owner: query["owner"] = owner
    if converted: query["converted"] = converted
    if search:
        query["$or"] = [{"company": like(search)}, {"contact": like(search)}, {"email": like(search)}]
    rows = db[collections.LEADS].find(query).sort("followup_date", 1)
    return [_out(l) for l in rows]


@router.get("/summary")
def summary(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    leads = list(db[collections.LEADS].find())
    today = date.today().isoformat()
    by_stage = {}
    for s in STAGES:
        sl = [l for l in leads if l["stage"] == s]
        by_stage[s] = {"count": len(sl), "value": sum(l["value"] for l in sl)}
    return {
        "total": len(leads),
        "total_pipeline_value": sum(l["value"] for l in leads),
        "by_stage": by_stage,
        "needs_followup": sum(1 for l in leads if l["followup_date"] and l["followup_date"] <= today and l["stage"] not in ("Won / Project", "Lost / Cold")),
    }


@router.post("/")
def create_lead(payload: LeadCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if db[collections.LEADS].find_one({"_id": payload.lead_id}):
        raise HTTPException(400, "Lead ID already exists")
    if payload.stage not in STAGES:
        raise HTTPException(400, f"stage must be one of {STAGES}")
    if not is_own_record(cu, payload.owner) and not has_permission(db, cu, "Lead Management", "create"):
        raise HTTPException(403, "You may only create leads owned by yourself")
    doc = payload.dict()
    doc["_id"] = doc["lead_id"]
    if doc["followup_date"]: doc["followup_date"] = doc["followup_date"].isoformat()
    doc["converted"] = "No"
    db[collections.LEADS].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Leads", record_id=doc["lead_id"], detail=f"New lead: {doc['company']}")
    return _out(doc)


@router.get("/{lead_id}")
def get_lead(lead_id: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    l = db[collections.LEADS].find_one({"_id": lead_id})
    if not l: raise HTTPException(404, "Lead not found")
    return _out(l)


@router.patch("/{lead_id}")
def update_lead(lead_id: str, payload: LeadUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    l = db[collections.LEADS].find_one({"_id": lead_id})
    if not l: raise HTTPException(404, "Lead not found")
    if not has_permission(db, cu, "Lead Management", "edit") and not is_own_record(cu, l["owner"]):
        raise HTTPException(403, "You may only edit your own leads")
    old_stage = l["stage"]
    patch = payload.dict(exclude_none=True)
    if "followup_date" in patch: patch["followup_date"] = patch["followup_date"].isoformat()
    if patch:
        db[collections.LEADS].update_one({"_id": lead_id}, {"$set": patch})
        l = db[collections.LEADS].find_one({"_id": lead_id})
    detail = f"Stage: {old_stage} → {l['stage']}" if old_stage != l["stage"] else f"Updated {l['company']}"
    log_action(db, user=cu.name, action="UPDATE", module="Leads", record_id=l["lead_id"], detail=detail)
    return _out(l)


@router.post("/{lead_id}/convert", dependencies=[Depends(require_permission("Lead Management", "edit"))])
def convert_lead(lead_id: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    """Mark lead as converted (Won / Project) and flag for project creation."""
    l = db[collections.LEADS].find_one({"_id": lead_id})
    if not l: raise HTTPException(404, "Lead not found")
    db[collections.LEADS].update_one({"_id": lead_id}, {"$set": {"stage": "Won / Project", "converted": "Yes"}})
    l = db[collections.LEADS].find_one({"_id": lead_id})
    log_action(db, user=cu.name, action="UPDATE", module="Leads", record_id=lead_id, detail=f"Lead converted to project: {l['company']}")
    return {**_out(l), "message": "Lead converted. Create a Project to complete the handoff."}


@router.delete("/{lead_id}", dependencies=[Depends(require_permission("Lead Management", "delete"))])
def delete_lead(lead_id: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    l = db[collections.LEADS].find_one({"_id": lead_id})
    if not l: raise HTTPException(404, "Lead not found")
    db[collections.LEADS].delete_one({"_id": lead_id})
    log_action(db, user=cu.name, action="DELETE", module="Leads", record_id=lead_id)
    return {"message": "Lead deleted"}
