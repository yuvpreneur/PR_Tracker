import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from pymongo.database import Database
from pydantic import BaseModel
from typing import Optional
from datetime import date
from bson import Binary
from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import next_id, like
from app.core.security import get_current_user
from app.core.audit import log_action
from app.core.notifications import notify
from app.core.permissions import has_permission, is_own_record

router = APIRouter()

CATEGORIES = ["Travel", "Software", "Vendor", "Material", "Misc"]

# Attachments are stored as binary blobs in their own collection rather than on local
# disk — this API runs on Render, whose local filesystem doesn't survive a redeploy,
# so Mongo (already the durable store for everything else here) is the only storage
# that will actually still have the file next week.
MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_ATTACHMENT_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_ATTACHMENT_CONTENT_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}

# Two-stage approval, hardcoded rather than matrix-driven (same reasoning as Access
# Requests' require_role() in access_control.py): Manager confirms business purpose first
# (Pending -> Pending Finance), then Finance validates policy and posts payment
# (Pending Finance -> Approved). Neither stage can be skipped or done out of order, and
# Manager/Finance can't stand in for each other here even though the Roles & Permissions
# matrix still lists an "approve" flag for both on this module.
STATUS_PENDING = "Pending"
STATUS_PENDING_FINANCE = "Pending Finance"
STATUS_APPROVED = "Approved"
STATUS_REJECTED = "Rejected"


class ExpCreate(BaseModel):
    project_id: str
    project_code_id: Optional[str] = None
    billing_code_id: Optional[str] = None
    category: str
    expense_date: date
    amount: float
    vendor: Optional[str] = None
    description: Optional[str] = None
    submitted_by: str
    receipt_url: Optional[str] = None


class ExpUpdate(BaseModel):
    category: Optional[str] = None
    expense_date: Optional[date] = None
    amount: Optional[float] = None
    vendor: Optional[str] = None
    description: Optional[str] = None
    receipt_url: Optional[str] = None


class RejectPayload(BaseModel):
    reason: str


