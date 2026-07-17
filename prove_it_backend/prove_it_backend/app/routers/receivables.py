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
    query = {}
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
    recs = list(db[collections.RECEIVABLES].find())
    return {
        "total_billed": sum(r["invoice_amount"] for r in recs),
        "total_received": sum(r["received_amount"] for r in recs),
        "outstanding": sum(r["invoice_amount"] - r["received_amount"] for r in recs),
        "overdue": sum(r["invoice_amount"] - r["received_amount"] for r in recs if r["status"] == "Overdue"),
    }


@router.post("/", dependencies=[Depends(require_permission("Receivables", "create"))])
def create(payload: RecvCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if db[collections.RECEIVABLES].find_one({"invoice_no": payload.invoice_no}):
        raise HTTPException(400, "Invoice number already exists")
    rid = next_id(db, collections.RECEIVABLES)
    doc = {"_id": rid, "id": rid, **payload.dict()}
    doc["invoice_date"] = doc["invoice_date"].isoformat()
    doc["due_date"] = doc["due_date"].isoformat()
    db[collections.RECEIVABLES].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Receivables", record_id=doc["invoice_no"], detail=f"Invoice ₹{doc['invoice_amount']} for {doc['client']}")
    return _out(doc)


@router.patch("/{recv_id}", dependencies=[Depends(require_permission("Receivables", "edit"))])
def update(recv_id: int, payload: RecvUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    r = db[collections.RECEIVABLES].find_one({"_id": recv_id})
    if not r: raise HTTPException(404, "Not found")
    patch = payload.dict(exclude_none=True)
    if "due_date" in patch: patch["due_date"] = patch["due_date"].isoformat()
    if patch:
        db[collections.RECEIVABLES].update_one({"_id": recv_id}, {"$set": patch})
        r = db[collections.RECEIVABLES].find_one({"_id": recv_id})
    log_action(db, user=cu.name, action="UPDATE", module="Receivables", record_id=r["invoice_no"])
    return _out(r)


@router.delete("/{recv_id}", dependencies=[Depends(require_permission("Receivables", "delete"))])
def delete(recv_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    r = db[collections.RECEIVABLES].find_one({"_id": recv_id})
    if not r: raise HTTPException(404, "Not found")
    db[collections.RECEIVABLES].delete_one({"_id": recv_id})
    log_action(db, user=cu.name, action="DELETE", module="Receivables", record_id=str(recv_id))
    return {"message": "Deleted"}
