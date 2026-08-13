from datetime import datetime
from typing import List, Optional

from bson import json_util
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from pymongo.database import Database

from app.core import collections
from app.core.database import get_db, client
from app.core.security import get_current_user, require_role, require_permission
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


class WeeklyOffSettings(BaseModel):
    # Python date.weekday(): Monday=0 .. Sunday=6. Defaults to Sunday-only (6-day work
    # week) — this matches the org's real June 2026 pay register (4 Sundays that month,
    # not 8-9 as a Sat+Sun weekend would produce), not just a generic assumption.
    weekdays: List[int] = [6]


# ── Defaults (mirror the static markup's own defaults, shown until first save) ──

DEFAULT_PROFILE = ProfileSettings().dict()

DEFAULT_NOTIF_ITEMS = [
    {"label": "Timesheet submission", "in_app": True, "email": True},
    {"label": "Expense approval/rejection", "in_app": True, "email": True},
    {"label": "Pending approvals reminder", "in_app": True, "email": True},
    {"label": "Overdue receivables alert", "in_app": True, "email": False},
    {"label": "Project deadline reminder", "in_app": True, "email": False},
]

DEFAULT_WORKFLOW = ApprovalWorkflowSettings().dict()

DEFAULT_BACKUP_CONFIG = BackupConfigSettings().dict()

DEFAULT_WEEKLY_OFF = WeeklyOffSettings().dict()


def _section_id(org_id, section: str) -> str:
    return f"{org_id}:{section}"


def _get_section(db: Database, org_id, section_id: str, default: dict) -> dict:
    doc = db[collections.SETTINGS].find_one({"_id": _section_id(org_id, section_id)})
    if not doc:
        return default
    doc.pop("_id", None)
    doc.pop("org_id", None)
    doc.pop("section", None)
    return doc


def _save_section(db: Database, org_id, section_id: str, data: dict):
    db[collections.SETTINGS].update_one(
        {"_id": _section_id(org_id, section_id)},
        {"$set": {**data, "org_id": org_id, "section": section_id}},
        upsert=True,
    )


# ── Company Profile ───────────────────────────────────────────────────────────

