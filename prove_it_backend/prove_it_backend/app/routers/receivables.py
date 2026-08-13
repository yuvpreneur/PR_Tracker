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


class RecvCreate(BaseModel):
    project_id: str
    billing_code_id: Optional[str] = None
    client: str
    invoice_no: str
    invoice_date: date
    invoice_amount: float
    received_amount: float = 0
    due_date: date
    status: str = "Pending"


class RecvUpdate(BaseModel):
    project_id: Optional[str] = None
    billing_code_id: Optional[str] = None
    client: Optional[str] = None
    invoice_no: Optional[str] = None
    invoice_date: Optional[date] = None
    invoice_amount: Optional[float] = None
    received_amount: Optional[float] = None
    due_date: Optional[date] = None
    status: Optional[str] = None


def _out(r: dict):
    return {
        "id": r["id"], "project_id": r["project_id"], "billing_code_id": r["billing_code_id"],
        "client": r["client"], "invoice_no": r["invoice_no"],
        "invoice_date": str(r["invoice_date"]) if r["invoice_date"] else None,
        "invoice_amount": r["invoice_amount"], "received_amount": r["received_amount"],
        "balance": r["invoice_amount"] - r["received_amount"],
        "due_date": str(r["due_date"]) if r["due_date"] else None,
        "status": r["status"],
    }


@router.get("/")
def list_receivables(
    project_id: Optional[str]  = Query(None),
    client:     Optional[str]  = Query(None),
    status:     Optional[str]  = Query(None),
    date_from:  Optional[date] = Query(None),
    date_to:    Optional[date] = Query(None),
    search:     Optional[str]  = Query(None),
    db: Database = Depends(get_db), cu=Depends(get_current_user),
):
    query = {"org_id": cu.org_id}
    if project_id: query["project_id"] = project_id
    if client:     query["client"] = like(client)
    if status:     query["status"] = status
    if date_from or date_to:
        date_filter = {}
        if date_from: date_filter["$gte"] = date_from.isoformat()
        if date_to:   date_filter["$lte"] = date_to.isoformat()
        query["invoice_date"] = date_filter
    if search:
        query["$or"] = [
            {"client": like(search)},
            {"invoice_no": like(search)},
            {"project_id": like(search)},
        ]
    rows = db[collections.RECEIVABLES].find(query).sort("due_date", 1)
    return [_out(r) for r in rows]


@router.get("/summary")
def summary(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    recs = list(db[collections.RECEIVABLES].find({"org_id": cu.org_id}))
    return {
        "total_billed": sum(r["invoice_amount"] for r in recs),
        "total_received": sum(r["received_amount"] for r in recs),
        "outstanding": sum(r["invoice_amount"] - r["received_amount"] for r in recs),
        "overdue": sum(r["invoice_amount"] - r["received_amount"] for r in recs if r["status"] == "Overdue"),
    }


@router.post("/", dependencies=[Depends(require_permission("Receivables", "create"))])
def create(payload: RecvCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if db[collections.RECEIVABLES].find_one({"invoice_no": payload.invoice_no, "org_id": cu.org_id}):
        raise HTTPException(400, "Invoice number already exists")
    if payload.billing_code_id:
        bcode = get_or_404(db, collections.BILLING_CODES, payload.billing_code_id, cu.org_id, "Billing code not found")
        if bcode["project_id"] != payload.project_id:
            raise HTTPException(400, "That billing code does not belong to the selected project")
    rid = next_id(db, collections.RECEIVABLES)
    doc = {"_id": rid, "id": rid, "org_id": cu.org_id, **payload.dict()}
    doc["invoice_date"] = doc["invoice_date"].isoformat()
    doc["due_date"] = doc["due_date"].isoformat()
    db[collections.RECEIVABLES].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Receivables", org_id=cu.org_id, record_id=doc["invoice_no"], detail=f"Invoice ₹{doc['invoice_amount']} for {doc['client']}")
    return _out(doc)


@router.patch("/{recv_id}", dependencies=[Depends(require_permission("Receivables", "edit"))])
def update(recv_id: int, payload: RecvUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    r = get_or_404(db, collections.RECEIVABLES, recv_id, cu.org_id, "Not found")
    patch = payload.dict(exclude_none=True)

    if "invoice_no" in patch and patch["invoice_no"] != r["invoice_no"]:
        if db[collections.RECEIVABLES].find_one({"invoice_no": patch["invoice_no"], "org_id": cu.org_id}):
            raise HTTPException(400, "Invoice number already exists")

    # Only re-check project/billing-code consistency when the combination is actually
    # changing — the frontend resends every field on every save (not just the ones the
    # user touched), so checking "is project_id in patch" would fire on every single
    # save. And a billing code's own project can drift after this receivable was
    # created (e.g. its Project Code got reassigned later) — that pre-existing drift
    # shouldn't retroactively block edits that don't touch either field.
    effective_project_id = patch.get("project_id", r["project_id"])
    effective_billing_code_id = patch.get("billing_code_id", r["billing_code_id"])
    if (effective_project_id, effective_billing_code_id) != (r["project_id"], r["billing_code_id"]):
        if effective_billing_code_id:
            bcode = get_or_404(db, collections.BILLING_CODES, effective_billing_code_id, cu.org_id, "Billing code not found")
            if bcode["project_id"] != effective_project_id:
                raise HTTPException(400, "That billing code does not belong to the selected project")

    if "invoice_date" in patch: patch["invoice_date"] = patch["invoice_date"].isoformat()
    if "due_date" in patch: patch["due_date"] = patch["due_date"].isoformat()
    if patch:
        db[collections.RECEIVABLES].update_one({"_id": recv_id, "org_id": cu.org_id}, {"$set": patch})
        r = db[collections.RECEIVABLES].find_one({"_id": recv_id, "org_id": cu.org_id})
    log_action(db, user=cu.name, action="UPDATE", module="Receivables", org_id=cu.org_id, record_id=r["invoice_no"])
    return _out(r)


@router.delete("/{recv_id}", dependencies=[Depends(require_permission("Receivables", "delete"))])
def delete(recv_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    r = get_or_404(db, collections.RECEIVABLES, recv_id, cu.org_id, "Not found")
    db[collections.RECEIVABLES].delete_one({"_id": recv_id, "org_id": cu.org_id})
    log_action(db, user=cu.name, action="DELETE", module="Receivables", org_id=cu.org_id, record_id=str(recv_id))
    return {"message": "Deleted"}
