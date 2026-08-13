from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database
from pydantic import BaseModel
from typing import List
from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import next_id
from app.core.security import get_current_user, require_role
from app.core.audit import log_action
from app.core.permissions import MODULES, DEFAULT_PERMS, FULL_ACCESS_ROLES, get_role_permissions as _effective_perms

router = APIRouter()

ROLES = ["Admin", "Manager", "Finance User", "Employee", "Viewer"]

# Access Control / Roles & Permissions / Audit Log / Settings / User Mgmt (mutations) are
# deliberately NOT part of this dynamic matrix — they stay hardcoded Admin/Manager-only in
# their own routers, so the tool that controls permissions can never be reconfigured by
# Finance User/Employee/Viewer. Saving here for "Admin" or "Manager" is a no-op anyway —
# get_role_permissions() short-circuits both to full access regardless of what's stored.


class ModulePerm(BaseModel):
    module: str
    view: bool = False
    create: bool = False
    edit: bool = False
    delete: bool = False
    approve: bool = False
    export: bool = False


class RolePermSave(BaseModel):
    role: str
    permissions: List[ModulePerm]


@router.get("/{role}", dependencies=[Depends(require_role("Admin", "Manager"))])
def get_role_permissions(role: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if role not in ROLES:
        raise HTTPException(400, f"role must be one of {ROLES}")
    # Always the same effective values `require_permission(...)` actually enforces —
    # gaps in a partially-customized role fall back to DEFAULT_PERMS, not blank/false.
    effective = _effective_perms(db, role, cu.org_id)
    return [{"module": m, **effective[m]} for m in MODULES]


@router.post("/", dependencies=[Depends(require_role("Admin", "Manager"))])
def save_role_permissions(payload: RolePermSave, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if payload.role not in ROLES:
        raise HTTPException(400, f"role must be one of {ROLES}")
    db[collections.ROLE_PERMISSIONS].delete_many({"role": payload.role, "org_id": cu.org_id})
    for p in payload.permissions:
        pid = next_id(db, collections.ROLE_PERMISSIONS)
        doc = {"_id": pid, "id": pid, "role": payload.role, **p.dict(), "org_id": cu.org_id}
        # Deletion authority stays exclusive to FULL_ACCESS_ROLES, always — reject any
        # attempt to persist delete=True for another role rather than silently accepting
        # then ignoring it (get_role_permissions() forces this too, this just keeps
        # stored data honest).
        if payload.role not in FULL_ACCESS_ROLES:
            doc["delete"] = False
        db[collections.ROLE_PERMISSIONS].insert_one(doc)
    log_action(db, user=cu.name, action="UPDATE", module="Roles & Permissions", record_id=payload.role,
               detail=f"Updated permissions for {payload.role}", org_id=cu.org_id)
    return {"message": "Permissions saved"}
