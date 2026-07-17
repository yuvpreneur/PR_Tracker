from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel
from typing import Optional, List
from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import next_id
from app.core.security import get_current_user, require_role
from app.core.audit import log_action
from app.core.permissions import (
    MODULES, get_role_permissions, effective_view_default, own_emp_id,
)

router = APIRouter()


def _role_for_emp(db: Database, emp_id: str) -> Optional[str]:
    """An employee's real login role (Users.role, matched by name) — the same role every
    other permission check in the app uses, not the separate (and not always in sync)
    Employees.role field."""
    emp = db[collections.EMPLOYEES].find_one({"_id": emp_id})
    if not emp:
        return None
    user = db[collections.USERS].find_one({"name": emp["name"]})
    return user["role"] if user else emp.get("role")


# ── Schemas ──────────────────────────────────────────────────────────────────

class PagePermUpdate(BaseModel):
    emp_id: str
    permissions: List[dict]   # [{"page": "Reports", "allowed": True}, ...]


class ProjPermUpdate(BaseModel):
    emp_id: str
    permissions: List[dict]   # [{"project_id": "P001", "allowed": True}, ...]


class AccessReqCreate(BaseModel):
    page: str
    project: Optional[str] = None
    reason: Optional[str] = None


class ReqAction(BaseModel):
    pass


class LeadProjectSettingCreate(BaseModel):
    project_id: str
    default_stage: str = "New"


class CustomPageCreate(BaseModel):
    name: str
    icon: Optional[str] = None
    visibility: str = "Admin only"
    projects: List[str] = []
    initial_access: List[str] = []


# ── Page Permissions ──────────────────────────────────────────────────────────

@router.get("/pages/{emp_id}", dependencies=[Depends(require_role("Admin"))])
def get_page_permissions(emp_id: str, db: Database = Depends(get_db)):
    # Always return every controlled module, defaulting an unconfigured one to what this
    # employee's role *already* effectively grants them (self-service-aware) — not blank/
    # unchecked. Otherwise opening this card for a never-configured employee and clicking
    # Save without changing anything would silently write an explicit "denied" row for
    # every module, locking them out of pages their role currently lets them use.
    role = _role_for_emp(db, emp_id)
    role_perms = get_role_permissions(db, role) if role else {}
    saved = {p["page"]: p["allowed"] for p in db[collections.PAGE_PERMISSIONS].find({"emp_id": emp_id})}
    return [
        {"page": m, "allowed": saved.get(m, effective_view_default(role_perms, role, m) if role else False)}
        for m in MODULES
    ]


