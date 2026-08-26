import hashlib
import os
import secrets
from datetime import datetime, timedelta
from types import SimpleNamespace
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pymongo.database import Database

from app.core import collections
from app.core.database import get_db
from app.core.permissions import has_permission

# database.py (imported above, transitively via get_db) already calls load_dotenv()
# at module scope, so .env is loaded by the time this runs.
SECRET_KEY = os.environ["SECRET_KEY"]
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 12  # 12 hours

pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def hash_reset_token(raw_token: str) -> str:
    """Only this hash is ever persisted — the raw token exists solely in the emailed
    link, so a database dump can't be replayed into a working reset token."""
    return hashlib.sha256(raw_token.encode()).hexdigest()


def generate_reset_token() -> tuple[str, str]:
    """Returns (raw_token, token_hash). Mint the raw token into the emailed reset link
    and store only token_hash — see hash_reset_token()."""
    raw_token = secrets.token_urlsafe(32)
    return raw_token, hash_reset_token(raw_token)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Database = Depends(get_db),
) -> SimpleNamespace:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db[collections.USERS].find_one({"username": username})
    if user is None:
        raise credentials_exception
    # Set only on a token minted by POST /auth/view-as — the username of the Admin who
    # is previewing this account, so /me can surface a "viewing as" banner to them.
    return SimpleNamespace(**user, view_as_actor=payload.get("actor"))


def require_role(*roles: str):
    """Dependency factory — requires user to have one of the given roles."""
    def checker(current_user: SimpleNamespace = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(roles)}",
            )
        return current_user
    return checker


def require_permission(module: str, action: str):
    """Dependency factory — requires the user's role to have `action` on `module`
    in the dynamic Roles & Permissions matrix (Admin always passes)."""
    def checker(
        current_user: SimpleNamespace = Depends(get_current_user),
        db: Database = Depends(get_db),
    ):
        if not has_permission(db, current_user, module, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires '{action}' permission on {module}",
            )
        return current_user
    return checker


# Platform-level modules a Sub Admin account can be granted access to — deliberately
# a separate, much simpler mechanism from require_permission()'s org-scoped matrix
# above. That matrix stores rows keyed by (role, org_id) and get_effective_permissions()
# hardcodes Super Admin to zero access (NO_ORG_ROLES in app/core/permissions.py) — both
# of those invariants are wrong for a platform-level, org-less Sub Admin role, so this
# checks a flat `platform_permissions` list stored directly on the Sub Admin's own user
# document instead of routing through has_permission()/get_effective_permissions().
PLATFORM_MODULES = [
    "overview", "organizations", "plans", "subscriptions", "free_access",
    "settings", "operations",
]


def require_platform_permission(module: str):
    """Dependency factory — Super Admin always passes; a Sub Admin passes only if
    `module` is in their own `platform_permissions` list; everyone else is rejected."""
    def checker(current_user: SimpleNamespace = Depends(get_current_user)):
        if current_user.role == "Super Admin":
            return current_user
        if current_user.role == "Sub Admin" and module in (getattr(current_user, "platform_permissions", None) or []):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires platform permission: {module}",
        )
    return checker


def require_prmanager_secret(x_prtracker_secret: Optional[str] = Header(None)):
    """Auth for inbound PR Manager -> PR Tracker sync calls — a plain shared-secret
    header, not a user JWT, since these are server-to-server (Postgres trigger via
    pg_net) with no PR Tracker session involved. Same value as this env's
    PRMANAGER_SHARED_SECRET, which PR Tracker's own outbound calls (app/core/
    prmanager_client.py) send under this same header name."""
    secret = os.environ.get("PRMANAGER_SHARED_SECRET", "")
    if not secret or x_prtracker_secret != secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid PR Manager sync secret")
