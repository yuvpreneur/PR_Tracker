from datetime import datetime
from typing import List, Optional

from bson import json_util
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from pymongo.database import Database

from app.core import collections
from app.core.database import get_db, client
from app.core.security import get_current_user, require_role
from app.core.audit import log_action

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class ProfileSettings(BaseModel):
    company_name: str = ""
    gst_number: str = ""
    default_currency: str = "INR"
    financial_year_start: str = "April (India)"


class NotifItem(BaseModel):
    label: str
    in_app: bool = True
    email: bool = False


class NotificationSettings(BaseModel):
    items: List[NotifItem]


class ApprovalWorkflowSettings(BaseModel):
    timesheet_approval_levels: str = "1 Level (Manager)"
    expense_approval_levels: str = "2 Levels (Manager → Finance)"
    auto_lock: str = "Yes – lock immediately"


class BackupConfigSettings(BaseModel):
    auto_backup_frequency: str = "Daily"
    retention_days: int = 90


# ── Defaults (mirror the static markup's own defaults, shown until first save) ──

DEFAULT_PROFILE = ProfileSettings().dict()

DEFAULT_NOTIF_ITEMS = [
    {"label": "Timesheet submission", "in_app": True, "email": True},
    {"label": "Expense approval/rejection", "in_app": True, "email": True},
    {"label": "Pending approvals reminder", "in_app": True, "email": True},
    {"label": "Overdue receivables alert", "in_app": True, "email": False},
    {"label": "Project deadline reminder", "in_app": True, "email": False},
    {"label": "Missing attendance reminder", "in_app": True, "email": False},
]

DEFAULT_WORKFLOW = ApprovalWorkflowSettings().dict()

DEFAULT_BACKUP_CONFIG = BackupConfigSettings().dict()


def _get_section(db: Database, section_id: str, default: dict) -> dict:
    doc = db[collections.SETTINGS].find_one({"_id": section_id})
    if not doc:
        return default
    doc.pop("_id", None)
    return doc


def _save_section(db: Database, section_id: str, data: dict):
    db[collections.SETTINGS].update_one({"_id": section_id}, {"$set": data}, upsert=True)


# ── Company Profile ───────────────────────────────────────────────────────────

@router.get("/profile", dependencies=[Depends(require_role("Admin"))])
def get_profile(db: Database = Depends(get_db)):
    return _get_section(db, "profile", DEFAULT_PROFILE)


@router.patch("/profile", dependencies=[Depends(require_role("Admin"))])
def save_profile(payload: ProfileSettings, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    _save_section(db, "profile", payload.dict())
    log_action(db, user=cu.name, action="UPDATE", module="Settings", record_id="profile", detail="Company profile updated")
    return {"message": "Profile saved"}


# ── Notifications ─────────────────────────────────────────────────────────────

@router.get("/notifications", dependencies=[Depends(require_role("Admin"))])
def get_notifications(db: Database = Depends(get_db)):
    section = _get_section(db, "notifications", {"items": DEFAULT_NOTIF_ITEMS})
    return section.get("items", DEFAULT_NOTIF_ITEMS)


@router.patch("/notifications", dependencies=[Depends(require_role("Admin"))])
def save_notifications(payload: NotificationSettings, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    _save_section(db, "notifications", {"items": [i.dict() for i in payload.items]})
    log_action(db, user=cu.name, action="UPDATE", module="Settings", record_id="notifications", detail="Notification preferences updated")
    return {"message": "Notification preferences saved"}


# ── Approval Workflow ─────────────────────────────────────────────────────────

@router.get("/approval-workflow", dependencies=[Depends(require_role("Admin"))])
def get_approval_workflow(db: Database = Depends(get_db)):
    return _get_section(db, "approval_workflow", DEFAULT_WORKFLOW)


@router.patch("/approval-workflow", dependencies=[Depends(require_role("Admin"))])
def save_approval_workflow(payload: ApprovalWorkflowSettings, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    _save_section(db, "approval_workflow", payload.dict())
    log_action(db, user=cu.name, action="UPDATE", module="Settings", record_id="approval_workflow", detail="Approval workflow updated")
    return {"message": "Approval workflow saved"}


# ── Backup config (schedule/retention prefs — separate from the export/restore actions below) ──

@router.get("/backup-config", dependencies=[Depends(require_role("Admin"))])
def get_backup_config(db: Database = Depends(get_db)):
    return _get_section(db, "backup_config", DEFAULT_BACKUP_CONFIG)


@router.patch("/backup-config", dependencies=[Depends(require_role("Admin"))])
def save_backup_config(payload: BackupConfigSettings, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    _save_section(db, "backup_config", payload.dict())
    log_action(db, user=cu.name, action="UPDATE", module="Settings", record_id="backup_config", detail="Backup configuration updated")
    return {"message": "Backup configuration saved"}


# ── Full database backup / restore ────────────────────────────────────────────
# Covers every collection in collections.ALL_COLLECTIONS plus the "counters" collection
# that backs auto-incrementing ids (app/core/mongo_utils.next_id). Restore only touches
# collection keys actually present in the uploaded file — it does not wipe collections
# the file doesn't mention.

@router.get("/backup/export", dependencies=[Depends(require_role("Admin"))])
def export_backup(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    data = {name: list(db[name].find()) for name in collections.ALL_COLLECTIONS}
    data["counters"] = list(db["counters"].find())

    payload = {
        "exported_at": datetime.utcnow().isoformat(),
        "db_name": db.name,
        "collections": data,
    }
    log_action(db, user=cu.name, action="EXPORT", module="Settings", detail="Full database backup exported")

    body = json_util.dumps(payload, indent=2)
    filename = f"prove_it_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/backup/restore", dependencies=[Depends(require_role("Admin"))])
def restore_backup(file: UploadFile = File(...), db: Database = Depends(get_db), cu=Depends(get_current_user)):
    raw = file.file.read()
    try:
        payload = json_util.loads(raw)
    except Exception:
        raise HTTPException(400, "Backup file is not valid JSON")

    if not isinstance(payload, dict) or not isinstance(payload.get("collections"), dict):
        raise HTTPException(400, "Backup file is missing a 'collections' object")

    incoming = payload["collections"]
    known = set(collections.ALL_COLLECTIONS) | {"counters"}
    restored = {}

    with client.start_session() as session:
        with session.start_transaction():
            for name, docs in incoming.items():
                if name not in known or not isinstance(docs, list):
                    continue
                db[name].delete_many({}, session=session)
                if docs:
                    db[name].insert_many(docs, session=session)
                restored[name] = len(docs)

    log_action(db, user=cu.name, action="RESTORE", module="Settings", detail=f"Database restored from backup: {restored}")
    return {"message": "Backup restored", "collections": restored}
