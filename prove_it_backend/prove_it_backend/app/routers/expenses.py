from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import next_id, like
from app.core.security import get_current_user, require_permission
from app.core.audit import log_action
from app.core.permissions import has_permission, is_own_record

router = APIRouter()

CATEGORIES = ["Travel", "Software", "Vendor", "Material", "Misc"]


class ExpCreate(BaseModel):
    project_id: str
    project_code_id: Optional[str] = None
    billing_code_id: Optional[str] = None
    category: str
    expense_date: date
    amount: float
    vendor: Optional[str] = None
    submitted_by: str
    receipt_url: Optional[str] = None


class ExpUpdate(BaseModel):
    category: Optional[str] = None
    expense_date: Optional[date] = None
    amount: Optional[float] = None
    vendor: Optional[str] = None
    receipt_url: Optional[str] = None


class RejectPayload(BaseModel):
    reason: str


def _out(e: dict):
    return {
        "id": e["id"], "project_id": e["project_id"], "project_code_id": e["project_code_id"],
        "billing_code_id": e["billing_code_id"], "category": e["category"],
        "expense_date": str(e["expense_date"]) if e["expense_date"] else None,
        "amount": e["amount"], "vendor": e["vendor"], "status": e["status"],
        "submitted_by": e["submitted_by"], "approved_by": e["approved_by"],
        "reject_reason": e["reject_reason"], "receipt_url": e["receipt_url"],
    }


@router.get("/")
def list_expenses(
    project_id:   Optional[str]  = Query(None),
    category:     Optional[str]  = Query(None),
    status:       Optional[str]  = Query(None),
    submitted_by: Optional[str]  = Query(None),
    date_from:    Optional[date] = Query(None),
    date_to:      Optional[date] = Query(None),
    search:       Optional[str]  = Query(None),
    db: Database = Depends(get_db), cu=Depends(get_current_user),
):
    # Expenses is no longer a self-service module (see SELF_SERVICE_MODULES in
    # permissions.py) — a role without blanket Expenses:view (Employee, by default)
    # gets no access at all, not a "my own records" scoped view.
    if not (cu.role == "Admin" or has_permission(db, cu, "Expenses", "view")):
        raise HTTPException(403, "You do not have permission to view expenses")
    query = {}
    if project_id:   query["project_id"] = project_id
    if category:     query["category"] = category
    if status:       query["status"] = status
    if submitted_by: query["submitted_by"] = submitted_by
    if date_from or date_to:
        date_filter = {}
        if date_from: date_filter["$gte"] = date_from.isoformat()
        if date_to:   date_filter["$lte"] = date_to.isoformat()
        query["expense_date"] = date_filter
    if search:
        query["$or"] = [
            {"project_id": like(search)},
            {"category": like(search)},
            {"vendor": like(search)},
            {"submitted_by": like(search)},
        ]
    rows = db[collections.EXPENSES].find(query).sort("expense_date", -1)
    return [_out(e) for e in rows]


@router.get("/summary")
def summary(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    expenses = list(db[collections.EXPENSES].find())
    approved = [e for e in expenses if e["status"] == "Approved"]
    return {
        "total_amount": sum(e["amount"] for e in expenses),
        "approved_amount": sum(e["amount"] for e in approved),
        "pending_count": sum(1 for e in expenses if e["status"] == "Pending"),
        "by_category": {
            cat: sum(e["amount"] for e in approved if e["category"] == cat) for cat in CATEGORIES
        },
    }


@router.post("/")
def create(payload: ExpCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if payload.category not in CATEGORIES:
        raise HTTPException(400, f"category must be one of {CATEGORIES}")
    if not has_permission(db, cu, "Expenses", "create"):
        raise HTTPException(403, "You do not have permission to submit expenses")
    xid = next_id(db, collections.EXPENSES)
    doc = {
        "_id": xid, "id": xid, **payload.dict(),
        "status": "Pending", "approved_by": None, "reject_reason": None,
    }
    doc["expense_date"] = doc["expense_date"].isoformat()
    db[collections.EXPENSES].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Expenses", record_id=str(xid), detail=f"₹{doc['amount']} {doc['category']} expense")
    return _out(doc)


@router.patch("/{exp_id}")
def update(exp_id: int, payload: ExpUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    e = db[collections.EXPENSES].find_one({"_id": exp_id})
    if not e: raise HTTPException(404, "Not found")
    can_edit_any = has_permission(db, cu, "Expenses", "edit")
    if e["status"] == "Approved" and not can_edit_any:
        raise HTTPException(400, "Cannot edit approved expense")
    if not can_edit_any:
        raise HTTPException(403, "You do not have permission to edit expenses")
    patch = payload.dict(exclude_none=True)
    if "expense_date" in patch: patch["expense_date"] = patch["expense_date"].isoformat()
    patch["status"] = "Pending"
    patch["reject_reason"] = None
    db[collections.EXPENSES].update_one({"_id": exp_id}, {"$set": patch})
    e = db[collections.EXPENSES].find_one({"_id": exp_id})
    log_action(db, user=cu.name, action="UPDATE", module="Expenses", record_id=str(exp_id))
    return _out(e)


@router.post("/{exp_id}/approve", dependencies=[Depends(require_permission("Expenses", "approve"))])
def approve(exp_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    e = db[collections.EXPENSES].find_one({"_id": exp_id})
    if not e: raise HTTPException(404, "Not found")
    if is_own_record(cu, e["submitted_by"]):
        raise HTTPException(403, "You cannot approve your own expense")
    db[collections.EXPENSES].update_one({"_id": exp_id}, {"$set": {"status": "Approved", "approved_by": cu.name}})
    e = db[collections.EXPENSES].find_one({"_id": exp_id})
    log_action(db, user=cu.name, action="APPROVE", module="Expenses", record_id=str(exp_id), detail=f"Approved ₹{e['amount']}")
    return _out(e)


@router.post("/{exp_id}/reject", dependencies=[Depends(require_permission("Expenses", "approve"))])
def reject(exp_id: int, payload: RejectPayload, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    e = db[collections.EXPENSES].find_one({"_id": exp_id})
    if not e: raise HTTPException(404, "Not found")
    if is_own_record(cu, e["submitted_by"]):
        raise HTTPException(403, "You cannot reject your own expense")
    db[collections.EXPENSES].update_one({"_id": exp_id}, {"$set": {"status": "Rejected", "approved_by": None, "reject_reason": payload.reason}})
    e = db[collections.EXPENSES].find_one({"_id": exp_id})
    log_action(db, user=cu.name, action="REJECT", module="Expenses", record_id=str(exp_id), detail=payload.reason)
    return _out(e)


@router.delete("/{exp_id}")
def delete(exp_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    e = db[collections.EXPENSES].find_one({"_id": exp_id})
    if not e: raise HTTPException(404, "Not found")
    # No self-service delete, even for your own pending entry — once submitted, only
    # someone with Expenses:delete (Admin by default) can remove it.
    if not has_permission(db, cu, "Expenses", "delete"):
        raise HTTPException(403, "You do not have permission to delete expenses")
    db[collections.EXPENSES].delete_one({"_id": exp_id})
    log_action(db, user=cu.name, action="DELETE", module="Expenses", record_id=str(exp_id))
    return {"message": "Deleted"}
