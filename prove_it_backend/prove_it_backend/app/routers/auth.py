from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pymongo.database import Database
from pydantic import BaseModel

from app.core import collections
from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_current_user
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
    }
