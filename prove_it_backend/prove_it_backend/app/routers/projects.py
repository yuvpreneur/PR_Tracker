from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime, timezone

from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import like, get_or_404, next_id
from app.core.security import get_current_user, require_permission
from app.core.audit import log_action
from app.core import prmanager_client
from app.core.permissions import assigned_project_ids

router = APIRouter()

STATUSES = ["Not Started", "In Progress", "On Hold", "Completed", "Cancelled"]


class ProjectCreate(BaseModel):
    id: str
    name: str
    client: str
    manager: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: str = "Not Started"
    budget: float = 0
    est_revenue: float = 0
    est_expense: float = 0
    assigned_emp_ids: Optional[list] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    client: Optional[str] = None
    manager: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    budget: Optional[float] = None
    est_revenue: Optional[float] = None
    est_expense: Optional[float] = None


def _proj_out(p: dict):
    return {
        "id": p["id"], "name": p["name"], "client": p["client"], "manager": p["manager"],
        "start_date": str(p["start_date"]) if p["start_date"] else None,
        "end_date": str(p["end_date"]) if p["end_date"] else None,
        "status": p["status"], "budget": p["budget"],
        "est_revenue": p["est_revenue"], "est_expense": p["est_expense"],
        # PR Manager sync (system-managed — never accepted from ProjectCreate/ProjectUpdate)
        "pm_project_id": p.get("pm_project_id"),
        "pm_sync_status": p.get("pm_sync_status", "Not Synced"),
        "pm_missing_fields": p.get("pm_missing_fields", []),
        "pm_last_synced_at": p.get("pm_last_synced_at"),
    }


@router.get("/")
def list_projects(
    status: Optional[str] = Query(None),
    client: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Database = Depends(get_db),
    cu=Depends(get_current_user),
):
    query = {}
    if status:
        query["status"] = status
    if client:
        query["client"] = client
    if search:
        query["$or"] = [{"name": like(search)}, {"client": like(search)}]

    # "Users only see project records assigned to them" (Access Control → Assigned
    # Projects). Only enforced once an Admin has actually assigned this employee at least
    # one project — otherwise every account would go from "sees everything" to "sees
    # nothing" the instant this shipped, before anyone had configured anything.
    # Finance User is unrestricted here, same as Admin/Manager — they need every project
    # visible as financial context (budget/revenue/expense), not just ones assigned to them.
    assigned_ids = None if cu.role == "Finance User" else assigned_project_ids(db, cu)
    if assigned_ids is not None:
        query["_id"] = {"$in": assigned_ids}

    query["org_id"] = cu.org_id
    return [_proj_out(p) for p in db[collections.PROJECTS].find(query)]


@router.get("/summary")
def summary(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    projects = list(db[collections.PROJECTS].find({"org_id": cu.org_id}))
    return {
        "total": len(projects),
        "in_progress": sum(1 for p in projects if p["status"] == "In Progress"),
        "on_hold": sum(1 for p in projects if p["status"] == "On Hold"),
        "completed": sum(1 for p in projects if p["status"] == "Completed"),
        "total_budget": sum(p["budget"] for p in projects),
        "total_est_revenue": sum(p["est_revenue"] for p in projects),
    }


@router.get("/employees-for-assignment")
def get_employees_for_assignment(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    employees = list(db[collections.EMPLOYEES].find({"org_id": cu.org_id}, {"_id": 1, "name": 1}).sort("name", 1))
    return [{"id": e["_id"], "name": e["name"]} for e in employees]


@router.post("/", dependencies=[Depends(require_permission("Projects", "create"))])
def create_project(payload: ProjectCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if db[collections.PROJECTS].find_one({"_id": payload.id, "org_id": cu.org_id}):
        raise HTTPException(400, "Project ID already exists")
    if payload.status not in STATUSES:
        raise HTTPException(400, f"Invalid status. Choose from: {STATUSES}")
    doc = payload.dict(exclude={"assigned_emp_ids"})
    doc["_id"] = doc["id"]
    doc["org_id"] = cu.org_id
    if doc["start_date"]: doc["start_date"] = doc["start_date"].isoformat()
    if doc["end_date"]: doc["end_date"] = doc["end_date"].isoformat()
    doc.update({
        # pm_org_id is resolved once from the linked Company and cached here rather than
        # re-derived from `client` on every sync — `client` is a free-text name match, not
        # an FK, so a later Company rename must not silently break an already-linked Project.
        "pm_org_id": None, "pm_project_id": None, "pm_sync_status": "Not Synced",
        "pm_missing_fields": [], "pm_last_synced_at": None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    db[collections.PROJECTS].insert_one(doc)

    # Assign the project to selected employees
    if payload.assigned_emp_ids:
        for emp_id in payload.assigned_emp_ids:
            pid = next_id(db, collections.PROJECT_PERMISSIONS)
            db[collections.PROJECT_PERMISSIONS].insert_one({
                "_id": pid, "id": pid, "emp_id": emp_id,
                "project_id": doc["id"], "allowed": True,
                "org_id": cu.org_id,
            })

    log_action(db, user=cu.name, action="CREATE", module="Projects", org_id=cu.org_id, record_id=doc["id"], detail=f"Created project: {doc['name']}")
    doc.update(prmanager_client.sync_project_to_pm(db, doc))
    return _proj_out(doc)


@router.get("/{project_id}")
def get_project(project_id: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    assigned_ids = None if cu.role == "Finance User" else assigned_project_ids(db, cu)
    if assigned_ids is not None and project_id not in assigned_ids:
        raise HTTPException(404, "Project not found")
    p = get_or_404(db, collections.PROJECTS, project_id, cu.org_id, "Project not found")
    return _proj_out(p)


@router.patch("/{project_id}", dependencies=[Depends(require_permission("Projects", "edit"))])
def update_project(project_id: str, payload: ProjectUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    p = get_or_404(db, collections.PROJECTS, project_id, cu.org_id, "Project not found")
    patch = payload.dict(exclude_none=True)
    if "start_date" in patch: patch["start_date"] = patch["start_date"].isoformat()
    if "end_date" in patch: patch["end_date"] = patch["end_date"].isoformat()
    if patch:
        patch["updated_at"] = datetime.now(timezone.utc).isoformat()
        db[collections.PROJECTS].update_one({"_id": project_id, "org_id": cu.org_id}, {"$set": patch})
        p = get_or_404(db, collections.PROJECTS, project_id, cu.org_id, "Project not found")
        p.update(prmanager_client.sync_project_to_pm(db, p))
    log_action(db, user=cu.name, action="UPDATE", module="Projects", org_id=cu.org_id, record_id=p["id"], detail=f"Updated project: {p['name']}")
    return _proj_out(p)


@router.delete("/{project_id}", dependencies=[Depends(require_permission("Projects", "delete"))])
def delete_project(project_id: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    p = get_or_404(db, collections.PROJECTS, project_id, cu.org_id, "Project not found")
    db[collections.PROJECTS].delete_one({"_id": project_id, "org_id": cu.org_id})
    log_action(db, user=cu.name, action="DELETE", module="Projects", org_id=cu.org_id, record_id=project_id, detail=f"Deleted project: {p['name']}")
    return {"message": "Project deleted"}
