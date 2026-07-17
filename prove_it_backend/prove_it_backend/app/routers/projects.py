from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel
from typing import Optional, List
from datetime import date

from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import like
from app.core.security import get_current_user, require_permission
from app.core.audit import log_action
from app.core.permissions import own_emp_id

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
    if cu.role != "Admin":
        emp_id = own_emp_id(db, cu)
        if emp_id:
            assigned = list(db[collections.PROJECT_PERMISSIONS].find({"emp_id": emp_id}))
            if assigned:
                query["_id"] = {"$in": [a["project_id"] for a in assigned if a["allowed"]]}

    return [_proj_out(p) for p in db[collections.PROJECTS].find(query)]


@router.get("/summary")
def summary(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    projects = list(db[collections.PROJECTS].find())
    return {
        "total": len(projects),
        "in_progress": sum(1 for p in projects if p["status"] == "In Progress"),
        "on_hold": sum(1 for p in projects if p["status"] == "On Hold"),
        "completed": sum(1 for p in projects if p["status"] == "Completed"),
        "total_budget": sum(p["budget"] for p in projects),
        "total_est_revenue": sum(p["est_revenue"] for p in projects),
    }


@router.post("/", dependencies=[Depends(require_permission("Projects", "create"))])
def create_project(payload: ProjectCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if db[collections.PROJECTS].find_one({"_id": payload.id}):
        raise HTTPException(400, "Project ID already exists")
    if payload.status not in STATUSES:
        raise HTTPException(400, f"Invalid status. Choose from: {STATUSES}")
    doc = payload.dict()
    doc["_id"] = doc["id"]
    if doc["start_date"]: doc["start_date"] = doc["start_date"].isoformat()
    if doc["end_date"]: doc["end_date"] = doc["end_date"].isoformat()
    db[collections.PROJECTS].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Projects", record_id=doc["id"], detail=f"Created project: {doc['name']}")
    return _proj_out(doc)


@router.get("/{project_id}")
def get_project(project_id: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    p = db[collections.PROJECTS].find_one({"_id": project_id})
    if not p: raise HTTPException(404, "Project not found")
    return _proj_out(p)


@router.patch("/{project_id}", dependencies=[Depends(require_permission("Projects", "edit"))])
def update_project(project_id: str, payload: ProjectUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    p = db[collections.PROJECTS].find_one({"_id": project_id})
    if not p: raise HTTPException(404, "Project not found")
    patch = payload.dict(exclude_none=True)
    if "start_date" in patch: patch["start_date"] = patch["start_date"].isoformat()
    if "end_date" in patch: patch["end_date"] = patch["end_date"].isoformat()
    if patch:
        db[collections.PROJECTS].update_one({"_id": project_id}, {"$set": patch})
        p = db[collections.PROJECTS].find_one({"_id": project_id})
    log_action(db, user=cu.name, action="UPDATE", module="Projects", record_id=p["id"], detail=f"Updated project: {p['name']}")
    return _proj_out(p)


@router.delete("/{project_id}", dependencies=[Depends(require_permission("Projects", "delete"))])
def delete_project(project_id: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    p = db[collections.PROJECTS].find_one({"_id": project_id})
    if not p: raise HTTPException(404, "Project not found")
    db[collections.PROJECTS].delete_one({"_id": project_id})
    log_action(db, user=cu.name, action="DELETE", module="Projects", record_id=project_id, detail=f"Deleted project: {p['name']}")
    return {"message": "Project deleted"}
