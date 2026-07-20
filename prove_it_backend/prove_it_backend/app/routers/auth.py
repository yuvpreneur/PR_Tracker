from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pymongo.database import Database
from pydantic import BaseModel

from app.core import collections
from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_current_user, require_role
from app.core.audit import log_action
from app.core.permissions import get_effective_permissions, own_emp_id

router = APIRouter()


class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Database = Depends(get_db),
):
    user = db[collections.USERS].find_one({"username": form_data.username})
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="Account is inactive")

    token = create_access_token({"sub": user["username"], "role": user["role"]})
    log_action(db, user=user["name"], action="LOGIN", module="Auth", detail=f"Login from {user['role']} account")

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "initials": user["initials"],
        },
    }


@router.get("/me")
def me(current_user=Depends(get_current_user), db: Database = Depends(get_db)):
    emp_id = own_emp_id(db, current_user)
    page_overrides = (
        {row["page"]: row["allowed"] for row in db[collections.PAGE_PERMISSIONS].find({"emp_id": emp_id})}
        if emp_id else {}
    )
    return {
        "id": current_user.id,
        "username": current_user.username,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "initials": current_user.initials,
        "permissions": get_effective_permissions(db, current_user),
        # Explicit per-employee Page Access grants/denials (app/routers/access_control.py) —
        # these win over the role matrix AND the frontend's self-service nav bypass when set.
        "page_overrides": page_overrides,
        # Set only while an Admin is previewing this account via POST /view-as.
        "view_as": {"actor": current_user.view_as_actor} if current_user.view_as_actor else None,
    }


# Roles an Admin can preview via "View as" — excludes Admin itself (nothing to preview,
# Admin already sees everything) and matches the fixed role set seeded in app/core/seed.py.
VIEW_AS_ROLES = {"Manager", "Finance User", "Employee", "Viewer"}


class ViewAsRequest(BaseModel):
    role: str


@router.post("/view-as", response_model=Token)
def view_as(
    body: ViewAsRequest,
    current_user=Depends(require_role("Admin")),
    db: Database = Depends(get_db),
):
    """Admin-only: mint a short-lived token that previews the app as another role,
    without needing that role's password or leaving the Admin's own session. Reuses a
    real account with that role (rather than a synthetic identity) so permissions —
    including any per-employee Page Access overrides — come out exactly as they would
    for a genuine user of that role. See get_effective_permissions()."""
    if body.role not in VIEW_AS_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Can only view as one of: {', '.join(sorted(VIEW_AS_ROLES))}",
        )

    target = db[collections.USERS].find_one({"role": body.role}, sort=[("username", 1)])
    if not target:
        raise HTTPException(status_code=404, detail=f"No account found with role '{body.role}'")

    token = create_access_token(
        {"sub": target["username"], "role": target["role"], "view_as": True, "actor": current_user.username},
        expires_delta=timedelta(minutes=60),
    )
    log_action(
        db, user=current_user.name, action="VIEW_AS", module="Auth",
        detail=f"{current_user.name} (Admin) started viewing the app as {body.role} ({target['name']})",
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": target["id"],
            "username": target["username"],
            "name": target["name"],
            "email": target["email"],
            "role": target["role"],
            "initials": target["initials"],
        },
    }
