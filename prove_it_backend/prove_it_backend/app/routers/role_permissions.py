from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database
from pydantic import BaseModel
from typing import List
from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import next_id
from app.core.security import get_current_user, require_role
from app.core.audit import log_action
from app.core.permissions import MODULES, DEFAULT_PERMS, get_role_permissions as _effective_perms

router = APIRouter()

ROLES = ["Admin", "Manager", "Finance User", "Employee", "Viewer"]

# Access Control / Roles & Permissions / Audit Log / Settings / User Mgmt (mutations) are
# deliberately NOT part of this dynamic matrix — they stay hardcoded Admin-only in their own
# routers, so the tool that controls permissions can never be reconfigured by a non-Admin.


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


@router.get("/{role}", dependencies=[Depends(require_role("Admin"))])
def get_role_permissions(role: str, db: Database = Depends(get_db)):
    if role not in ROLES:
        raise HTTPException(400, f"role must be one of {ROLES}")
    # Always the same effective values `require_permission(...)` actually enforces —
    # gaps in a partially-customized role fall back to DEFAULT_PERMS, not blank/false.
    effective = _effective_perms(db, role)
    return [{"module": m, **effective[m]} for m in MODULES]


@router.post("/", dependencies=[Depends(require_role("Admin"))])
def save_role_permissions(payload: RolePermSave, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if payload.role not in ROLES:
        raise HTTPException(400, f"role must be one of {ROLES}")
    db[collections.ROLE_PERMISSIONS].delete_many({"role": payload.role})
    for p in payload.permissions:
        pid = next_id(db, collections.ROLE_PERMISSIONS)
        db[collections.ROLE_PERMISSIONS].insert_one({"_id": pid, "id": pid, "role": payload.role, **p.dict()})
    log_action(db, user=cu.name, action="UPDATE", module="Roles & Permissions", record_id=payload.role,
               detail=f"Updated permissions for {payload.role}")
    return {"message": "Permissions saved"}
