"""Inbound sync calls FROM PR Manager (Organization -> Company, Project -> Project).
Auth is app.core.security.require_prmanager_secret — a shared-secret header, not a
user JWT, since the caller is a Postgres trigger (via pg_net), not a logged-in user.

PR Manager has no concept of PR Tracker's own multi-tenancy (org_id) — it's one shared
external tool, not one-per-tenant. A PM Organization/Project that doesn't yet match an
already-linked Company/Project has to land in *some* Tracker org, so PRMANAGER_TRACKER_ORG_ID
names the one Tracker org this PR Manager instance is bound to. If multiple Tracker orgs
ever need their own separate PR Manager space, that's a separate piece of work this does
not attempt.
"""
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pymongo.database import Database

from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import next_id
from app.core.security import require_prmanager_secret

router = APIRouter()

TRACKER_ORG_ID = os.environ.get("PRMANAGER_TRACKER_ORG_ID", "")


def _newer(incoming_iso: str, stored_iso: str) -> bool:
    """Last-write-wins by timestamp string comparison — both sides stamp ISO-8601 UTC,
    which sorts chronologically as plain text. An unset stored value always loses."""
    return True if not stored_iso else incoming_iso > stored_iso


def _placeholder_company(db: Database, pm_org_id: str, name: str, updated_at: str) -> dict:
    cid = f"CO{next_id(db, collections.COMPANIES):03d}"
    doc = {
        "_id": cid, "id": cid, "org_id": TRACKER_ORG_ID,
        "name": name or "Untitled", "industry": "Unspecified",
        "primary_contact": None, "email": None, "phone": None, "gstin": None,
        "billing_address": None, "status": "Active",
        "pm_org_id": pm_org_id, "pm_sync_status": "Incomplete", "pm_missing_fields": ["industry"],
        "pm_last_synced_at": updated_at, "updated_at": updated_at,
    }
    db[collections.COMPANIES].insert_one(doc)
    return doc


@router.post("/inbound", dependencies=[Depends(require_prmanager_secret)])
def inbound_sync(payload: dict, db: Database = Depends(get_db)):
    entity = payload.get("entity")
    fields = payload.get("fields", {})
    updated_at = payload.get("updated_at") or datetime.now(timezone.utc).isoformat()
    pm_id = payload.get("pm_id")

    if entity == "company":
        return _apply_company(db, pm_id, fields, updated_at)
    if entity == "project":
        return _apply_project(db, pm_id, fields, updated_at)
    return {"error": f"unknown entity: {entity}"}


def _apply_company(db: Database, pm_id: str, fields: dict, updated_at: str) -> dict:
    existing = db[collections.COMPANIES].find_one({"pm_org_id": pm_id})
    if existing:
        if not _newer(updated_at, existing.get("pm_last_synced_at") or ""):
            return {"applied": False, "reason": "stale"}
        db[collections.COMPANIES].update_one(
            {"_id": existing["_id"]},
            {"$set": {"name": fields.get("name", existing["name"]), "pm_last_synced_at": updated_at}},
        )
        return {"applied": True, "tracker_id": existing["id"]}

    if not TRACKER_ORG_ID:
        return {"applied": False, "reason": "PRMANAGER_TRACKER_ORG_ID not configured"}
    doc = _placeholder_company(db, pm_id, fields.get("name"), updated_at)
    return {"applied": True, "tracker_id": doc["id"], "created": True}


def _apply_project(db: Database, pm_id: str, fields: dict, updated_at: str) -> dict:
    existing = db[collections.PROJECTS].find_one({"pm_project_id": pm_id})
    manager_name = fields.get("lead_name")
    missing = [] if manager_name else ["manager"]

    if existing:
        if not _newer(updated_at, existing.get("pm_last_synced_at") or ""):
            return {"applied": False, "reason": "stale"}
        db[collections.PROJECTS].update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "name": fields.get("name", existing["name"]),
                "manager": manager_name or existing["manager"],
                "pm_sync_status": "Incomplete" if missing else "Synced",
                "pm_missing_fields": missing, "pm_last_synced_at": updated_at,
            }},
        )
        return {"applied": True, "tracker_id": existing["id"]}

    if not TRACKER_ORG_ID:
        return {"applied": False, "reason": "PRMANAGER_TRACKER_ORG_ID not configured"}

    org = fields.get("org") or {}
    pm_org_id = org.get("id")
    company = db[collections.COMPANIES].find_one({"pm_org_id": pm_org_id}) if pm_org_id else None
    if not company:
        # Parent org hasn't synced to Tracker yet (delivery order between the two
        # webhooks isn't guaranteed) — self-heal with a placeholder Company now rather
        # than dropping the project; it fills in properly once the org's own sync lands.
        company = _placeholder_company(db, pm_org_id, org.get("name"), updated_at)

    pid = fields.get("key") or f"PM{pm_id}"
    if db[collections.PROJECTS].find_one({"_id": pid, "org_id": company["org_id"]}):
        pid = f"{pid}-{str(pm_id)[:6]}"
    doc = {
        "_id": pid, "id": pid, "org_id": company["org_id"],
        "name": fields.get("name", "Untitled"), "client": company["name"],
        "manager": manager_name or "(unassigned)",
        "start_date": None, "end_date": None, "status": "Not Started",
        "budget": 0, "est_revenue": 0, "est_expense": 0,
        "pm_org_id": pm_org_id, "pm_project_id": pm_id,
        "pm_sync_status": "Incomplete" if missing else "Synced", "pm_missing_fields": missing,
        "pm_last_synced_at": updated_at, "updated_at": updated_at,
    }
    db[collections.PROJECTS].insert_one(doc)
    return {"applied": True, "tracker_id": pid, "created": True}
