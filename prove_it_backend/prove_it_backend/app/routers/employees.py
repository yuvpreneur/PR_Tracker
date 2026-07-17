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

router = APIRouter()


class EmpCreate(BaseModel):
    emp_id: str
    name: str
    department: Optional[str] = None
    designation: Optional[str] = None
    email: str
    phone: Optional[str] = None
    joining_date: Optional[date] = None
    role: str = "Employee"
    billable: bool = True
    status: str = "Active"


class EmpUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    joining_date: Optional[date] = None
    role: Optional[str] = None
    billable: Optional[bool] = None
    status: Optional[str] = None


def _out(e: dict):
    return {
        "emp_id": e["emp_id"], "name": e["name"], "department": e["department"],
        "designation": e["designation"], "email": e["email"], "phone": e["phone"],
        "joining_date": str(e["joining_date"]) if e["joining_date"] else None,
        "role": e["role"], "billable": e["billable"], "status": e["status"],
    }


@router.get("/", dependencies=[Depends(require_permission("Employees", "view"))])
def list_employees(
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Database = Depends(get_db),
    cu=Depends(get_current_user),
):
    query = {}
    if department: query["department"] = department
    if status: query["status"] = status
    if search: query["$or"] = [{"name": like(search)}, {"emp_id": like(search)}]
    return [_out(e) for e in db[collections.EMPLOYEES].find(query)]


@router.post("/", dependencies=[Depends(require_permission("Employees", "create"))])
def create(payload: EmpCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if db[collections.EMPLOYEES].find_one({"_id": payload.emp_id}):
        raise HTTPException(400, "Employee ID already exists")
    doc = payload.dict()
    doc["_id"] = doc["emp_id"]
    if doc["joining_date"]: doc["joining_date"] = doc["joining_date"].isoformat()
    db[collections.EMPLOYEES].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Employees", record_id=doc["emp_id"], detail=f"Created employee {doc['name']}")
    return _out(doc)


@router.get("/{emp_id}", dependencies=[Depends(require_permission("Employees", "view"))])
def get_employee(emp_id: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    e = db[collections.EMPLOYEES].find_one({"_id": emp_id})
    if not e: raise HTTPException(404, "Employee not found")
    return _out(e)


@router.patch("/{emp_id}", dependencies=[Depends(require_permission("Employees", "edit"))])
def update_employee(emp_id: str, payload: EmpUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    e = db[collections.EMPLOYEES].find_one({"_id": emp_id})
    if not e: raise HTTPException(404, "Employee not found")
    patch = payload.dict(exclude_none=True)
    if "joining_date" in patch: patch["joining_date"] = patch["joining_date"].isoformat()
    if patch:
        db[collections.EMPLOYEES].update_one({"_id": emp_id}, {"$set": patch})
        e = db[collections.EMPLOYEES].find_one({"_id": emp_id})
    log_action(db, user=cu.name, action="UPDATE", module="Employees", record_id=e["emp_id"])
    return _out(e)


@router.delete("/{emp_id}", dependencies=[Depends(require_permission("Employees", "delete"))])
def delete_employee(emp_id: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    e = db[collections.EMPLOYEES].find_one({"_id": emp_id})
    if not e: raise HTTPException(404, "Employee not found")
    db[collections.EMPLOYEES].delete_one({"_id": emp_id})
    log_action(db, user=cu.name, action="DELETE", module="Employees", record_id=emp_id)
    return {"message": "Deleted"}
