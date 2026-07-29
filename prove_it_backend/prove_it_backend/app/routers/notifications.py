import re

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from pymongo.database import Database

from app.core import collections
from app.core.database import get_db
from app.core.security import get_current_user

router = APIRouter()


class ReadModuleRequest(BaseModel):
    module: str


def _out(n: dict):
    return {
        "id": n["id"], "module": n["module"], "record_id": n["record_id"],
        "status": n["status"], "message": n["message"],
        "created_at": n["created_at"].isoformat() if n["created_at"] else None,
    }


def _recipient_filter(name: str) -> dict:
    # Case-insensitive: Users.name and Employees.name are two independently-typed fields
    # that have been found to differ only in case for real accounts (e.g. User "anya" vs
    # Employee "Anya") — same caveat as my_emp_ids() in app/core/permissions.py. Leave's
    # and Timesheets' notify() calls store the Employees-cased name as `recipient` (looked
    # up fresh from the Employees record at approve/reject time), so matching against
    # cu.name (Users-cased) with an exact string match silently strands those notifications
    # forever for any account where the two differ only in case.
    return {"$regex": f"^{re.escape(name)}$", "$options": "i"}


@router.get("/")
def list_notifications(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    """Unread notifications about decisions made on requests this user submitted
    (leave/access/timesheet/expense). Only unread ones — once marked read via
    POST /read-all they stop appearing here, which is what makes them "disappear" client-
    side. Not the Admin/Manager "needs my action" queue — see GET /api/approvals/pending
    for that."""
    rows = db[collections.NOTIFICATIONS].find({"recipient": _recipient_filter(cu.name), "is_read": False}).sort("_id", -1)
    return [_out(n) for n in rows]


@router.post("/read-by-module")
def mark_module_read(payload: ReadModuleRequest, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    """Marks this user's own unread notifications for one module as read. Timesheets/
    Leave/Expenses each have a "my records" page a non-Admin/Manager can visit — the
    frontend calls this on mount there, so seeing your own entry there is what dismisses
    its notification, not just glancing at the bell. Access Control has no such page for
    a regular requester, so its notifications still get marked read via the bell/panel
    opening instead (see loadNotifications() in bridge/shared/notifications.js)."""
    db[collections.NOTIFICATIONS].update_many(
        {"recipient": _recipient_filter(cu.name), "is_read": False, "module": payload.module},
        {"$set": {"is_read": True}},
    )
    return {"message": "Marked as read"}
