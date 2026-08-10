from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, timedelta

from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import next_id, like
from app.core.security import get_current_user, require_permission
from app.core.audit import log_action

router = APIRouter()

TERM_DAYS = {
    "due_on_receipt": 0, "net15": 15, "net30": 30, "net45": 45, "net60": 60, "net90": 90,
}


class LineItem(BaseModel):
    description: str
    qty: float
    unit_price: float


class InvoiceCreate(BaseModel):
    project_id: Optional[str] = None
    client: str
    invoice_no: str
    currency: str = "INR"
    issue_date: date
    payment_terms: str = "net30"
    due_date: Optional[date] = None
    line_items: List[LineItem]
    discount: float = 0
    tax_rate: float = 0
    notes: Optional[str] = None
    status: str = "draft"


class InvoiceUpdate(BaseModel):
    project_id: Optional[str] = None
    client: Optional[str] = None
    invoice_no: Optional[str] = None
    currency: Optional[str] = None
    issue_date: Optional[date] = None
    payment_terms: Optional[str] = None
    due_date: Optional[date] = None
    line_items: Optional[List[LineItem]] = None
    discount: Optional[float] = None
    tax_rate: Optional[float] = None
    notes: Optional[str] = None


class PaymentCreate(BaseModel):
    amount: float


def _resolve_due_date(issue_date: date, payment_terms: str, due_date: Optional[date]) -> date:
    if payment_terms == "custom":
        if not due_date:
            raise HTTPException(400, "due_date is required for custom payment terms")
        return due_date
    if payment_terms not in TERM_DAYS:
        raise HTTPException(400, "Invalid payment_terms")
    return issue_date + timedelta(days=TERM_DAYS[payment_terms])


def _out(inv: dict):
    line_items = inv.get("line_items", [])
    subtotal = sum(li["qty"] * li["unit_price"] for li in line_items)
    discount = inv.get("discount", 0)
    tax_rate = inv.get("tax_rate", 0)
    taxable = max(subtotal - discount, 0)
    tax_amount = taxable * tax_rate / 100
    total = taxable + tax_amount
    received_amount = inv.get("received_amount", 0)
    balance = total - received_amount

    status = inv["status"]
    display_status = status.capitalize()
    if status == "sent":
        due = inv.get("due_date")
        if balance > 0 and due and due < date.today().isoformat():
            display_status = "Overdue"
        elif received_amount > 0:
            display_status = "Partial"
        else:
            display_status = "Sent"

    return {
        "id": inv["id"],
        "project_id": inv.get("project_id"),
        "client": inv["client"],
        "invoice_no": inv["invoice_no"],
        "currency": inv.get("currency", "INR"),
        "issue_date": inv["issue_date"],
        "payment_terms": inv.get("payment_terms", "net30"),
        "due_date": inv["due_date"],
        "line_items": line_items,
        "discount": discount,
        "tax_rate": tax_rate,
        "notes": inv.get("notes"),
        "subtotal": subtotal,
        "tax_amount": tax_amount,
        "total": total,
        "received_amount": received_amount,
        "balance": balance,
        "payments": inv.get("payments", []),
        "status": status,
        "display_status": display_status,
    }