@router.get("/profile", dependencies=[Depends(require_role("Admin", "Manager"))])
def get_profile(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    return _get_section(db, cu.org_id, "profile", DEFAULT_PROFILE)


@router.patch("/profile", dependencies=[Depends(require_role("Admin", "Manager"))])
def save_profile(payload: ProfileSettings, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    _save_section(db, cu.org_id, "profile", payload.dict())
    log_action(db, user=cu.name, action="UPDATE", module="Settings", org_id=cu.org_id, record_id="profile", detail="Company profile updated")
    return {"message": "Profile saved"}


# ── Notifications ─────────────────────────────────────────────────────────────

@router.get("/notifications", dependencies=[Depends(require_role("Admin", "Manager"))])
def get_notifications(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    section = _get_section(db, cu.org_id, "notifications", {"items": DEFAULT_NOTIF_ITEMS})
    return section.get("items", DEFAULT_NOTIF_ITEMS)


@router.patch("/notifications", dependencies=[Depends(require_role("Admin", "Manager"))])
def save_notifications(payload: NotificationSettings, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    _save_section(db, cu.org_id, "notifications", {"items": [i.dict() for i in payload.items]})
    log_action(db, user=cu.name, action="UPDATE", module="Settings", org_id=cu.org_id, record_id="notifications", detail="Notification preferences updated")
    return {"message": "Notification preferences saved"}


# ── Approval Workflow ─────────────────────────────────────────────────────────

@router.get("/approval-workflow", dependencies=[Depends(require_role("Admin", "Manager"))])
def get_approval_workflow(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    return _get_section(db, cu.org_id, "approval_workflow", DEFAULT_WORKFLOW)


@router.patch("/approval-workflow", dependencies=[Depends(require_role("Admin", "Manager"))])
def save_approval_workflow(payload: ApprovalWorkflowSettings, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    _save_section(db, cu.org_id, "approval_workflow", payload.dict())
    log_action(db, user=cu.name, action="UPDATE", module="Settings", org_id=cu.org_id, record_id="approval_workflow", detail="Approval workflow updated")
    return {"message": "Approval workflow saved"}


# ── Backup config (schedule/retention prefs — separate from the export/restore actions below) ──

@router.get("/backup-config", dependencies=[Depends(require_role("Admin", "Manager"))])
def get_backup_config(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    return _get_section(db, cu.org_id, "backup_config", DEFAULT_BACKUP_CONFIG)


@router.patch("/backup-config", dependencies=[Depends(require_role("Admin", "Manager"))])
def save_backup_config(payload: BackupConfigSettings, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    _save_section(db, cu.org_id, "backup_config", payload.dict())
    log_action(db, user=cu.name, action="UPDATE", module="Settings", org_id=cu.org_id, record_id="backup_config", detail="Backup configuration updated")
    return {"message": "Backup configuration saved"}


# ── Weekly Off pattern (Payroll's attendance calc, not a general org-profile setting —
# gated on the Payroll permission rather than Admin/Manager-only like the sections above,
# so Finance User can manage it from the Payroll page's Holidays & Weekly Off tab) ──────

@router.get("/weekly-off", dependencies=[Depends(require_permission("Payroll", "view"))])
def get_weekly_off(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    return _get_section(db, cu.org_id, "weekly_off", DEFAULT_WEEKLY_OFF)


@router.patch("/weekly-off", dependencies=[Depends(require_permission("Payroll", "edit"))])
def save_weekly_off(payload: WeeklyOffSettings, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    _save_section(db, cu.org_id, "weekly_off", payload.dict())
    log_action(db, user=cu.name, action="UPDATE", module="Payroll", org_id=cu.org_id, record_id="weekly_off", detail="Weekly off pattern updated")
    return {"message": "Weekly off pattern saved"}


# ── Full database backup / restore ────────────────────────────────────────────
# Covers every collection in collections.ALL_COLLECTIONS, scoped to the acting Admin's
# own organization — export only pulls that org's docs; restore only ever deletes/
# replaces that org's own docs in each collection, never the whole collection (which
# would otherwise wipe every other organization's data too). "counters" is deliberately
# excluded on both sides: it's a shared, cross-org id-sequencing table, not org data —
# touching it during one org's restore could corrupt id generation for every other org.

@router.get("/backup/export", dependencies=[Depends(require_role("Admin", "Manager"))])
def export_backup(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    data = {name: list(db[name].find({"org_id": cu.org_id})) for name in collections.ALL_COLLECTIONS}

    payload = {
        "exported_at": datetime.utcnow().isoformat(),
        "db_name": db.name,
        "exported_org_id": cu.org_id,
        "collections": data,
    }
    log_action(db, user=cu.name, action="EXPORT", module="Settings", org_id=cu.org_id, detail="Full database backup exported")

    body = json_util.dumps(payload, indent=2)
    filename = f"prove_it_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/backup/restore", dependencies=[Depends(require_role("Admin", "Manager"))])
def restore_backup(file: UploadFile = File(...), db: Database = Depends(get_db), cu=Depends(get_current_user)):
    raw = file.file.read()
    try:
        payload = json_util.loads(raw)
    except Exception:
        raise HTTPException(400, "Backup file is not valid JSON")

    if not isinstance(payload, dict) or not isinstance(payload.get("collections"), dict):
        raise HTTPException(400, "Backup file is missing a 'collections' object")

    # A backup exported before org-scoping existed carries no "exported_org_id" at all —
    # its collections mix every organization's data together. Rather than reject it
    # outright or restore everyone else's data too, only ever accept docs that already
    # belong to the caller's own org. A backup exported (post-scoping) by a DIFFERENT
    # org is rejected outright — an org can only restore its own backup, never inject
    # another org's export.
    exported_org_id = payload.get("exported_org_id")
    if exported_org_id is not None and exported_org_id != cu.org_id:
        raise HTTPException(403, "This backup was exported by a different organization")

    incoming = payload["collections"]
    known = set(collections.ALL_COLLECTIONS)  # "counters" deliberately excluded — shared across orgs, never restored
    restored = {}

    with client.start_session() as session:
        with session.start_transaction():
            for name, docs in incoming.items():
                if name not in known or not isinstance(docs, list):
                    continue
                own_docs = [d for d in docs if isinstance(d, dict) and d.get("org_id") == cu.org_id]
                db[name].delete_many({"org_id": cu.org_id}, session=session)
                if own_docs:
                    db[name].insert_many(own_docs, session=session)
                restored[name] = len(own_docs)

    log_action(db, user=cu.name, action="RESTORE", module="Settings", org_id=cu.org_id, detail=f"Database restored from backup: {restored}")
    return {"message": "Backup restored", "collections": restored}
