from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import next_id, like, get_or_404
from app.core.security import get_current_user, require_permission
from app.core.audit import log_action

router = APIRouter()


class CostCreate(BaseModel):
    emp_id: str
    hourly_cost: float
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None


class CostUpdate(BaseModel):
    hourly_cost: Optional[float] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None


def _out(c: dict, emp: dict = None):
    return {
        "id": c["id"],
        "emp_id": c["emp_id"],
        "name": emp["name"] if emp else c["emp_id"],
        "department": emp["department"] if emp else "—",
        "hourly_cost": c["hourly_cost"],
        "effective_from": str(c["effective_from"]) if c["effective_from"] else None,
        "effective_to": str(c["effective_to"]) if c["effective_to"] else None,
    }


@router.get("/")
def list_costs(
    emp_id: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Database = Depends(get_db),
    cu=Depends(get_current_user),
):
    # Emulate the SQL outerjoin against employees in Python: fetch employees
    # once, index by emp_id, and look each cost row's employee up locally.
    employees = {e["emp_id"]: e for e in db[collections.EMPLOYEES].find({"org_id": cu.org_id})}

    query = {"org_id": cu.org_id}
    if emp_id:
        query["emp_id"] = emp_id
    costs = list(db[collections.HOURLY_COSTS].find(query).sort([("emp_id", 1), ("effective_from", 1)]))

    rows = [(c, employees.get(c["emp_id"])) for c in costs]
    if department:
        rows = [(c, emp) for c, emp in rows if emp and emp["department"] == department]
    if search:
        term = search.lower()
        rows = [
            (c, emp) for c, emp in rows
            if term in c["emp_id"].lower()
            or (emp and term in emp["name"].lower())
            or (emp and term in emp["department"].lower())
        ]
    return [_out(c, emp) for c, emp in rows]


@router.post("/", dependencies=[Depends(require_permission("Hourly Costs", "create"))])
def create(payload: CostCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    cid = next_id(db, collections.HOURLY_COSTS)
    doc = {"_id": cid, "id": cid, "org_id": cu.org_id, **payload.dict()}
    if doc["effective_from"]: doc["effective_from"] = doc["effective_from"].isoformat()
    if doc["effective_to"]: doc["effective_to"] = doc["effective_to"].isoformat()
    db[collections.HOURLY_COSTS].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Hourly Costs", org_id=cu.org_id, record_id=str(cid), detail=f"Set ₹{doc['hourly_cost']}/hr for {doc['emp_id']}")
    return _out(doc)


@router.patch("/{cost_id}", dependencies=[Depends(require_permission("Hourly Costs", "edit"))])
def update(cost_id: int, payload: CostUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    c = get_or_404(db, collections.HOURLY_COSTS, cost_id, cu.org_id, "Record not found")
    patch = payload.dict(exclude_none=True)
    if "effective_from" in patch: patch["effective_from"] = patch["effective_from"].isoformat()
    if "effective_to" in patch: patch["effective_to"] = patch["effective_to"].isoformat()
    db[collections.HOURLY_COSTS].update_one({"_id": cost_id, "org_id": cu.org_id}, {"$set": patch})
    c = db[collections.HOURLY_COSTS].find_one({"_id": cost_id, "org_id": cu.org_id})
    log_action(db, user=cu.name, action="UPDATE", module="Hourly Costs", org_id=cu.org_id, record_id=str(cost_id))
    return _out(c)


@router.delete("/{cost_id}", dependencies=[Depends(require_permission("Hourly Costs", "delete"))])
def delete(cost_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    c = get_or_404(db, collections.HOURLY_COSTS, cost_id, cu.org_id, "Record not found")
    db[collections.HOURLY_COSTS].delete_one({"_id": cost_id, "org_id": cu.org_id})
    return {"message": "Deleted"}
