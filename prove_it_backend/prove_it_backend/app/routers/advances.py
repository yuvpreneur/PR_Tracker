from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import next_id, get_or_404
from app.core.security import get_current_user, require_permission
from app.core.audit import log_action

router = APIRouter()


class AdvanceCreate(BaseModel):
    emp_id: str
    amount: float
    date_issued: date
    monthly_recovery: float


def _out(a: dict, emp: dict = None):
    return {
        "id": a["id"], "emp_id": a["emp_id"], "name": emp["name"] if emp else a["emp_id"],
        "amount": a["amount"], "date_issued": str(a["date_issued"]) if a["date_issued"] else None,
        "monthly_recovery": a["monthly_recovery"], "balance_remaining": a["balance_remaining"],
        "status": a["status"], "created_by": a["created_by"],
    }


@router.get("/", dependencies=[Depends(require_permission("Payroll", "view"))])
def list_advances(
    emp_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Database = Depends(get_db),
    cu=Depends(get_current_user),
):
    employees = {e["emp_id"]: e for e in db[collections.EMPLOYEES].find({"org_id": cu.org_id})}
    query = {"org_id": cu.org_id}
    if emp_id: query["emp_id"] = emp_id
    if status: query["status"] = status
    rows = list(db[collections.ADVANCES].find(query).sort("date_issued", -1))
    return [_out(a, employees.get(a["emp_id"])) for a in rows]


@router.post("/", dependencies=[Depends(require_permission("Payroll", "create"))])
def create(payload: AdvanceCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    aid = next_id(db, collections.ADVANCES)
    doc = {
        "_id": aid, "id": aid, "org_id": cu.org_id, "emp_id": payload.emp_id,
        "amount": payload.amount, "date_issued": payload.date_issued.isoformat(),
        "monthly_recovery": payload.monthly_recovery, "balance_remaining": payload.amount,
        "status": "Active", "created_by": cu.name, "created_at": datetime.utcnow().isoformat(),
    }
    db[collections.ADVANCES].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Payroll", org_id=cu.org_id, record_id=str(aid), detail=f"Issued advance of {doc['amount']} to {doc['emp_id']}")
    return _out(doc)


@router.post("/{advance_id}/close", dependencies=[Depends(require_permission("Payroll", "edit"))])
def close(advance_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    a = get_or_404(db, collections.ADVANCES, advance_id, cu.org_id, "Advance not found")
    if a["status"] == "Closed":
        raise HTTPException(400, "Advance is already closed")
    db[collections.ADVANCES].update_one({"_id": advance_id, "org_id": cu.org_id}, {"$set": {"status": "Closed"}})
    a = db[collections.ADVANCES].find_one({"_id": advance_id, "org_id": cu.org_id})
    log_action(db, user=cu.name, action="UPDATE", module="Payroll", org_id=cu.org_id, record_id=str(advance_id), detail="Advance closed")
    return _out(a)


@router.delete("/{advance_id}", dependencies=[Depends(require_permission("Payroll", "delete"))])
def delete(advance_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    a = get_or_404(db, collections.ADVANCES, advance_id, cu.org_id, "Advance not found")
    # Only while untouched — once any payroll run has recovered against it, deleting
    # would silently lose the fact that money was already paid out against this advance.
    if a["balance_remaining"] != a["amount"]:
        raise HTTPException(400, "Cannot delete an advance that already has recoveries against it — close it instead")
    db[collections.ADVANCES].delete_one({"_id": advance_id, "org_id": cu.org_id})
    log_action(db, user=cu.name, action="DELETE", module="Payroll", org_id=cu.org_id, record_id=str(advance_id))
    return {"message": "Deleted"}
