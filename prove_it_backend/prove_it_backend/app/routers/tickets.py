from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import next_id, like, get_or_404
from app.core.security import get_current_user
from app.core.audit import log_action
from app.core.permissions import has_permission, is_own_record

router = APIRouter()

QUEUES     = ["Finance Ops", "Access", "Billing", "IT Support", "PMO", "HR", "Vendor", "App Support"]
PRIORITIES = ["Low", "Medium", "High", "Critical"]
STATUSES   = ["Open", "In Progress", "Waiting Approval", "Resolved", "Closed", "Cancelled"]


class TicketCreate(BaseModel):
    subject: str
    project_id: Optional[str] = None
    requester: str
    queue: str
    priority: str = "Medium"
    sla_deadline: Optional[datetime] = None
    assigned_to: Optional[str] = None


class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    queue: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    resolution: Optional[str] = None
    sla_deadline: Optional[datetime] = None


class CancelPayload(BaseModel):
    reason: str


def _ticket_no():
    import random
    return f"SN-{random.randint(10000, 99999)}"


def _out(t: dict):
    return {
        "id": t["id"], "ticket_no": t["ticket_no"], "subject": t["subject"],
        "project_id": t["project_id"], "requester": t["requester"],
        "queue": t["queue"], "priority": t["priority"], "status": t["status"],
        "sla_deadline": t["sla_deadline"].isoformat() if t["sla_deadline"] else None,
        "assigned_to": t["assigned_to"], "resolution": t["resolution"],
        "cancel_reason": t["cancel_reason"],
        "created_at": t["created_at"].isoformat() if t["created_at"] else None,
        "updated_at": t["updated_at"].isoformat() if t["updated_at"] else None,
    }


@router.get("/")
def list_tickets(
    status: Optional[str] = Query(None),
    queue: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Database = Depends(get_db), cu=Depends(get_current_user),
):
    query = {"org_id": cu.org_id}
    if status: query["status"] = status
    if queue: query["queue"] = queue
    if priority: query["priority"] = priority
    if project_id: query["project_id"] = project_id
    if search: query["$or"] = [{"subject": like(search)}, {"requester": like(search)}]

    # Finance User has no access to Service Desk at all, not even their own tickets —
    # unlike every other non-Viewer role, which keeps the usual self-service fallback.
    if cu.role == "Finance User":
        return []

    if not (cu.role == "Admin" or has_permission(db, cu, "Service Desk", "view")):
        scope = {"requester": cu.name}
        query = {"$and": [query, scope]} if query else scope

    rows = db[collections.TICKETS].find(query).sort("_id", -1)
    return [_out(t) for t in rows]


