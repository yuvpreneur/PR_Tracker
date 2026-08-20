from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pymongo.database import Database

from app.core import collections
from app.core.audit import log_action
from app.core.database import get_db
from app.core.security import PLATFORM_MODULES, get_current_user, hash_password, require_role
from app.routers.users import create_user_record

router = APIRouter()

# Sub Admins never manage each other or themselves — only Super Admin reaches this
# router at all, matching organizations.py's total-gate pattern. This is deliberately
# NOT gated via require_platform_permission(): granting a Sub Admin control over other
# Sub Admin accounts (including their own permissions) would let them escalate their
# own access, so this one platform-level capability stays Super-Admin-exclusive.
router_deps = [Depends(require_role("Super Admin"))]


def _valid_permissions(perms: List[str]) -> List[str]:
    bad = [p for p in perms if p not in PLATFORM_MODULES]
    if bad:
        raise HTTPException(400, f"Unknown platform permission(s): {bad}. Choose from: {PLATFORM_MODULES}")
    return perms


def _sub_admin_out(u: dict) -> dict:
    return {
        "id": u["id"], "username": u["username"], "name": u["name"], "email": u["email"],
        "is_active": u["is_active"], "platform_permissions": u.get("platform_permissions", []),
    }


class SubAdminCreate(BaseModel):
    username: str
    password: str
    name: str
    email: str
    platform_permissions: List[str] = []


class SubAdminUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None
    platform_permissions: Optional[List[str]] = None


class PasswordChange(BaseModel):
    new_password: str


@router.get("/", dependencies=router_deps)
def list_sub_admins(db: Database = Depends(get_db)):
    rows = db[collections.USERS].find({"role": "Sub Admin"})
    return [_sub_admin_out(u) for u in rows]


@router.post("/", dependencies=router_deps)
def create_sub_admin(payload: SubAdminCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    _valid_permissions(payload.platform_permissions)
    doc = create_user_record(
        db, username=payload.username, password=payload.password, name=payload.name,
        email=payload.email, role="Sub Admin", org_id=None,
    )
    db[collections.USERS].update_one({"_id": doc["id"]}, {"$set": {"platform_permissions": payload.platform_permissions}})
    doc["platform_permissions"] = payload.platform_permissions
    log_action(db, user=cu.name, action="CREATE", module="Sub Admins", org_id=None, record_id=doc["id"],
               detail=f"Created Sub Admin {doc['username']}")
    return _sub_admin_out(doc)


@router.patch("/{sub_admin_id}", dependencies=router_deps)
def update_sub_admin(sub_admin_id: str, payload: SubAdminUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    u = db[collections.USERS].find_one({"_id": sub_admin_id, "role": "Sub Admin"})
    if not u:
        raise HTTPException(404, "Sub Admin not found")
    patch = payload.dict(exclude_none=True)
    if "platform_permissions" in patch:
        _valid_permissions(patch["platform_permissions"])
    if patch:
        db[collections.USERS].update_one({"_id": sub_admin_id}, {"$set": patch})
        u = db[collections.USERS].find_one({"_id": sub_admin_id})
    log_action(db, user=cu.name, action="UPDATE", module="Sub Admins", org_id=None, record_id=sub_admin_id,
               detail=f"Updated Sub Admin {u['username']}")
    return _sub_admin_out(u)


@router.post("/{sub_admin_id}/reset-password", dependencies=router_deps)
def reset_sub_admin_password(sub_admin_id: str, payload: PasswordChange, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    u = db[collections.USERS].find_one({"_id": sub_admin_id, "role": "Sub Admin"})
    if not u:
        raise HTTPException(404, "Sub Admin not found")
    db[collections.USERS].update_one({"_id": sub_admin_id}, {"$set": {"password_hash": hash_password(payload.new_password)}})
    log_action(db, user=cu.name, action="UPDATE", module="Sub Admins", org_id=None, record_id=sub_admin_id,
               detail=f"Password reset for Sub Admin {u['username']}")
    return {"message": "Password updated"}
