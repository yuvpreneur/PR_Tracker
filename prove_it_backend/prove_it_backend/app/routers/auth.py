import os
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pymongo.database import Database
from pydantic import BaseModel

from app.core import collections
from app.core.database import get_db
from app.core.security import (
    verify_password, create_access_token, get_current_user, require_role, hash_password,
    generate_reset_token, hash_reset_token,
)
from app.core.audit import log_action
from app.core.email import send_email
from app.core.permissions import get_effective_permissions, own_emp_id

router = APIRouter()


class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict


@router.get("/registration-status")
def registration_status(db: Database = Depends(get_db)):
    """Public — lets the sign-in page decide whether to show "Create admin account".
    Registration exists only to bootstrap the very first account, since every other way
    to create a user (POST /api/users) already requires being logged in as an existing
    Admin/Manager. It closes itself for good the moment any user exists — see
    POST /register."""
    return {"available": db[collections.USERS].count_documents({}) == 0}


class RegisterRequest(BaseModel):
    username: str
    password: str
    name: str
    email: str


@router.post("/register", response_model=Token)
def register(payload: RegisterRequest, db: Database = Depends(get_db)):
    """Public, but only while the Users collection is empty. One-time bootstrap for the
    first Admin account — see registration_status()'s docstring for why this needs to
    exist as a public endpoint at all."""
    if db[collections.USERS].count_documents({}) > 0:
        raise HTTPException(status_code=403, detail="Registration is closed — an account already exists. Ask an Admin to create your account.")

    uid = uuid.uuid4().hex
    doc = {
        "_id": uid, "id": uid,
        "username": payload.username,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "email": payload.email,
        "role": "Admin",
        "initials": payload.name[:2].upper(),
        "is_active": True,
        "org_id": None,
    }
    db[collections.USERS].insert_one(doc)
    log_action(db, user=doc["name"], action="CREATE", module="Auth", org_id=None, detail="Registered as the first Admin account")

    token = create_access_token({"sub": doc["username"], "role": doc["role"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": doc["id"], "username": doc["username"], "name": doc["name"],
            "email": doc["email"], "role": doc["role"], "initials": doc["initials"],
        },
    }


# Reachable by anyone before a Super Admin exists — the platform-wide equivalent of
# /register above, but for the one account that can create Organizations rather than
# just this workspace's first Admin. Since this grants owner-level access to the whole
# platform (not just one org), it's gated by a second factor beyond "does one exist
# yet": a secret only whoever runs the deploy knows, set via SUPER_ADMIN_SETUP_TOKEN.
# Fails closed if that env var isn't configured at all, rather than silently accepting
# an unprotected bootstrap.
SUPER_ADMIN_SETUP_TOKEN = os.environ.get("SUPER_ADMIN_SETUP_TOKEN")


@router.get("/super-admin-status")
def super_admin_status(db: Database = Depends(get_db)):
    return {"available": db[collections.USERS].count_documents({"role": "Super Admin"}) == 0}


class SuperAdminRegisterRequest(BaseModel):
    username: str
    password: str
    name: str
    email: str
    setup_token: str


@router.post("/register-super-admin", response_model=Token)
def register_super_admin(payload: SuperAdminRegisterRequest, db: Database = Depends(get_db)):
    if not SUPER_ADMIN_SETUP_TOKEN or payload.setup_token != SUPER_ADMIN_SETUP_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid setup token")
    if db[collections.USERS].count_documents({"role": "Super Admin"}) > 0:
        raise HTTPException(status_code=403, detail="A Super Admin account already exists.")

    uid = uuid.uuid4().hex
    doc = {
        "_id": uid, "id": uid,
        "username": payload.username,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "email": payload.email,
        "role": "Super Admin",
        "initials": payload.name[:2].upper(),
        "is_active": True,
        "org_id": None,
    }
    db[collections.USERS].insert_one(doc)
    log_action(db, user=doc["name"], action="CREATE", module="Auth", org_id=None, detail="Bootstrapped the Super Admin account")

    token = create_access_token({"sub": doc["username"], "role": doc["role"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": doc["id"], "username": doc["username"], "name": doc["name"],
            "email": doc["email"], "role": doc["role"], "initials": doc["initials"],
        },
    }


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

    # Session length is a platform-wide setting (app/routers/platform_settings.py),
    # falling back to the original hardcoded default if it's never been configured.
    platform_settings = db[collections.PLATFORM_SETTINGS].find_one({"_id": "platform"}) or {}
    timeout_minutes = platform_settings.get("session_timeout_minutes")
    expires_delta = timedelta(minutes=timeout_minutes) if timeout_minutes else None
    token = create_access_token({"sub": user["username"], "role": user["role"]}, expires_delta=expires_delta)
    log_action(db, user=user["name"], action="LOGIN", module="Auth", org_id=user.get("org_id"), detail=f"Login from {user['role']} account")

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
        "org_id": getattr(current_user, "org_id", None),
        # Only meaningful for role == "Sub Admin" — see app/core/security.py's
        # require_platform_permission(), which is what actually enforces this list
        # server-side. The frontend only uses it to decide which nav links to show.
        "platform_permissions": getattr(current_user, "platform_permissions", None) or [],
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
    current_user=Depends(require_role("Admin", "Manager")),
    db: Database = Depends(get_db),
):
    """Admin/Manager-only: mint a short-lived token that previews the app as another role,
    without needing that role's password or leaving the current session. Reuses a
    real account with that role (rather than a synthetic identity) so permissions —
    including any per-employee Page Access overrides — come out exactly as they would
    for a genuine user of that role. See get_effective_permissions()."""
    if body.role not in VIEW_AS_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Can only view as one of: {', '.join(sorted(VIEW_AS_ROLES))}",
        )

    # Scoped to the acting Admin/Manager's own org — an unscoped lookup would risk
    # handing back another organization's account of that role (see multi-tenant
    # org_id isolation retrofit).
    target = db[collections.USERS].find_one({"role": body.role, "org_id": current_user.org_id}, sort=[("username", 1)])
    if not target:
        raise HTTPException(status_code=404, detail=f"No account found with role '{body.role}'")

    token = create_access_token(
        {"sub": target["username"], "role": target["role"], "view_as": True, "actor": current_user.username},
        expires_delta=timedelta(minutes=60),
    )
    log_action(
        db, user=current_user.name, action="VIEW_AS", module="Auth", org_id=current_user.org_id,
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


# Generic response for /forgot-password regardless of outcome — never reveals whether
# the email belongs to an account, to avoid user enumeration.
FORGOT_PASSWORD_RESPONSE = {"message": "If an account exists for that email, a password reset link has been sent."}

RESET_TOKEN_TTL = timedelta(minutes=30)


class ForgotPasswordRequest(BaseModel):
    email: str


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Database = Depends(get_db)):
    """Public. Always returns the same generic message — see FORGOT_PASSWORD_RESPONSE —
    so the response can't be used to enumerate which emails have accounts. Deliberately
    not audit-logged: this is an unauthenticated request, and logging every attempt would
    let an Admin read /api/audit-log and enumerate real accounts by email."""
    user = db[collections.USERS].find_one({"email": payload.email, "is_active": True})
    if not user:
        return FORGOT_PASSWORD_RESPONSE

    now = datetime.utcnow()
    db[collections.PASSWORD_RESET_TOKENS].delete_many({"user_id": user["id"]})
    raw_token, token_hash = generate_reset_token()
    token_id = uuid.uuid4().hex
    db[collections.PASSWORD_RESET_TOKENS].insert_one({
        "_id": token_id,
        "id": token_id,
        "user_id": user["id"],
        "token_hash": token_hash,
        "created_at": now,
        "expires_at": now + RESET_TOKEN_TTL,
        "used": False,
    })

    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    link = f"{frontend_url}/?token={raw_token}"
    subject = "Reset your Prove IT Catalysts password"
    text_body = (
        f"Hi {user['name']},\n\n"
        f"We received a request to reset your Prove IT Catalysts password. "
        f"Use the link below within 30 minutes to choose a new one:\n\n{link}\n\n"
        f"If you didn't request this, you can safely ignore this email.\n\n"
        f"— Prove IT Catalysts — Project & Financial Tracker"
    )
    html_body = (
        f"<p>Hi {user['name']},</p>"
        f"<p>We received a request to reset your <strong>Prove IT Catalysts</strong> password. "
        f"Click the link below within 30 minutes to choose a new one:</p>"
        f'<p><a href="{link}">{link}</a></p>'
        f"<p>If you didn't request this, you can safely ignore this email.</p>"
        f"<p style=\"color:#888;font-size:12px;\">— Prove IT Catalysts — Project &amp; Financial Tracker</p>"
    )
    try:
        send_email(user["email"], subject, html_body, text_body)
        return FORGOT_PASSWORD_RESPONSE
    except RuntimeError:
        # SMTP isn't configured — hand the link straight back instead of emailing it,
        # so the flow still works without mail infrastructure in place.
        print(f"[DEV] Password reset link (SMTP not configured): {link}")
        return {**FORGOT_PASSWORD_RESPONSE, "reset_link": link}


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Database = Depends(get_db)):
    """Public — consumes a token minted by /forgot-password. Tokens are single-use
    (see "used") and expire after RESET_TOKEN_TTL."""
    token_hash = hash_reset_token(payload.token)
    token_doc = db[collections.PASSWORD_RESET_TOKENS].find_one({
        "token_hash": token_hash,
        "used": False,
        "expires_at": {"$gt": datetime.utcnow()},
    })
    if not token_doc:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired. Please request a new one.")

    user = db[collections.USERS].find_one({"id": token_doc["user_id"]})
    if not user:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired. Please request a new one.")

    db[collections.USERS].update_one({"_id": user["_id"]}, {"$set": {"password_hash": hash_password(payload.new_password)}})
    db[collections.PASSWORD_RESET_TOKENS].update_one({"_id": token_doc["_id"]}, {"$set": {"used": True}})
    log_action(db, user=user["name"], action="UPDATE", module="Auth", org_id=user.get("org_id"), record_id=user["id"], detail="Password reset via forgot-password flow")

    return {"message": "Password updated. You can now log in."}
