from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.core import collections
from app.core.database import client, get_db
from app.core.mongo_utils import like, get_or_404
from app.core.security import get_current_user, require_permission
from app.core.audit import log_action
from app.core.permissions import has_permission, my_emp_ids

router = APIRouter()


class EmpCreate(BaseModel):
    emp_id: str
    name: str
    department: Optional[str] = None
    designation: Optional[str] = None
    email: str
    phone: Optional[str] = None
    joining_date: Optional[date] = None
    relieving_date: Optional[date] = None
    role: str = "Employee"
    billable: bool = True
    status: str = "Active"


class EmpUpdate(BaseModel):
    emp_id: Optional[str] = None
    name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    joining_date: Optional[date] = None
    relieving_date: Optional[date] = None
    role: Optional[str] = None
    billable: Optional[bool] = None
    status: Optional[str] = None


def _out(e: dict):
    return {
        "emp_id": e["emp_id"], "name": e["name"], "department": e["department"],
        "designation": e["designation"], "email": e["email"], "phone": e["phone"],
        "joining_date": str(e["joining_date"]) if e["joining_date"] else None,
        "relieving_date": str(e["relieving_date"]) if e.get("relieving_date") else None,
        "role": e["role"], "billable": e["billable"], "status": e["status"],
    }


@router.get("/")
def list_employees(
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Database = Depends(get_db),
    cu=Depends(get_current_user),
):
    # No blanket Employees:view (Employee role, by default) → scoped to just their own
    # record(s), not blocked outright — same "mine" pattern as Leave, and what
    # lets the personal Dashboard (useDashboardData.js) resolve its own emp_id via this
    # same endpoint.
    if not has_permission(db, cu, "Employees", "view"):
        mine = my_emp_ids(db, cu)
        if not mine:
            return []
        query = {"emp_id": {"$in": list(mine)}}
    else:
        query = {}
    query["org_id"] = cu.org_id
    if department: query["department"] = department
    if status: query["status"] = status
    if search: query["$or"] = [{"name": like(search)}, {"emp_id": like(search)}]
    return [_out(e) for e in db[collections.EMPLOYEES].find(query)]


@router.post("/", dependencies=[Depends(require_permission("Employees", "create"))])
def create(payload: EmpCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if db[collections.EMPLOYEES].find_one({"_id": payload.emp_id, "org_id": cu.org_id}):
        raise HTTPException(400, "Employee ID already exists")
    doc = payload.dict()
    doc["_id"] = doc["emp_id"]
    doc["org_id"] = cu.org_id
    if doc["joining_date"]: doc["joining_date"] = doc["joining_date"].isoformat()
    if doc["relieving_date"]: doc["relieving_date"] = doc["relieving_date"].isoformat()
    db[collections.EMPLOYEES].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Employees", org_id=cu.org_id, record_id=doc["emp_id"], detail=f"Created employee {doc['name']}")
    return _out(doc)


@router.get("/{emp_id}")
def get_employee(emp_id: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if not has_permission(db, cu, "Employees", "view") and emp_id not in my_emp_ids(db, cu):
        raise HTTPException(404, "Employee not found")
    e = get_or_404(db, collections.EMPLOYEES, emp_id, cu.org_id, "Employee not found")
    return _out(e)


@router.patch("/{emp_id}", dependencies=[Depends(require_permission("Employees", "edit"))])
def update_employee(emp_id: str, payload: EmpUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    e = get_or_404(db, collections.EMPLOYEES, emp_id, cu.org_id, "Employee not found")
    patch = payload.dict(exclude_none=True)
    new_emp_id = patch.pop("emp_id", None)
    if "joining_date" in patch: patch["joining_date"] = patch["joining_date"].isoformat()
    if "relieving_date" in patch: patch["relieving_date"] = patch["relieving_date"].isoformat()

    if new_emp_id and new_emp_id != emp_id:
        if db[collections.EMPLOYEES].find_one({"_id": new_emp_id, "org_id": cu.org_id}):
            raise HTTPException(400, "Employee ID already exists")
        new_doc = {**e, **patch, "_id": new_emp_id, "emp_id": new_emp_id}
        # Every collection that logs an employee by their old ID (permission grants,
        # hourly cost history, leave, timesheets, pending access requests) has to move
        # with the rename, or it silently orphans — one transaction so it's all-or-nothing.
        with client.start_session() as session:
            with session.start_transaction():
                db[collections.EMPLOYEES].insert_one(new_doc, session=session)
                db[collections.EMPLOYEES].delete_one({"_id": emp_id, "org_id": cu.org_id}, session=session)
                for coll in (collections.PAGE_PERMISSIONS, collections.PROJECT_PERMISSIONS,
                             collections.HOURLY_COSTS, collections.LEAVE, collections.TIMESHEETS,
                             collections.ACCESS_REQUESTS):
                    db[coll].update_many(
                        {"emp_id": emp_id, "org_id": cu.org_id}, {"$set": {"emp_id": new_emp_id}}, session=session)
        e = get_or_404(db, collections.EMPLOYEES, new_emp_id, cu.org_id, "Employee not found")
    elif patch:
        db[collections.EMPLOYEES].update_one({"_id": emp_id, "org_id": cu.org_id}, {"$set": patch})
        e = db[collections.EMPLOYEES].find_one({"_id": emp_id, "org_id": cu.org_id})

    log_action(db, user=cu.name, action="UPDATE", module="Employees", org_id=cu.org_id, record_id=e["emp_id"])
    return _out(e)


@router.delete("/{emp_id}", dependencies=[Depends(require_permission("Employees", "delete"))])
def delete_employee(emp_id: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    e = get_or_404(db, collections.EMPLOYEES, emp_id, cu.org_id, "Employee not found")
    db[collections.EMPLOYEES].delete_one({"_id": emp_id, "org_id": cu.org_id})
    log_action(db, user=cu.name, action="DELETE", module="Employees", org_id=cu.org_id, record_id=emp_id)
    return {"message": "Deleted"}
