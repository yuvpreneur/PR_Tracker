from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import next_id, get_or_404
from app.core.security import get_current_user, require_permission
from app.core.audit import log_action

router = APIRouter()

COMPONENT_FIELDS = [
    "basic", "hra", "cca", "food_allowance", "transport_allowance", "medical_allowance",
    "monthly_bonus", "performance_incentive", "arrears", "lta",
]


class StructureCreate(BaseModel):
    emp_id: str
    basic: float = 0
    hra: float = 0
    cca: float = 0
    food_allowance: float = 0
    transport_allowance: float = 0
    medical_allowance: float = 0
    monthly_bonus: float = 0
    performance_incentive: float = 0
    arrears: float = 0
    lta: float = 0
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None


class StructureUpdate(BaseModel):
    basic: Optional[float] = None
    hra: Optional[float] = None
    cca: Optional[float] = None
    food_allowance: Optional[float] = None
    transport_allowance: Optional[float] = None
    medical_allowance: Optional[float] = None
    monthly_bonus: Optional[float] = None
    performance_incentive: Optional[float] = None
    arrears: Optional[float] = None
    lta: Optional[float] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None


def _out(s: dict, emp: dict = None):
    return {
        "id": s["id"],
        "emp_id": s["emp_id"],
        "name": emp["name"] if emp else s["emp_id"],
        "department": emp["department"] if emp else "—",
        **{f: s.get(f, 0) for f in COMPONENT_FIELDS},
        "gross_salary": round(sum(s.get(f, 0) for f in COMPONENT_FIELDS), 2),
        "effective_from": str(s["effective_from"]) if s["effective_from"] else None,
        "effective_to": str(s["effective_to"]) if s["effective_to"] else None,
    }


@router.get("/", dependencies=[Depends(require_permission("Payroll", "view"))])
def list_structures(
    emp_id: Optional[str] = Query(None),
    db: Database = Depends(get_db),
    cu=Depends(get_current_user),
):
    employees = {e["emp_id"]: e for e in db[collections.EMPLOYEES].find({"org_id": cu.org_id})}
    query = {"org_id": cu.org_id}
    if emp_id:
        query["emp_id"] = emp_id
    rows = list(db[collections.SALARY_STRUCTURES].find(query).sort([("emp_id", 1), ("effective_from", 1)]))
    return [_out(s, employees.get(s["emp_id"])) for s in rows]


@router.post("/", dependencies=[Depends(require_permission("Payroll", "create"))])
def create(payload: StructureCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    sid = next_id(db, collections.SALARY_STRUCTURES)
    doc = {"_id": sid, "id": sid, "org_id": cu.org_id, **payload.dict()}
    if doc["effective_from"]: doc["effective_from"] = doc["effective_from"].isoformat()
    if doc["effective_to"]: doc["effective_to"] = doc["effective_to"].isoformat()
    db[collections.SALARY_STRUCTURES].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Payroll", org_id=cu.org_id, record_id=str(sid), detail=f"Set salary structure for {doc['emp_id']}")
    return _out(doc)


@router.patch("/{structure_id}", dependencies=[Depends(require_permission("Payroll", "edit"))])
def update(structure_id: int, payload: StructureUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    s = get_or_404(db, collections.SALARY_STRUCTURES, structure_id, cu.org_id, "Record not found")
    patch = payload.dict(exclude_none=True)
    if "effective_from" in patch: patch["effective_from"] = patch["effective_from"].isoformat()
    if "effective_to" in patch: patch["effective_to"] = patch["effective_to"].isoformat()
    db[collections.SALARY_STRUCTURES].update_one({"_id": structure_id, "org_id": cu.org_id}, {"$set": patch})
    s = db[collections.SALARY_STRUCTURES].find_one({"_id": structure_id, "org_id": cu.org_id})
    log_action(db, user=cu.name, action="UPDATE", module="Payroll", org_id=cu.org_id, record_id=str(structure_id))
    return _out(s)


@router.delete("/{structure_id}", dependencies=[Depends(require_permission("Payroll", "delete"))])
def delete(structure_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    s = get_or_404(db, collections.SALARY_STRUCTURES, structure_id, cu.org_id, "Record not found")
    db[collections.SALARY_STRUCTURES].delete_one({"_id": structure_id, "org_id": cu.org_id})
    log_action(db, user=cu.name, action="DELETE", module="Payroll", org_id=cu.org_id, record_id=str(structure_id))
    return {"message": "Deleted"}


def current_structure(db: Database, org_id, emp_id: str, as_of: str) -> Optional[dict]:
    """The salary_structures row effective on `as_of` (ISO date string) for one employee —
    most-recent effective_from at or before `as_of`, still open (no effective_to) or not
    yet ended. Mirrors hourly_costs.py's implicit "most recent applicable rate" convention,
    made explicit here since payroll.py needs to resolve this once per employee per run."""
    rows = db[collections.SALARY_STRUCTURES].find({
        "org_id": org_id, "emp_id": emp_id, "effective_from": {"$lte": as_of},
    }).sort("effective_from", -1)
    for r in rows:
        if not r.get("effective_to") or r["effective_to"] >= as_of:
            return r
    return None