def _out(e: dict):
    return {
        "id": e["id"], "project_id": e["project_id"], "project_code_id": e["project_code_id"],
        "billing_code_id": e["billing_code_id"], "category": e["category"],
        "expense_date": str(e["expense_date"]) if e["expense_date"] else None,
        "amount": e["amount"], "vendor": e["vendor"], "description": e.get("description"), "status": e["status"],
        "submitted_by": e["submitted_by"],
        "manager_approved_by": e.get("manager_approved_by"), "approved_by": e["approved_by"],
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
    # Expenses is a self-service module again (see SELF_SERVICE_MODULES in permissions.py)
    # — a role without blanket Expenses:view (Employee, by default) gets a "my own
    # records" scoped view instead of being blocked outright, same as Leave.
    # Employee is always scoped here, full stop — unlike Finance User (whose blanket
    # Expenses:view is a deliberate matrix grant for the approval workflow), Employee's
    # "view" can be forced True by a per-employee Access Control -> Page Access grant
    # (meant only to unlock the nav page, not blanket visibility — see
    # get_effective_permissions() in permissions.py), which would otherwise leak every
    # employee's expenses to any Employee who's been granted that page.
    if cu.role == "Employee" or not (cu.role == "Admin" or has_permission(db, cu, "Expenses", "view")):
        if submitted_by and submitted_by != cu.name:
            raise HTTPException(403, "You may only view your own records")
        submitted_by = cu.name
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
    approved = [e for e in expenses if e["status"] == STATUS_APPROVED]
    return {
        "total_amount": sum(e["amount"] for e in expenses),
        "approved_amount": sum(e["amount"] for e in approved),
        "pending_count": sum(1 for e in expenses if e["status"] in (STATUS_PENDING, STATUS_PENDING_FINANCE)),
        "by_category": {
            cat: sum(e["amount"] for e in approved if e["category"] == cat) for cat in CATEGORIES
        },
    }


@router.post("/")
def create(payload: ExpCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if payload.category not in CATEGORIES:
        raise HTTPException(400, f"category must be one of {CATEGORIES}")
    if not has_permission(db, cu, "Expenses", "create") and not is_own_record(cu, payload.submitted_by):
        raise HTTPException(403, "You may only submit expenses for yourself")
    xid = next_id(db, collections.EXPENSES)
    doc = {
        "_id": xid, "id": xid, **payload.dict(),
        "status": STATUS_PENDING, "manager_approved_by": None, "approved_by": None, "reject_reason": None,
    }
    doc["expense_date"] = doc["expense_date"].isoformat()
    db[collections.EXPENSES].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Expenses", record_id=str(xid), detail=f"₹{doc['amount']} {doc['category']} expense")
    return _out(doc)


@router.post("/attachments")
def upload_attachment(file: UploadFile = File(...), db: Database = Depends(get_db), cu=Depends(get_current_user)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_ATTACHMENT_EXTENSIONS or file.content_type not in ALLOWED_ATTACHMENT_CONTENT_TYPES:
        raise HTTPException(400, "Only PDF, JPG, PNG or WEBP receipts are allowed")
    data = file.file.read()
    if len(data) > MAX_ATTACHMENT_SIZE:
        raise HTTPException(400, "Attachment must be smaller than 10MB")
    aid = uuid.uuid4().hex
    db[collections.EXPENSE_ATTACHMENTS].insert_one({
        "_id": aid, "filename": file.filename, "content_type": file.content_type,
        "data": Binary(data), "uploaded_by": cu.name,
    })
    return {"receipt_url": f"/api/expenses/attachments/{aid}", "filename": file.filename}


@router.get("/attachments/{attachment_id}")
def get_attachment(attachment_id: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    doc = db[collections.EXPENSE_ATTACHMENTS].find_one({"_id": attachment_id})
    if not doc:
        raise HTTPException(404, "Attachment not found")
    return Response(
        content=bytes(doc["data"]),
        media_type=doc.get("content_type") or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{doc["filename"]}"'},
    )


@router.patch("/{exp_id}")
def update(exp_id: int, payload: ExpUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    e = db[collections.EXPENSES].find_one({"_id": exp_id})
    if not e: raise HTTPException(404, "Not found")
    can_edit_any = has_permission(db, cu, "Expenses", "edit")
    if e["status"] == STATUS_APPROVED and not can_edit_any:
        raise HTTPException(400, "Cannot edit approved expense")
    if not can_edit_any and not (is_own_record(cu, e["submitted_by"]) and e["status"] == STATUS_PENDING):
        raise HTTPException(403, "You may only edit your own pending expenses")
    patch = payload.dict(exclude_none=True)
    if "expense_date" in patch: patch["expense_date"] = patch["expense_date"].isoformat()
    # An edit reopens the whole chain — the changed figures haven't been seen by either
    # approver yet, so this goes back to square one rather than resuming mid-chain.
    patch["status"] = STATUS_PENDING
    patch["manager_approved_by"] = None
    patch["reject_reason"] = None
    db[collections.EXPENSES].update_one({"_id": exp_id}, {"$set": patch})
    e = db[collections.EXPENSES].find_one({"_id": exp_id})
    log_action(db, user=cu.name, action="UPDATE", module="Expenses", record_id=str(exp_id))
    return _out(e)


@router.post("/{exp_id}/approve")
def approve(exp_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    e = db[collections.EXPENSES].find_one({"_id": exp_id})
    if not e: raise HTTPException(404, "Not found")
    if is_own_record(cu, e["submitted_by"]):
        raise HTTPException(403, "You cannot approve your own expense")

    if e["status"] == STATUS_PENDING:
        if cu.role not in ("Admin", "Manager"):
            raise HTTPException(403, "Only a Manager can confirm business purpose for this expense")
        update = {"status": STATUS_PENDING_FINANCE, "manager_approved_by": cu.name}
        detail = f"Manager confirmed business purpose for ₹{e['amount']}"
        action = "MANAGER_APPROVE"
    elif e["status"] == STATUS_PENDING_FINANCE:
        if cu.role not in ("Admin", "Finance User"):
            raise HTTPException(403, "Only Finance can validate policy and post payment for this expense")
        update = {"status": STATUS_APPROVED, "approved_by": cu.name}
        detail = f"Finance validated policy and posted payment for ₹{e['amount']}"
        action = "APPROVE"
    else:
        raise HTTPException(400, f"Cannot approve an expense with status '{e['status']}'")

    db[collections.EXPENSES].update_one({"_id": exp_id}, {"$set": update})
    e = db[collections.EXPENSES].find_one({"_id": exp_id})
    log_action(db, user=cu.name, action=action, module="Expenses", record_id=str(exp_id), detail=detail)
    # Only the final decision (Finance's APPROVE) is notification-worthy — the
    # intermediate MANAGER_APPROVE just moves the request to Finance's queue, it hasn't
    # been decided yet.
    if action == "APPROVE":
        notify(
            db, recipient=e["submitted_by"], module="Expenses", record_id=exp_id, status="Approved",
            message=f"Your {e['category']} expense (₹{e['amount']}) was approved.",
        )
    return _out(e)


@router.post("/{exp_id}/reject")
def reject(exp_id: int, payload: RejectPayload, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    e = db[collections.EXPENSES].find_one({"_id": exp_id})
    if not e: raise HTTPException(404, "Not found")
    if is_own_record(cu, e["submitted_by"]):
        raise HTTPException(403, "You cannot reject your own expense")

    if e["status"] == STATUS_PENDING:
        if cu.role not in ("Admin", "Manager"):
            raise HTTPException(403, "Only a Manager can reject this expense at this stage")
    elif e["status"] == STATUS_PENDING_FINANCE:
        if cu.role not in ("Admin", "Finance User"):
            raise HTTPException(403, "Only Finance can reject this expense at this stage")
    else:
        raise HTTPException(400, f"Cannot reject an expense with status '{e['status']}'")

    db[collections.EXPENSES].update_one({"_id": exp_id}, {"$set": {"status": STATUS_REJECTED, "approved_by": None, "reject_reason": payload.reason}})
    e = db[collections.EXPENSES].find_one({"_id": exp_id})
    log_action(db, user=cu.name, action="REJECT", module="Expenses", record_id=str(exp_id), detail=payload.reason)
    notify(
        db, recipient=e["submitted_by"], module="Expenses", record_id=exp_id, status="Rejected",
        message=f"Your {e['category']} expense (₹{e['amount']}) was rejected. Reason: {payload.reason}",
    )
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
    receipt_url = e.get("receipt_url") or ""
    if receipt_url.startswith("/api/expenses/attachments/"):
        db[collections.EXPENSE_ATTACHMENTS].delete_one({"_id": receipt_url.rsplit("/", 1)[-1]})
    log_action(db, user=cu.name, action="DELETE", module="Expenses", record_id=str(exp_id))
    return {"message": "Deleted"}
