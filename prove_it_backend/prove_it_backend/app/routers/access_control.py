import re

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel
from typing import Optional, List
from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import next_id
from app.core.security import get_current_user, require_role
from app.core.audit import log_action
from app.core.notifications import notify
from app.core.permissions import (
    MODULES, get_role_permissions, effective_view_default, own_emp_id,
)
from app.core import prmanager_client

router = APIRouter()


def _role_for_emp(db: Database, emp_id: str, org_id) -> Optional[str]:
    """An employee's real login role (Users.role, matched by name) — the same role every
    other permission check in the app uses, not the separate (and not always in sync)
    Employees.role field. Case-insensitive for the same reason as my_emp_ids() in
    app/core/permissions.py — User.name and Employees.name are independently typed and
    have been found to differ only in case for real accounts."""
    emp = db[collections.EMPLOYEES].find_one({"_id": emp_id, "org_id": org_id})
    if not emp:
        return None
    pattern = f"^{re.escape(emp['name'])}$"
    user = db[collections.USERS].find_one({"name": {"$regex": pattern, "$options": "i"}, "org_id": org_id})
    return user["role"] if user else emp.get("role")


# ── Schemas ──────────────────────────────────────────────────────────────────

class PagePermUpdate(BaseModel):
    emp_id: str
    permissions: List[dict]   # [{"page": "Reports", "allowed": True}, ...]


class ProjPermUpdate(BaseModel):
    emp_id: str
    permissions: List[dict]   # [{"project_id": "P001", "allowed": True}, ...]


class AccessReqCreate(BaseModel):
    # "page" requests grant a controlled module/page (Timesheets, Reports, ...); "project"
    # requests grant a specific project (Assigned Projects). `project` stays a free-text
    # context label for page requests ("which project is this for") — it's display-only,
    # never a grant target. `project_id` is the real target for a project-type request.
    request_type: str = "page"
    page: Optional[str] = None
    project: Optional[str] = None
    project_id: Optional[str] = None
    reason: Optional[str] = None


class ReqAction(BaseModel):
    pass


# ── Page Permissions ──────────────────────────────────────────────────────────