@router.post("/pages", dependencies=[Depends(require_role("Admin"))])
def set_page_permissions(payload: PagePermUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    # Delete existing, re-insert
    db[collections.PAGE_PERMISSIONS].delete_many({"emp_id": payload.emp_id})
    for item in payload.permissions:
        pid = next_id(db, collections.PAGE_PERMISSIONS)
        db[collections.PAGE_PERMISSIONS].insert_one({
            "_id": pid, "id": pid, "emp_id": payload.emp_id,
            "page": item["page"], "allowed": item.get("allowed", False),
        })
    log_action(db, user=cu.name, action="UPDATE", module="Access Control", record_id=payload.emp_id, detail="Page permissions updated")
    return {"message": "Page permissions saved"}


# ── Project Permissions ───────────────────────────────────────────────────────

@router.get("/projects/{emp_id}", dependencies=[Depends(require_role("Admin"))])
def get_project_permissions(emp_id: str, db: Database = Depends(get_db)):
    # Same "reflect true current access, don't default to unchecked" reasoning as
    # get_page_permissions() above. Every role currently sees every project (nothing has
    # ever scoped the Projects list before now — see list_projects() in projects.py), so
    # an employee with NO saved rows yet defaults every project to allowed=True. Once ANY
    # row has been explicitly saved for them, an unmentioned project defaults to False —
    # curation has started, so from then on assignment is opt-in per project.
    saved = {p["project_id"]: p["allowed"] for p in db[collections.PROJECT_PERMISSIONS].find({"emp_id": emp_id})}
    unrestricted = not saved
    return [
        {"project_id": p["_id"], "allowed": saved.get(p["_id"], unrestricted)}
        for p in db[collections.PROJECTS].find()
    ]


@router.post("/projects", dependencies=[Depends(require_role("Admin"))])
def set_project_permissions(payload: ProjPermUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    db[collections.PROJECT_PERMISSIONS].delete_many({"emp_id": payload.emp_id})
    for item in payload.permissions:
        pid = next_id(db, collections.PROJECT_PERMISSIONS)
        db[collections.PROJECT_PERMISSIONS].insert_one({
            "_id": pid, "id": pid, "emp_id": payload.emp_id,
            "project_id": item["project_id"], "allowed": item.get("allowed", False),
        })
    log_action(db, user=cu.name, action="UPDATE", module="Access Control", record_id=payload.emp_id, detail="Project permissions updated")
    return {"message": "Project permissions saved"}


# ── Access Requests ───────────────────────────────────────────────────────────

def _req_out(r: dict):
    return {
        "id": r["id"], "requester": r["requester"], "emp_id": r.get("emp_id"),
        "page": r["page"], "project": r["project"], "reason": r["reason"], "status": r["status"],
    }


@router.get("/requests", dependencies=[Depends(require_role("Admin"))])
def list_requests(status: Optional[str] = Query(None), db: Database = Depends(get_db)):
    query = {}
    if status: query["status"] = status
    rows = db[collections.ACCESS_REQUESTS].find(query)
    return [_req_out(r) for r in rows]


@router.post("/requests")
def submit_request(payload: AccessReqCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    # requester/emp_id are always the logged-in user's own identity — never client-supplied
    # (same reasoning as Timesheets: a spoofable "who is this for" field would let anyone
    # request access on someone else's behalf).
    rid = next_id(db, collections.ACCESS_REQUESTS)
    doc = {
        "_id": rid, "id": rid, "status": "Pending",
        "requester": cu.name, "emp_id": own_emp_id(db, cu),
        **payload.dict(),
    }
    db[collections.ACCESS_REQUESTS].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Access Control", record_id=str(rid), detail=f"Access requested for {doc['page']}")
    return _req_out(doc)


@router.post("/requests/{req_id}/approve", dependencies=[Depends(require_role("Admin"))])
def approve_request(req_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    r = db[collections.ACCESS_REQUESTS].find_one({"_id": req_id})
    if not r: raise HTTPException(404, "Request not found")
    db[collections.ACCESS_REQUESTS].update_one({"_id": req_id}, {"$set": {"status": "Approved"}})

    # Actually grant what was requested — not just flip the status badge. Only possible
    # when the requester has a real employee record and the page is one of the controlled
    # modules (a request for e.g. "Dashboard" has nothing to grant — always visible anyway).
    detail = f"Approved {r['page']} for {r['requester']}"
    emp_id = r.get("emp_id")
    if emp_id and r["page"] in MODULES:
        existing = db[collections.PAGE_PERMISSIONS].find_one({"emp_id": emp_id, "page": r["page"]})
        if existing:
            db[collections.PAGE_PERMISSIONS].update_one({"_id": existing["_id"]}, {"$set": {"allowed": True}})
        else:
            pid = next_id(db, collections.PAGE_PERMISSIONS)
            db[collections.PAGE_PERMISSIONS].insert_one(
                {"_id": pid, "id": pid, "emp_id": emp_id, "page": r["page"], "allowed": True}
            )
        detail += " — page access granted"
    else:
        detail += " — status only (no employee record or not a grantable page)"

    log_action(db, user=cu.name, action="APPROVE", module="Access Control", record_id=str(req_id), detail=detail)
    return {"message": "Request approved"}


@router.post("/requests/{req_id}/reject", dependencies=[Depends(require_role("Admin"))])
def reject_request(req_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    r = db[collections.ACCESS_REQUESTS].find_one({"_id": req_id})
    if not r: raise HTTPException(404, "Request not found")
    db[collections.ACCESS_REQUESTS].update_one({"_id": req_id}, {"$set": {"status": "Rejected"}})
    log_action(db, user=cu.name, action="REJECT", module="Access Control", record_id=str(req_id), detail=f"Rejected {r['page']} for {r['requester']}")
    return {"message": "Request rejected"}


# ── Lead Management Project Settings ──────────────────────────────────────────
# Saved reference config only — does not gate what a user can actually pick when creating/editing a lead.

@router.get("/lead-project-settings", dependencies=[Depends(require_role("Admin"))])
def list_lead_project_settings(db: Database = Depends(get_db)):
    rows = db[collections.LEAD_PROJECT_SETTINGS].find()
    return [{"id": r["id"], "project_id": r["project_id"], "default_stage": r["default_stage"]} for r in rows]


@router.post("/lead-project-settings", dependencies=[Depends(require_role("Admin"))])
def upsert_lead_project_setting(payload: LeadProjectSettingCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    existing = db[collections.LEAD_PROJECT_SETTINGS].find_one({"project_id": payload.project_id})
    if existing:
        db[collections.LEAD_PROJECT_SETTINGS].update_one({"project_id": payload.project_id}, {"$set": {"default_stage": payload.default_stage}})
    else:
        pid = next_id(db, collections.LEAD_PROJECT_SETTINGS)
        db[collections.LEAD_PROJECT_SETTINGS].insert_one({"_id": pid, "id": pid, "project_id": payload.project_id, "default_stage": payload.default_stage})
    log_action(db, user=cu.name, action="UPDATE", module="Access Control", record_id=payload.project_id, detail=f"Lead Management default stage set to {payload.default_stage}")
    return {"message": "Saved"}


# ── Custom Pages ───────────────────────────────────────────────────────────────
# Saved config only — does not add a working nav item/page to the running app (the app's page list is fixed).

@router.get("/custom-pages", dependencies=[Depends(require_role("Admin"))])
def list_custom_pages(db: Database = Depends(get_db)):
    rows = db[collections.CUSTOM_PAGES].find()
    return [
        {"id": r["id"], "name": r["name"], "icon": r["icon"], "visibility": r["visibility"],
         "projects": r["projects"], "initial_access": r["initial_access"]}
        for r in rows
    ]


@router.post("/custom-pages", dependencies=[Depends(require_role("Admin"))])
def create_custom_page(payload: CustomPageCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    pid = next_id(db, collections.CUSTOM_PAGES)
    doc = {"_id": pid, "id": pid, **payload.dict()}
    db[collections.CUSTOM_PAGES].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Access Control", record_id=str(pid), detail=f"Custom page config saved: {doc['name']}")
    return doc
