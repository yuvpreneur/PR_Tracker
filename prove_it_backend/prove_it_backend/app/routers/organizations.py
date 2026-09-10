import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from bson import Binary
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from pymongo.database import Database
import httpx

from app.core import collections
from app.core.audit import log_action
from app.core.database import client, get_db
from app.core.security import get_current_user, require_platform_permission
from app.routers.users import create_user_record
from app.routers.settings import _save_section

PRMANAGER_BASE_URL = os.environ.get("PRMANAGER_BASE_URL", "").rstrip("/")
PRMANAGER_SHARED_SECRET = os.environ.get("PRMANAGER_SHARED_SECRET", "")
PRMANAGER_ANON_KEY = os.environ.get("PRMANAGER_ANON_KEY", "")

router = APIRouter()

# Super Admin always passes require_platform_permission(); a Sub Admin passes only if
# granted the "organizations" platform permission. See app/core/security.py.
router_deps = [Depends(require_platform_permission("organizations"))]

MAX_LOGO_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_LOGO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".svg"}
ALLOWED_LOGO_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/svg+xml"}


def _read_logo(logo: UploadFile) -> tuple:
    """Validates and reads an uploaded logo file, shared by create_organization() and
    replace_organization_logo() below. Returns (bytes, filename, content_type)."""
    ext = os.path.splitext(logo.filename or "")[1].lower()
    if ext not in ALLOWED_LOGO_EXTENSIONS or logo.content_type not in ALLOWED_LOGO_CONTENT_TYPES:
        raise HTTPException(400, "Logo must be a JPG, PNG, WEBP or SVG image")
    data = logo.file.read()
    if len(data) > MAX_LOGO_SIZE:
        raise HTTPException(400, "Logo must be smaller than 5MB")
    return data, logo.filename, logo.content_type


def _org_out(o: dict) -> dict:
    return {
        "id": o["id"],
        "name": o["name"],
        "logo_url": o.get("logo_url"),
        "is_active": o["is_active"],
        "created_at": o["created_at"].isoformat() if o.get("created_at") else None,
        "created_by": o.get("created_by"),
    }


@router.get("/", dependencies=router_deps)
def list_organizations(db: Database = Depends(get_db)):
    rows = db[collections.ORGANIZATIONS].find().sort("created_at", -1)
    return [_org_out(o) for o in rows]


# Self-service — any authenticated (non-Super-Admin) user, scoped to their own org. No
# router_deps here deliberately: this is how an org's own Admin/Manager/Employee/etc.
# fetches their own org's name/logo for branding (see AppLayout.jsx), not a Super-Admin
# capability. Must stay registered ahead of GET /{org_id} and GET /{org_id}/logo below —
# otherwise FastAPI would match "/me" as org_id="me" against those path-param routes first.
@router.get("/me")
def get_my_organization(cu=Depends(get_current_user), db: Database = Depends(get_db)):
    if not cu.org_id:
        raise HTTPException(404, "No organization")
    o = db[collections.ORGANIZATIONS].find_one({"_id": cu.org_id})
    if not o:
        raise HTTPException(404, "Organization not found")
    return _org_out(o)


@router.get("/me/logo")
def get_my_organization_logo(cu=Depends(get_current_user), db: Database = Depends(get_db)):
    if not cu.org_id:
        raise HTTPException(404, "No organization")
    doc = db[collections.ORG_LOGOS].find_one({"_id": cu.org_id})
    if not doc:
        raise HTTPException(404, "Logo not found")
    return Response(
        content=bytes(doc["data"]),
        media_type=doc.get("content_type") or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{doc["filename"]}"'},
    )


@router.get("/{org_id}", dependencies=router_deps)
def get_organization(org_id: str, db: Database = Depends(get_db)):
    o = db[collections.ORGANIZATIONS].find_one({"_id": org_id})
    if not o:
        raise HTTPException(404, "Organization not found")
    return _org_out(o)


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


@router.patch("/{org_id}", dependencies=router_deps)
def update_organization(
    org_id: str, payload: OrganizationUpdate,
    db: Database = Depends(get_db), cu=Depends(get_current_user),
):
    o = db[collections.ORGANIZATIONS].find_one({"_id": org_id})
    if not o:
        raise HTTPException(404, "Organization not found")
    patch = payload.dict(exclude_none=True)
    if patch:
        db[collections.ORGANIZATIONS].update_one({"_id": org_id}, {"$set": patch})
        o = db[collections.ORGANIZATIONS].find_one({"_id": org_id})
    log_action(db, user=cu.name, action="UPDATE", module="Organizations", org_id=org_id, record_id=org_id,
               detail=f"Updated organization {o['name']}")
    return _org_out(o)