@router.get("/pages/{emp_id}", dependencies=[Depends(require_role("Admin", "Manager"))])
def get_page_permissions(emp_id: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    # Always return every controlled module, defaulting an unconfigured one to what this
    # employee's role *already* effectively grants them (self-service-aware) — not blank/
    # unchecked. Otherwise opening this card for a never-configured employee and clicking
    # Save without changing anything would silently write an explicit "denied" row for
    # every module, locking them out of pages their role currently lets them use.
    role = _role_for_emp(db, emp_id, cu.org_id)
    role_perms = get_role_permissions(db, role, cu.org_id) if role else {}
    saved = {p["page"]: p["allowed"] for p in db[collections.PAGE_PERMISSIONS].find({"emp_id": emp_id, "org_id": cu.org_id})}
    return [
        {"page": m, "allowed": saved.get(m, effective_view_default(role_perms, role, m) if role else False)}
        for m in MODULES
    ]


@router.post("/pages", dependencies=[Depends(require_role("Admin", "Manager"))])
def set_page_permissions(payload: PagePermUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if not db[collections.EMPLOYEES].find_one({"_id": payload.emp_id, "org_id": cu.org_id}):
        raise HTTPException(404, "Employee not found")
    # Delete existing, re-insert
    db[collections.PAGE_PERMISSIONS].delete_many({"emp_id": payload.emp_id, "org_id": cu.org_id})
    for item in payload.permissions:
        pid = next_id(db, collections.PAGE_PERMISSIONS)
        db[collections.PAGE_PERMISSIONS].insert_one({
            "_id": pid, "id": pid, "emp_id": payload.emp_id,
            "page": item["page"], "allowed": item.get("allowed", False),
            "org_id": cu.org_id,
        })
    log_action(db, user=cu.name, action="UPDATE", module="Access Control", org_id=cu.org_id, record_id=payload.emp_id, detail="Page permissions updated")
    return {"message": "Page permissions saved"}


# ── Project Permissions ───────────────────────────────────────────────────────

@router.get("/projects/{emp_id}", dependencies=[Depends(require_role("Admin", "Manager"))])
def get_project_permissions(emp_id: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    # Restrict-by-default (see assigned_project_ids() in app/core/permissions.py): an
    # employee with no saved rows yet has NO access, so every project defaults to
    # unchecked here too — this checklist must reflect their real current access.
    saved = {p["project_id"]: p["allowed"] for p in db[collections.PROJECT_PERMISSIONS].find({"emp_id": emp_id, "org_id": cu.org_id})}
    return [
        {"project_id": p["_id"], "allowed": saved.get(p["_id"], False)}
        for p in db[collections.PROJECTS].find({"org_id": cu.org_id})
    ]


@router.post("/projects", dependencies=[Depends(require_role("Admin", "Manager"))])
def set_project_permissions(payload: ProjPermUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if not db[collections.EMPLOYEES].find_one({"_id": payload.emp_id, "org_id": cu.org_id}):
        raise HTTPException(404, "Employee not found")
    project_ids = [item["project_id"] for item in payload.permissions]
    if project_ids:
        found = {p["_id"] for p in db[collections.PROJECTS].find({"_id": {"$in": project_ids}, "org_id": cu.org_id}, {"_id": 1})}
        missing = set(project_ids) - found
        if missing:
            raise HTTPException(400, f"Unknown project id(s): {', '.join(sorted(missing))}")
    db[collections.PROJECT_PERMISSIONS].delete_many({"emp_id": payload.emp_id, "org_id": cu.org_id})
    for item in payload.permissions:
        pid = next_id(db, collections.PROJECT_PERMISSIONS)
        db[collections.PROJECT_PERMISSIONS].insert_one({
            "_id": pid, "id": pid, "emp_id": payload.emp_id,
            "project_id": item["project_id"], "allowed": item.get("allowed", False),
            "org_id": cu.org_id,
        })
    log_action(db, user=cu.name, action="UPDATE", module="Access Control", org_id=cu.org_id, record_id=payload.emp_id, detail="Project permissions updated")

    # PR Manager membership is derived from these grants (see prmanager_client.
    # sync_employee_to_pm) — a grant change while access is already enabled must
    # re-sync immediately, not wait for the next unrelated Employee edit.
    emp = db[collections.EMPLOYEES].find_one({"_id": payload.emp_id, "org_id": cu.org_id})
    if emp and emp.get("pm_access_enabled"):
        prmanager_client.sync_employee_to_pm(db, emp)

    return {"message": "Project permissions saved"}


# ── Access Requests ───────────────────────────────────────────────────────────

def _req_out(r: dict, project_name: str = None):
    return {
        "id": r["id"], "requester": r["requester"], "emp_id": r.get("emp_id"),
        "request_type": r.get("request_type", "page"),
        "page": r.get("page"), "project": r.get("project"),
        "project_id": r.get("project_id"), "project_name": project_name,
        "reason": r["reason"], "status": r["status"],
    }


@router.get("/requests", dependencies=[Depends(require_role("Admin", "Manager"))])
def list_requests(status: Optional[str] = Query(None), db: Database = Depends(get_db), cu=Depends(get_current_user)):
    query = {"org_id": cu.org_id}
    if status: query["status"] = status
    rows = list(db[collections.ACCESS_REQUESTS].find(query))
    proj_ids = {r["project_id"] for r in rows if r.get("project_id")}
    names = {p["_id"]: p["name"] for p in db[collections.PROJECTS].find({"_id": {"$in": list(proj_ids)}, "org_id": cu.org_id})}
    return [_req_out(r, names.get(r.get("project_id"))) for r in rows]


@router.get("/requestable-projects")
def list_requestable_projects(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    """Every project, unfiltered by this user's current Assigned Projects scoping — used
    only to populate the "which project do I need access to" picker, so someone can
    request a project they can't yet see. Id/name only, no financial fields."""
    return [{"id": p["_id"], "name": p["name"]} for p in db[collections.PROJECTS].find({"org_id": cu.org_id})]


@router.post("/requests")
def submit_request(payload: AccessReqCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if payload.request_type not in ("page", "project"):
        raise HTTPException(400, "request_type must be 'page' or 'project'")
    if payload.request_type == "page" and not payload.page:
        raise HTTPException(400, "page is required for a page access request")
    if payload.request_type == "project":
        if not payload.project_id:
            raise HTTPException(400, "project_id is required for a project access request")
        if not db[collections.PROJECTS].find_one({"_id": payload.project_id, "org_id": cu.org_id}):
            raise HTTPException(404, "Project not found")

    # requester/emp_id are always the logged-in user's own identity — never client-supplied
    # (same reasoning as Timesheets: a spoofable "who is this for" field would let anyone
    # request access on someone else's behalf).
    rid = next_id(db, collections.ACCESS_REQUESTS)
    doc = {
        "_id": rid, "id": rid, "status": "Pending",
        "requester": cu.name, "emp_id": own_emp_id(db, cu),
        **payload.dict(),
        "org_id": cu.org_id,
    }
    db[collections.ACCESS_REQUESTS].insert_one(doc)
    target = doc["page"] if doc["request_type"] == "page" else f"project {doc['project_id']}"
    log_action(db, user=cu.name, action="CREATE", module="Access Control", record_id=str(rid), detail=f"Access requested for {target}", org_id=cu.org_id)
    return _req_out(doc)


@router.post("/requests/{req_id}/approve", dependencies=[Depends(require_role("Admin", "Manager"))])
def approve_request(req_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    r = db[collections.ACCESS_REQUESTS].find_one({"_id": req_id, "org_id": cu.org_id})
    if not r: raise HTTPException(404, "Request not found")
    db[collections.ACCESS_REQUESTS].update_one({"_id": req_id, "org_id": cu.org_id}, {"$set": {"status": "Approved"}})

    # Actually grant what was requested — not just flip the status badge. Only possible
    # when the requester has a real employee record.
    emp_id = r.get("emp_id")
    request_type = r.get("request_type", "page")

    if request_type == "project" and emp_id and r.get("project_id"):
        # Note: PROJECT_PERMISSIONS' own semantics apply here same as a manual Access
        # Control grant (see get_project_permissions()) — an employee with NO rows yet is
        # unrestricted (sees every project); inserting this first row switches them to an
        # explicit allow-list, so every OTHER project they could previously see now needs
        # its own row too. Same tradeoff as an Admin manually checking one box for a
        # previously-unrestricted employee; not special-cased here.
        existing = db[collections.PROJECT_PERMISSIONS].find_one({"emp_id": emp_id, "project_id": r["project_id"], "org_id": cu.org_id})
        if existing:
            db[collections.PROJECT_PERMISSIONS].update_one({"_id": existing["_id"]}, {"$set": {"allowed": True}})
        else:
            pid = next_id(db, collections.PROJECT_PERMISSIONS)
            db[collections.PROJECT_PERMISSIONS].insert_one(
                {"_id": pid, "id": pid, "emp_id": emp_id, "project_id": r["project_id"], "allowed": True, "org_id": cu.org_id}
            )
        detail = f"Approved project access to {r['project_id']} for {r['requester']} — project access granted"
    elif request_type == "page" and emp_id and r.get("page") in MODULES:
        existing = db[collections.PAGE_PERMISSIONS].find_one({"emp_id": emp_id, "page": r["page"], "org_id": cu.org_id})
        if existing:
            db[collections.PAGE_PERMISSIONS].update_one({"_id": existing["_id"]}, {"$set": {"allowed": True}})
        else:
            pid = next_id(db, collections.PAGE_PERMISSIONS)
            db[collections.PAGE_PERMISSIONS].insert_one(
                {"_id": pid, "id": pid, "emp_id": emp_id, "page": r["page"], "allowed": True, "org_id": cu.org_id}
            )
        detail = f"Approved {r['page']} for {r['requester']} — page access granted"
    else:
        detail = f"Approved request for {r['requester']} — status only (no employee record or not a grantable target)"

    log_action(db, user=cu.name, action="APPROVE", module="Access Control", record_id=str(req_id), detail=detail, org_id=cu.org_id)
    target = r["page"] if request_type == "page" else f"project {r.get('project_id')}"
    notify(
        db, recipient=r["requester"], module="Access Control", record_id=req_id, status="Approved",
        message=f"Your access request for {target} was approved.", org_id=cu.org_id,
    )
    return {"message": "Request approved"}


@router.post("/requests/{req_id}/reject", dependencies=[Depends(require_role("Admin", "Manager"))])
def reject_request(req_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    r = db[collections.ACCESS_REQUESTS].find_one({"_id": req_id, "org_id": cu.org_id})
    if not r: raise HTTPException(404, "Request not found")
    db[collections.ACCESS_REQUESTS].update_one({"_id": req_id, "org_id": cu.org_id}, {"$set": {"status": "Rejected"}})
    target = r["page"] if r.get("request_type", "page") == "page" else f"project {r.get('project_id')}"
    log_action(db, user=cu.name, action="REJECT", module="Access Control", record_id=str(req_id), detail=f"Rejected {target} for {r['requester']}", org_id=cu.org_id)
    notify(
        db, recipient=r["requester"], module="Access Control", record_id=req_id, status="Rejected",
        message=f"Your access request for {target} was rejected.", org_id=cu.org_id,
    )
    return {"message": "Request rejected"}
