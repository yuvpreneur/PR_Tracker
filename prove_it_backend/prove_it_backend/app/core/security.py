import hashlib
import os
import secrets
from datetime import datetime, timedelta
from types import SimpleNamespace
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
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
