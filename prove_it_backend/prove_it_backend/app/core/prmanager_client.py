"""Outbound sync calls to PR Manager (pm.proveit.in) — Company -> Organization,
Project -> Project, and (one-directional) Employee -> Member.

One shared Edge Function endpoint on PR Manager's side (`prtracker-sync`) handles all
three entities. Every public function here is self-contained: it makes the HTTP call,
persists whatever PR Manager reports back (or a "Sync Failed" status on any error)
directly onto the Mongo doc, and returns that same update dict so the calling router can
merge it into the in-memory doc before building its response — never lets PR Manager
being unreachable break the PR Tracker request itself, same spirit as log_action()/
notify() being best-effort side effects called inline right after the write.
"""
import os
import re
from datetime import datetime, timezone
from typing import Optional

import httpx

from app.core import collections

PRMANAGER_BASE_URL = os.environ.get("PRMANAGER_BASE_URL", "").rstrip("/")
PRMANAGER_SHARED_SECRET = os.environ.get("PRMANAGER_SHARED_SECRET", "")
PRMANAGER_ANON_KEY = os.environ.get("PRMANAGER_ANON_KEY", "")

_TIMEOUT = 8.0


def _post(entity: str, op: str, tracker_id: str, updated_at: str, fields: dict) -> dict:
    if not PRMANAGER_BASE_URL or not PRMANAGER_SHARED_SECRET:
        raise RuntimeError("PR Manager sync is not configured (PRMANAGER_BASE_URL/PRMANAGER_SHARED_SECRET unset)")
    headers = {"x-prtracker-secret": PRMANAGER_SHARED_SECRET}
    if PRMANAGER_ANON_KEY:
        headers["authorization"] = f"Bearer {PRMANAGER_ANON_KEY}"
    resp = httpx.post(
        f"{PRMANAGER_BASE_URL}/functions/v1/prtracker-sync",
        json={"entity": entity, "op": op, "tracker_id": tracker_id, "updated_at": updated_at, "fields": fields},
        headers=headers,
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def sync_company_to_pm(db, company: dict) -> dict:
    try:
        result = _post(
            "company", "upsert", company["id"], company.get("updated_at", ""),
            {"name": company["name"]},
        )
        update = {
            "pm_org_id": result.get("pm_id"),
            "pm_sync_status": "Incomplete" if result.get("missing_fields") else "Synced",
            "pm_missing_fields": result.get("missing_fields", []),
            "pm_last_synced_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception:
        update = {"pm_sync_status": "Sync Failed"}
    db[collections.COMPANIES].update_one({"_id": company["id"], "org_id": company["org_id"]}, {"$set": update})
    return update


def _resolve_manager_email(db, org_id, manager_name: str) -> Optional[str]:
    if not manager_name:
        return None
    emp = db[collections.EMPLOYEES].find_one(
        {"name": {"$regex": f"^{re.escape(manager_name)}$", "$options": "i"}, "org_id": org_id}
    )
    return emp.get("email") if emp else None


def sync_project_to_pm(db, project: dict) -> dict:
    """Resolves the linked Company's pm_org_id once and caches it on the Project doc —
    `client` is a free-text name match against Company.name, not a real FK, so a later
    Company rename must not silently break an already-linked Project. If the Company
    hasn't synced to PR Manager yet, this Project stays "Blocked" until its next save."""
    pm_org_id = project.get("pm_org_id")
    if not pm_org_id:
        company = db[collections.COMPANIES].find_one({"name": project["client"], "org_id": project["org_id"]})
        pm_org_id = company.get("pm_org_id") if company else None
        if not pm_org_id:
            update = {"pm_sync_status": "Blocked", "pm_missing_fields": ["Company not yet linked to PR Manager"]}
            db[collections.PROJECTS].update_one({"_id": project["id"], "org_id": project["org_id"]}, {"$set": update})
            return update

    manager_email = _resolve_manager_email(db, project["org_id"], project.get("manager"))
    try:
        result = _post(
            "project", "upsert", project["id"], project.get("updated_at", ""),
            {
                "name": project["name"], "key": project["id"], "pm_org_id": pm_org_id,
                "manager_name": project.get("manager"), "manager_email": manager_email,
            },
        )
        update = {
            "pm_org_id": pm_org_id,
            "pm_project_id": result.get("pm_id"),
            "pm_sync_status": "Incomplete" if result.get("missing_fields") else "Synced",
            "pm_missing_fields": result.get("missing_fields", []),
            "pm_last_synced_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception:
        update = {"pm_org_id": pm_org_id, "pm_sync_status": "Sync Failed"}
    db[collections.PROJECTS].update_one({"_id": project["id"], "org_id": project["org_id"]}, {"$set": update})
    return update


def sync_employee_to_pm(db, employee: dict) -> dict:
    """One-directional only (Tracker -> Manager). Membership target is whatever PM
    Organizations correspond to this employee's existing Assigned-Projects grants
    (PROJECT_PERMISSIONS, allowed=True) — deliberately NOT "every project" for an
    employee with no grant rows yet, even though Tracker itself treats that as
    unrestricted; cross-app account provisioning is higher-stakes than an in-app
    page-view default. Turning the checkbox off disables (never deletes) PM membership,
    for an audit trail on PR Manager's side."""
    org_id = employee["org_id"]
    if not employee.get("pm_access_enabled"):
        try:
            result = _post(
                "member", "disable", employee["emp_id"], employee.get("updated_at", ""),
                {"email": employee["email"]},
            )
            update = {"pm_sync_status": "Not Enabled"}
        except Exception:
            update = {"pm_sync_status": "Sync Failed"}
        db[collections.EMPLOYEES].update_one({"_id": employee["emp_id"], "org_id": org_id}, {"$set": update})
        return update

    grants = db[collections.PROJECT_PERMISSIONS].find({"emp_id": employee["emp_id"], "org_id": org_id, "allowed": True})
    project_ids = [g["project_id"] for g in grants]
    if not project_ids:
        update = {"pm_sync_status": "Blocked", "pm_member_id": None}
        db[collections.EMPLOYEES].update_one({"_id": employee["emp_id"], "org_id": org_id}, {"$set": update})
        return update

    pm_org_ids = sorted({
        p["pm_org_id"] for p in db[collections.PROJECTS].find(
            {"_id": {"$in": project_ids}, "org_id": org_id, "pm_org_id": {"$ne": None}}
        )
    })
    if not pm_org_ids:
        update = {"pm_sync_status": "Blocked", "pm_member_id": None}
        db[collections.EMPLOYEES].update_one({"_id": employee["emp_id"], "org_id": org_id}, {"$set": update})
        return update

    try:
        result = _post(
            "member", "upsert", employee["emp_id"], employee.get("updated_at", ""),
            {"name": employee["name"], "email": employee["email"], "pm_org_ids": pm_org_ids},
        )
        update = {
            "pm_member_id": result.get("pm_id"),
            "pm_sync_status": "Active" if result.get("ok") else "Sync Failed",
        }
    except Exception:
        update = {"pm_sync_status": "Sync Failed"}
    db[collections.EMPLOYEES].update_one({"_id": employee["emp_id"], "org_id": org_id}, {"$set": update})
    return update