@router.get("/")
def list_invoices(
    project_id: Optional[str] = Query(None),
    client:     Optional[str] = Query(None),
    status:     Optional[str] = Query(None),
    date_from:  Optional[date] = Query(None),
    date_to:    Optional[date] = Query(None),
    search:     Optional[str] = Query(None),
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
        query["issue_date"] = date_filter
    if search:
        query["$or"] = [
            {"client": like(search)},
            {"invoice_no": like(search)},
            {"project_id": like(search)},
        ]
    rows = db[collections.INVOICES].find(query).sort("due_date", 1)
    return [_out(r) for r in rows]


@router.get("/summary")
def summary(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    rows = [_out(r) for r in db[collections.INVOICES].find()]
    return {
        "total_billed": sum(r["total"] for r in rows),
        "total_received": sum(r["received_amount"] for r in rows),
        "outstanding": sum(r["balance"] for r in rows if r["status"] not in ("void",)),
        "overdue": sum(r["balance"] for r in rows if r["display_status"] == "Overdue"),
    }


@router.get("/{invoice_id}")
def get_invoice(invoice_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    inv = db[collections.INVOICES].find_one({"_id": invoice_id})
    if not inv: raise HTTPException(404, "Not found")
    return _out(inv)


@router.post("/", dependencies=[Depends(require_permission("Invoices", "create"))])
def create(payload: InvoiceCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if payload.status not in ("draft", "sent"):
        raise HTTPException(400, "Status must be draft or sent at creation")
    if not payload.line_items:
        raise HTTPException(400, "At least one line item is required")
    if db[collections.INVOICES].find_one({"invoice_no": payload.invoice_no}):
        raise HTTPException(400, "Invoice number already exists")
    if payload.project_id:
        proj = db[collections.PROJECTS].find_one({"_id": payload.project_id})
        if not proj:
            raise HTTPException(404, "Project not found")

    due_date = _resolve_due_date(payload.issue_date, payload.payment_terms, payload.due_date)
    iid = next_id(db, collections.INVOICES)
    doc = {
        "_id": iid, "id": iid,
        "project_id": payload.project_id,
        "client": payload.client,
        "invoice_no": payload.invoice_no,
        "currency": payload.currency,
        "issue_date": payload.issue_date.isoformat(),
        "payment_terms": payload.payment_terms,
        "due_date": due_date.isoformat(),
        "line_items": [li.dict() for li in payload.line_items],
        "discount": payload.discount,
        "tax_rate": payload.tax_rate,
        "notes": payload.notes,
        "status": payload.status,
        "received_amount": 0,
        "payments": [],
    }
    db[collections.INVOICES].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Invoices", record_id=doc["invoice_no"], detail=f"Invoice for {doc['client']}")
    return _out(doc)


@router.patch("/{invoice_id}", dependencies=[Depends(require_permission("Invoices", "edit"))])
def update(invoice_id: int, payload: InvoiceUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    inv = db[collections.INVOICES].find_one({"_id": invoice_id})
    if not inv: raise HTTPException(404, "Not found")
    if inv["status"] != "draft":
        raise HTTPException(400, "Only draft invoices can be edited")

    patch = payload.dict(exclude_unset=True, exclude_none=True)
    if "line_items" in patch:
        patch["line_items"] = [li if isinstance(li, dict) else li.dict() for li in patch["line_items"]]
    if "invoice_no" in patch and patch["invoice_no"] != inv["invoice_no"]:
        if db[collections.INVOICES].find_one({"invoice_no": patch["invoice_no"]}):
            raise HTTPException(400, "Invoice number already exists")
    if "project_id" in patch and patch["project_id"]:
        if not db[collections.PROJECTS].find_one({"_id": patch["project_id"]}):
            raise HTTPException(404, "Project not found")

    issue_date = patch.get("issue_date", date.fromisoformat(inv["issue_date"]))
    payment_terms = patch.get("payment_terms", inv.get("payment_terms", "net30"))
    if "issue_date" in patch or "payment_terms" in patch or "due_date" in patch:
        due_date = _resolve_due_date(issue_date, payment_terms, patch.get("due_date"))
        patch["due_date"] = due_date.isoformat()
    if "issue_date" in patch:
        patch["issue_date"] = patch["issue_date"].isoformat()

    if patch:
        db[collections.INVOICES].update_one({"_id": invoice_id}, {"$set": patch})
        inv = db[collections.INVOICES].find_one({"_id": invoice_id})
    log_action(db, user=cu.name, action="UPDATE", module="Invoices", record_id=inv["invoice_no"])
    return _out(inv)


@router.post("/{invoice_id}/send", dependencies=[Depends(require_permission("Invoices", "edit"))])
def send_invoice(invoice_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    inv = db[collections.INVOICES].find_one({"_id": invoice_id})
    if not inv: raise HTTPException(404, "Not found")
    if inv["status"] != "draft":
        raise HTTPException(400, "Only draft invoices can be sent")
    db[collections.INVOICES].update_one({"_id": invoice_id}, {"$set": {"status": "sent"}})
    inv = db[collections.INVOICES].find_one({"_id": invoice_id})
    log_action(db, user=cu.name, action="SEND", module="Invoices", record_id=inv["invoice_no"])
    return _out(inv)


@router.post("/{invoice_id}/payments", dependencies=[Depends(require_permission("Invoices", "edit"))])
def record_payment(invoice_id: int, payload: PaymentCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    inv = db[collections.INVOICES].find_one({"_id": invoice_id})
    if not inv: raise HTTPException(404, "Not found")
    if inv["status"] != "sent":
        raise HTTPException(400, "Payments can only be recorded on a sent invoice")

    out = _out(inv)
    if payload.amount <= 0 or payload.amount > out["balance"] + 1e-6:
        raise HTTPException(400, "Payment amount must be greater than 0 and not exceed the balance")

    received_amount = inv.get("received_amount", 0) + payload.amount
    new_status = "paid" if received_amount >= out["total"] - 1e-6 else "sent"
    payment_entry = {"amount": payload.amount, "date": date.today().isoformat(), "recorded_by": cu.name}
    db[collections.INVOICES].update_one(
        {"_id": invoice_id},
        {"$set": {"received_amount": received_amount, "status": new_status}, "$push": {"payments": payment_entry}},
    )
    inv = db[collections.INVOICES].find_one({"_id": invoice_id})
    log_action(db, user=cu.name, action="RECORD_PAYMENT", module="Invoices", record_id=inv["invoice_no"], detail=f"Payment of {payload.amount} {inv.get('currency','INR')}")
    return _out(inv)


@router.post("/{invoice_id}/void", dependencies=[Depends(require_permission("Invoices", "edit"))])
def void_invoice(invoice_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    inv = db[collections.INVOICES].find_one({"_id": invoice_id})
    if not inv: raise HTTPException(404, "Not found")
    if inv["status"] in ("paid", "void"):
        raise HTTPException(400, "Paid or already-void invoices cannot be voided")
    db[collections.INVOICES].update_one({"_id": invoice_id}, {"$set": {"status": "void"}})
    inv = db[collections.INVOICES].find_one({"_id": invoice_id})
    log_action(db, user=cu.name, action="VOID", module="Invoices", record_id=inv["invoice_no"])
    return _out(inv)


@router.delete("/{invoice_id}", dependencies=[Depends(require_permission("Invoices", "delete"))])
def delete(invoice_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    inv = db[collections.INVOICES].find_one({"_id": invoice_id})
    if not inv: raise HTTPException(404, "Not found")
    if inv["status"] != "draft":
        raise HTTPException(400, "Only draft invoices can be deleted")
    db[collections.INVOICES].delete_one({"_id": invoice_id})
    log_action(db, user=cu.name, action="DELETE", module="Invoices", record_id=str(invoice_id))
    return {"message": "Deleted"}