@router.post("/", dependencies=router_deps)
def create_organization(
    name: str = Form(...),
    admin_username: str = Form(...),
    admin_password: str = Form(...),
    admin_name: str = Form(...),
    admin_email: str = Form(...),
    logo: Optional[UploadFile] = File(None),
    db: Database = Depends(get_db),
    cu=Depends(get_current_user),
):
    """Creates the Organization and its initial Admin account together. Multipart form,
    not JSON — a file upload and a JSON body can't coexist in one request (same reason
    expenses.py's attachment upload is multipart-only). Wrapped in a transaction so a
    failure creating the Admin (e.g. duplicate username) never leaves an orphaned
    Organization with nobody able to log into it."""
    logo_bytes = logo_filename = logo_content_type = None
    if logo is not None:
        logo_bytes, logo_filename, logo_content_type = _read_logo(logo)

    org_id = uuid.uuid4().hex
    org_doc = {
        "_id": org_id, "id": org_id,
        "name": name,
        "logo_url": f"/api/organizations/{org_id}/logo" if logo_bytes else None,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "created_by": cu.username,
    }

    with client.start_session() as session:
        with session.start_transaction():
            db[collections.ORGANIZATIONS].insert_one(org_doc, session=session)
            if logo_bytes:
                db[collections.ORG_LOGOS].insert_one({
                    "_id": org_id, "filename": logo_filename, "content_type": logo_content_type,
                    "data": Binary(logo_bytes), "uploaded_by": cu.username,
                }, session=session)
            admin_doc = create_user_record(
                db, username=admin_username, password=admin_password, name=admin_name,
                email=admin_email, role="Admin", org_id=org_id, session=session,
            )
            # Seed this org's own Company Profile settings from the platform defaults
            # (app/routers/platform_settings.py) instead of leaving every new org to
            # settings.py's blank fallback.
            platform_defaults = db[collections.PLATFORM_SETTINGS].find_one({"_id": "platform"}, session=session) or {}
            _save_section(db, org_id, "profile", {
                "company_name": "",
                "gst_number": "",
                "default_currency": platform_defaults.get("default_currency", "INR"),
                "financial_year_start": platform_defaults.get("default_financial_year_start", "April (India)"),
            }, session=session)

    log_action(db, user=cu.name, action="CREATE", module="Organizations", org_id=org_id, record_id=org_id,
               detail=f"Created organization '{name}' with initial Admin {admin_username}")

    # Sync organization creation to PR Manager via stored procedure (best-effort, non-blocking)
    if PRMANAGER_BASE_URL and PRMANAGER_ANON_KEY:
        try:
            headers = {"authorization": f"Bearer {PRMANAGER_ANON_KEY}"}
            httpx.post(
                f"{PRMANAGER_BASE_URL}/rest/v1/rpc/sync_tracker_organization",
                json={
                    "p_tracker_org_id": org_id,
                    "p_org_name": name,
                    "p_admin_email": admin_email,
                },
                headers=headers,
                timeout=8.0,
            )
        except Exception:
            pass  # PR Manager sync is best-effort, don't block org creation

    return {
        "organization": _org_out(org_doc),
        "admin": {"username": admin_doc["username"], "name": admin_doc["name"], "email": admin_doc["email"]},
    }


@router.post("/{org_id}/logo", dependencies=router_deps)
def replace_organization_logo(
    org_id: str, logo: UploadFile = File(...),
    db: Database = Depends(get_db), cu=Depends(get_current_user),
):
    o = db[collections.ORGANIZATIONS].find_one({"_id": org_id})
    if not o:
        raise HTTPException(404, "Organization not found")
    data, filename, content_type = _read_logo(logo)
    db[collections.ORG_LOGOS].update_one(
        {"_id": org_id},
        {"$set": {"filename": filename, "content_type": content_type, "data": Binary(data), "uploaded_by": cu.username}},
        upsert=True,
    )
    db[collections.ORGANIZATIONS].update_one({"_id": org_id}, {"$set": {"logo_url": f"/api/organizations/{org_id}/logo"}})
    o = db[collections.ORGANIZATIONS].find_one({"_id": org_id})
    log_action(db, user=cu.name, action="UPDATE", module="Organizations", org_id=org_id, record_id=org_id,
               detail=f"Replaced logo for organization {o['name']}")
    return _org_out(o)


@router.get("/{org_id}/logo", dependencies=router_deps)
def get_organization_logo(org_id: str, db: Database = Depends(get_db)):
    # Super-Admin-only for now, matching every other route here — org-branded login
    # (showing this to that org's own users pre-auth) is explicitly deferred, see plan.
    doc = db[collections.ORG_LOGOS].find_one({"_id": org_id})
    if not doc:
        raise HTTPException(404, "Logo not found")
    return Response(
        content=bytes(doc["data"]),
        media_type=doc.get("content_type") or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{doc["filename"]}"'},
    )
