from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import uuid

from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import like
from app.core.security import get_current_user, require_role, hash_password
from app.core.audit import log_action

router = APIRouter()

ROLES = ["Admin", "Manager", "Finance User", "Employee", "Viewer"]


class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    email: str
    role: str = "Employee"
    initials: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    initials: Optional[str] = None
    is_active: Optional[bool] = None


class PasswordChange(BaseModel):
    new_password: str


def _user_out(u: dict):
    return {
        "id": u["id"], "username": u["username"], "name": u["name"],
        "email": u["email"], "role": u["role"], "initials": u["initials"], "is_active": u["is_active"],
    }


@router.get("/", dependencies=[Depends(require_role("Admin", "Manager"))])
def list_users(
    role:      Optional[str] = Query(None),
    is_active: Optional[str] = Query(None),
    search:    Optional[str] = Query(None),
    db: Database = Depends(get_db),
):
    query = {}
    if role:
        query["role"] = role
    if is_active is not None:
        query["is_active"] = is_active.lower() == "true"
    if search:
        query["$or"] = [
            {"username": like(search)},
            {"name": like(search)},
            {"email": like(search)},
            {"role": like(search)},
        ]
    return [_user_out(u) for u in db[collections.USERS].find(query)]


@router.post("/", dependencies=[Depends(require_role("Admin"))])
def create_user(payload: UserCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    if db[collections.USERS].find_one({"username": payload.username}):
        raise HTTPException(400, "Username already exists")
    if db[collections.USERS].find_one({"email": payload.email}):
        raise HTTPException(400, "Email already exists")
    if payload.role not in ROLES:
        raise HTTPException(400, f"Invalid role. Choose from: {ROLES}")
    uid = uuid.uuid4().hex
    doc = {
        "_id": uid, "id": uid,
        "username": payload.username,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "email": payload.email,
        "role": payload.role,
        "initials": payload.initials or payload.name[:2].upper(),
        "is_active": True,
    }
    db[collections.USERS].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Users", record_id=doc["id"], detail=f"Created user {doc['username']} with role {doc['role']}")
    return _user_out(doc)


@router.get("/{user_id}", dependencies=[Depends(require_role("Admin", "Manager"))])
def get_user(user_id: str, db: Database = Depends(get_db)):
    u = db[collections.USERS].find_one({"_id": user_id})
    if not u: raise HTTPException(404, "User not found")
    return _user_out(u)


@router.patch("/{user_id}", dependencies=[Depends(require_role("Admin"))])
def update_user(user_id: str, payload: UserUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    u = db[collections.USERS].find_one({"_id": user_id})
    if not u: raise HTTPException(404, "User not found")
    patch = payload.dict(exclude_none=True)
    if patch:
        db[collections.USERS].update_one({"_id": user_id}, {"$set": patch})
        u = db[collections.USERS].find_one({"_id": user_id})
    log_action(db, user=cu.name, action="UPDATE", module="Users", record_id=u["id"], detail=f"Updated user {u['username']}")
    return _user_out(u)


@router.post("/{user_id}/change-password", dependencies=[Depends(require_role("Admin"))])
def change_password(user_id: str, payload: PasswordChange, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    u = db[collections.USERS].find_one({"_id": user_id})
    if not u: raise HTTPException(404, "User not found")
    db[collections.USERS].update_one({"_id": user_id}, {"$set": {"password_hash": hash_password(payload.new_password)}})
    log_action(db, user=cu.name, action="UPDATE", module="Users", record_id=u["id"], detail=f"Password changed for {u['username']}")
    return {"message": "Password updated"}


@router.delete("/{user_id}", dependencies=[Depends(require_role("Admin"))])
def delete_user(user_id: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    u = db[collections.USERS].find_one({"_id": user_id})
    if not u: raise HTTPException(404, "User not found")
    db[collections.USERS].delete_one({"_id": user_id})
    log_action(db, user=cu.name, action="DELETE", module="Users", record_id=user_id, detail=f"Deleted user {u['username']}")
    return {"message": "User deleted"}