@router.get("/stats")
def stats(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    tickets = list(db[collections.TICKETS].find({"org_id": cu.org_id}))
    open_t = [t for t in tickets if t["status"] not in ("Resolved", "Closed", "Cancelled")]
    return {
        "open": len(open_t),
        "in_progress": sum(1 for t in tickets if t["status"] == "In Progress"),
        "waiting_approval": sum(1 for t in tickets if t["status"] == "Waiting Approval"),
        "resolved": sum(1 for t in tickets if t["status"] == "Resolved"),
        "cancelled": sum(1 for t in tickets if t["status"] == "Cancelled"),
        "high_priority": sum(1 for t in open_t if t["priority"] in ("High", "Critical")),
        "critical": sum(1 for t in open_t if t["priority"] == "Critical"),
    }


@router.post("/")
def create_ticket(payload: TicketCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if cu.role == "Finance User":
        raise HTTPException(403, "Finance User does not have access to Service Desk")
    if payload.priority not in PRIORITIES:
        raise HTTPException(400, f"priority must be one of {PRIORITIES}")
    if payload.queue not in QUEUES:
        raise HTTPException(400, f"queue must be one of {QUEUES}")
    if not is_own_record(cu, payload.requester) and not has_permission(db, cu, "Service Desk", "create"):
        raise HTTPException(403, "You may only raise tickets for yourself")
    now = datetime.utcnow()
    tid = next_id(db, collections.TICKETS)
    doc = {
        "_id": tid, "id": tid, "org_id": cu.org_id, **payload.dict(),
        "ticket_no": _ticket_no(), "status": "Open",
        "resolution": None, "cancel_reason": None,
        "created_at": now, "updated_at": now,
    }
    db[collections.TICKETS].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Service Desk", org_id=cu.org_id, record_id=doc["ticket_no"], detail=doc["subject"])
    return _out(doc)


@router.get("/{ticket_id}")
def get_ticket(ticket_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if cu.role == "Finance User":
        raise HTTPException(404, "Ticket not found")
    t = get_or_404(db, collections.TICKETS, ticket_id, cu.org_id, "Ticket not found")
    return _out(t)


@router.patch("/{ticket_id}")
def update_ticket(ticket_id: int, payload: TicketUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if cu.role == "Finance User":
        raise HTTPException(403, "Finance User does not have access to Service Desk")
    t = get_or_404(db, collections.TICKETS, ticket_id, cu.org_id, "Ticket not found")
    can_edit_any = has_permission(db, cu, "Service Desk", "edit")
    if t["status"] in ("Closed", "Cancelled") and not can_edit_any:
        raise HTTPException(400, "Cannot update a closed/cancelled ticket")
    # Own-ticket self-service editing stops once it's Resolved (mirrors the "Pending
    # only" self-edit window on Timesheets/Expenses) — someone with Service Desk:edit
    # can still edit regardless of status.
    if not can_edit_any and not (is_own_record(cu, t["requester"]) and t["status"] not in ("Resolved", "Closed", "Cancelled")):
        raise HTTPException(403, "You may only edit your own tickets while they're still open")
    patch = payload.dict(exclude_none=True)
    patch["updated_at"] = datetime.utcnow()
    db[collections.TICKETS].update_one({"_id": ticket_id, "org_id": cu.org_id}, {"$set": patch})
    t = db[collections.TICKETS].find_one({"_id": ticket_id, "org_id": cu.org_id})
    log_action(db, user=cu.name, action="UPDATE", module="Service Desk", org_id=cu.org_id, record_id=t["ticket_no"])
    return _out(t)


@router.post("/{ticket_id}/resolve")
def resolve(ticket_id: int, payload: dict = {}, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if cu.role == "Finance User":
        raise HTTPException(403, "Finance User does not have access to Service Desk")
    t = get_or_404(db, collections.TICKETS, ticket_id, cu.org_id, "Not found")
    if not has_permission(db, cu, "Service Desk", "approve"):
        raise HTTPException(403, "Requires 'approve' permission on Service Desk")
    resolution = payload.get("resolution", "Issue resolved.") if isinstance(payload, dict) else "Issue resolved."
    db[collections.TICKETS].update_one({"_id": ticket_id, "org_id": cu.org_id}, {"$set": {"status": "Resolved", "updated_at": datetime.utcnow(), "resolution": resolution}})
    t = db[collections.TICKETS].find_one({"_id": ticket_id, "org_id": cu.org_id})
    log_action(db, user=cu.name, action="UPDATE", module="Service Desk", org_id=cu.org_id, record_id=t["ticket_no"], detail="Resolved")
    return _out(t)


@router.post("/{ticket_id}/close")
def close(ticket_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if cu.role == "Finance User":
        raise HTTPException(403, "Finance User does not have access to Service Desk")
    t = get_or_404(db, collections.TICKETS, ticket_id, cu.org_id, "Not found")
    if not has_permission(db, cu, "Service Desk", "approve") and not is_own_record(cu, t["requester"]):
        raise HTTPException(403, "You may only close your own tickets")
    if t["status"] != "Resolved":
        raise HTTPException(400, "Only resolved tickets can be closed")
    db[collections.TICKETS].update_one({"_id": ticket_id, "org_id": cu.org_id}, {"$set": {"status": "Closed", "updated_at": datetime.utcnow()}})
    t = db[collections.TICKETS].find_one({"_id": ticket_id, "org_id": cu.org_id})
    log_action(db, user=cu.name, action="UPDATE", module="Service Desk", org_id=cu.org_id, record_id=t["ticket_no"], detail="Closed")
    return _out(t)


@router.post("/{ticket_id}/cancel")
def cancel(ticket_id: int, payload: CancelPayload, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if cu.role == "Finance User":
        raise HTTPException(403, "Finance User does not have access to Service Desk")
    t = get_or_404(db, collections.TICKETS, ticket_id, cu.org_id, "Not found")
    if not has_permission(db, cu, "Service Desk", "approve") and not is_own_record(cu, t["requester"]):
        raise HTTPException(403, "You may only cancel your own tickets")
    if t["status"] in ("Closed", "Cancelled"):
        raise HTTPException(400, "Ticket is already closed/cancelled")
    db[collections.TICKETS].update_one({"_id": ticket_id, "org_id": cu.org_id}, {"$set": {"status": "Cancelled", "cancel_reason": payload.reason, "updated_at": datetime.utcnow()}})
    t = db[collections.TICKETS].find_one({"_id": ticket_id, "org_id": cu.org_id})
    log_action(db, user=cu.name, action="CANCEL", module="Service Desk", org_id=cu.org_id, record_id=t["ticket_no"], detail=payload.reason)
    return _out(t)
